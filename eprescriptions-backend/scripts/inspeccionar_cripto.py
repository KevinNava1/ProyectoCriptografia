"""Inspector cripto desde la terminal — consulta directa a la BD.

Reusa el mismo estilo visual que `crypto_log` (cajas + colores) para mostrar
los blobs criptográficos persistidos: ciphertext, IV, TAG, AAD, wraps
RSA-OAEP, firmas ECDSA y SHA3 hash. Útil para demos en vivo: lanzas el
script en una terminal y, en otra, emites/dispensas recetas — al refrescar
ves cómo MySQL guarda material nuevo no determinista.

Modos:
    python -m scripts.inspeccionar_cripto                  # snapshot único
    python -m scripts.inspeccionar_cripto --watch 3        # refrescar cada 3s
    python -m scripts.inspeccionar_cripto --receta 12      # solo una
    python -m scripts.inspeccionar_cripto --diff 11 12     # comparar dos
    python -m scripts.inspeccionar_cripto --audit          # audit log §12
    python -m scripts.inspeccionar_cripto --no-color       # texto plano

Dentro de Docker (api detrás de nginx):
    docker compose exec api python -m scripts.inspeccionar_cripto --watch 4
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from typing import Optional

# Permite ejecutarlo como `python scripts/inspeccionar_cripto.py` desde el
# directorio del backend (sin -m), agregando el padre al PYTHONPATH.
_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND = os.path.dirname(_HERE)
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

from database import AuditLog, Receta, RecetaAccesoFarmacia, SessionLocal, Usuario  # noqa: E402


# ───────── colores ─────────
USE_COLOR = sys.stderr.isatty() and os.getenv("NO_COLOR") is None
RESET = "\033[0m" if USE_COLOR else ""
BOLD = "\033[1m" if USE_COLOR else ""
DIM = "\033[2m" if USE_COLOR else ""
CYAN = "\033[36m" if USE_COLOR else ""
GREEN = "\033[32m" if USE_COLOR else ""
YELLOW = "\033[33m" if USE_COLOR else ""
RED = "\033[31m" if USE_COLOR else ""
MAGENTA = "\033[35m" if USE_COLOR else ""
BLUE = "\033[34m" if USE_COLOR else ""


def _disable_color() -> None:
    global RESET, BOLD, DIM, CYAN, GREEN, YELLOW, RED, MAGENTA, BLUE
    RESET = BOLD = DIM = CYAN = GREEN = YELLOW = RED = MAGENTA = BLUE = ""


def _hex(b: Optional[bytes]) -> str:
    return bytes(b).hex() if b is not None else ""


def _short(s: str, head: int = 24, tail: int = 12) -> str:
    if not s:
        return "—"
    if len(s) <= head + tail + 3:
        return s
    return f"{s[:head]}…{s[-tail:]}"


def _bar(c: str = "═", n: int = 78) -> str:
    return c * n


def _isoformat(dt) -> str:
    if not dt:
        return "—"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone().isoformat(timespec="seconds")


# ───────── render ─────────
def _print_banner(text: str) -> None:
    print(f"\n{BOLD}{BLUE}{_bar('═')}{RESET}")
    print(f"{BOLD}{BLUE}  ▶ {text}{RESET}")
    print(f"{BOLD}{BLUE}{_bar('═')}{RESET}")


def _print_meta(consulta_n: int, total: int) -> None:
    ahora = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    print(
        f"{DIM}  consulta #{consulta_n}  ·  {ahora}  ·  recetas={total}{RESET}"
    )


def _hash_diff_pct(a: str, b: str) -> Optional[float]:
    if not a or not b:
        return None
    n = min(len(a), len(b))
    if n == 0:
        return None
    d = sum(1 for i in range(n) if a[i] != b[i])
    return round(d * 100.0 / n, 1)


def render_receta(r: Receta, prev: Optional[Receta] = None) -> None:
    ct_hex = _hex(r.ciphertext)
    iv_hex = _hex(r.iv_aes)
    tag_hex = _hex(r.tag_aes)
    wrap_pac_hex = _hex(r.c_wrap_pac)
    try:
        aad_json = json.loads(bytes(r.aad).decode())
    except Exception:
        aad_json = None

    print(f"\n{CYAN}{_bar('━')}{RESET}")
    print(
        f"{CYAN}  {BOLD}RECETA #{r.id}{RESET}{CYAN}  ·  estado={r.estado}  ·  "
        f"emitida={_isoformat(r.fecha_creacion)}{RESET}"
    )
    print(f"{CYAN}{_bar('━')}{RESET}")

    print(f"  {BOLD}AES-128-GCM{RESET}")
    print(f"    {YELLOW}ciphertext{RESET}  {len(r.ciphertext)}B  {_short(ct_hex)}")
    print(f"    {YELLOW}IV{RESET}          12B            {_short(iv_hex)}")
    print(f"    {YELLOW}TAG{RESET}         16B            {_short(tag_hex)}")
    if aad_json is not None:
        print(f"    {YELLOW}AAD{RESET}         {len(r.aad)}B  {DIM}{json.dumps(aad_json, separators=(',', ':'))}{RESET}")

    print(f"  {BOLD}RSA-OAEP-SHA256 wrap{RESET}")
    print(
        f"    {CYAN}paciente{RESET}    {len(r.c_wrap_pac)}B  {_short(wrap_pac_hex)}"
    )
    for a in (r.accesos_farmacias or []):
        w = _hex(a.c_wrap_far)
        print(
            f"    {CYAN}farm #{a.farmacia_id:<4}{RESET} {len(a.c_wrap_far)}B  {_short(w)}"
        )

    firma = r.firma_doctor if r.firma_doctor != "pending" else None
    print(f"  {BOLD}ECDSA P-256 (firma médico){RESET}")
    print(f"    {MAGENTA}firma{RESET}       {_short(firma or '', 28, 14) if firma else '—'}")
    print(f"  {BOLD}SHA3-256 (huella R){RESET}")
    print(f"    {GREEN}hash{RESET}        {_short(r.hash_sha3_hex, 28, 14)}")

    if r.eventos:
        print(f"  {BOLD}Sellos de dispensación{RESET}")
        for ev in r.eventos:
            print(
                f"    {DIM}#{ev.numero_dispensacion} · farm={ev.farmaceutico_id} · "
                f"{_isoformat(ev.timestamp)}{RESET}"
            )
            print(
                f"      manifiesto {len(ev.manifiesto_sello)}B  "
                f"{_short(_hex(ev.manifiesto_sello))}"
            )
            print(f"      firma_F     {_short(ev.firma_sello, 28, 14)}")
            if ev.firma_paciente:
                print(f"      firma_P     {_short(ev.firma_paciente, 28, 14)}")

    if prev is not None:
        prev_ct = _hex(prev.ciphertext)
        prev_iv = _hex(prev.iv_aes)
        prev_wrap = _hex(prev.c_wrap_pac)
        d_ct = _hash_diff_pct(ct_hex, prev_ct)
        d_iv = _hash_diff_pct(iv_hex, prev_iv)
        d_wrap = _hash_diff_pct(wrap_pac_hex, prev_wrap)
        partes = []
        if d_ct is not None: partes.append(f"ct={d_ct}%")
        if d_iv is not None: partes.append(f"iv={d_iv}%")
        if d_wrap is not None: partes.append(f"wrap={d_wrap}%")
        if partes:
            print(
                f"  {DIM}Δ vs #{prev.id}:{RESET} {GREEN}{' · '.join(partes)}{RESET}"
            )


def render_diff(r1: Receta, r2: Receta) -> None:
    _print_banner(f"COMPARACIÓN cripto · #{r1.id} vs #{r2.id}")
    pairs = [
        ("ciphertext", _hex(r1.ciphertext), _hex(r2.ciphertext)),
        ("IV",         _hex(r1.iv_aes),     _hex(r2.iv_aes)),
        ("TAG",        _hex(r1.tag_aes),    _hex(r2.tag_aes)),
        ("c_wrap_pac", _hex(r1.c_wrap_pac), _hex(r2.c_wrap_pac)),
        ("firma_med",  r1.firma_doctor or "", r2.firma_doctor or ""),
        ("sha3_hex",   r1.hash_sha3_hex,    r2.hash_sha3_hex),
    ]
    for nombre, a, b in pairs:
        d = _hash_diff_pct(a, b)
        bytes_a = len(a) // 2 if all(c in "0123456789abcdef" for c in a[:32]) else len(a)
        bytes_b = len(b) // 2 if all(c in "0123456789abcdef" for c in b[:32]) else len(b)
        color = GREEN if (d or 0) > 50 else YELLOW if (d or 0) > 0 else DIM
        d_str = f"{d}%" if d is not None else "—"
        print(
            f"  {BOLD}{nombre:<11}{RESET}"
            f"  #{r1.id}={bytes_a}B  #{r2.id}={bytes_b}B  "
            f"{color}Δ={d_str}{RESET}"
        )
    print(f"\n  {DIM}(Δ alto ≈ cifrado/firma sano · Δ=0% sobre cuerpo cifrado = sospechoso){RESET}")


def render_audit(session, limit: int = 50) -> None:
    eventos = session.query(AuditLog).order_by(AuditLog.id.desc()).limit(limit).all()
    _print_banner(f"AUDIT LOG · §12 · últimos {len(eventos)}")
    for a in eventos:
        ts = _isoformat(a.timestamp)
        meta = json.dumps(a.meta, separators=(",", ":")) if a.meta else "—"
        col = GREEN if a.resultado == "ok" else RED
        print(
            f"  {DIM}{ts}{RESET}  "
            f"{col}{a.resultado:<9}{RESET}  "
            f"{BOLD}{a.accion:<22}{RESET}"
            f"  usr={a.usuario_id}  rec={a.id_receta}  {DIM}{meta}{RESET}"
        )


# ───────── orquestación ─────────
def snapshot(args, consulta_n: int) -> None:
    s = SessionLocal()
    try:
        if args.audit:
            render_audit(s, args.limit)
            return

        if args.diff:
            ids = args.diff
            r1 = s.query(Receta).filter(Receta.id == ids[0]).first()
            r2 = s.query(Receta).filter(Receta.id == ids[1]).first()
            if not r1 or not r2:
                print(f"{RED}Alguna de las recetas no existe.{RESET}")
                return
            render_diff(r1, r2)
            return

        q = s.query(Receta)
        if args.receta is not None:
            q = q.filter(Receta.id == args.receta)
        q = q.order_by(Receta.id.desc())
        if args.limit and not args.receta:
            q = q.limit(args.limit)
        recetas = q.all()

        _print_banner(
            f"INSPECTOR CRIPTO — SELECT recetas FROM mysql  · consulta #{consulta_n}"
        )
        _print_meta(consulta_n, len(recetas))

        if not recetas:
            print(f"  {YELLOW}(sin recetas){RESET}")
            return

        # `prev` apunta a la receta MÁS NUEVA que ya pintamos (en el orden de
        # iteración desc → la "anterior" es la siguiente más nueva). Útil para
        # ver avalancha entre emisiones consecutivas.
        prev = None
        for r in recetas:
            render_receta(r, prev=prev)
            prev = r
    finally:
        s.close()


def main() -> int:
    p = argparse.ArgumentParser(description="Inspector cripto SecureRx (BD directa)")
    p.add_argument("--watch", type=float, default=0,
                   help="refrescar cada N segundos (0 = una sola vez)")
    p.add_argument("--limit", type=int, default=20, help="máximo de recetas a mostrar")
    p.add_argument("--receta", type=int, help="inspeccionar solo esta receta por id")
    p.add_argument("--diff", type=int, nargs=2, metavar=("ID1", "ID2"),
                   help="comparar dos recetas")
    p.add_argument("--audit", action="store_true", help="mostrar audit log §12")
    p.add_argument("--no-color", action="store_true")
    args = p.parse_args()

    if args.no_color:
        _disable_color()

    consulta_n = 0
    try:
        while True:
            consulta_n += 1
            snapshot(args, consulta_n)
            if args.watch <= 0:
                break
            print(f"\n{DIM}  ↻ siguiente consulta en {args.watch:.1f}s (Ctrl+C para salir){RESET}")
            time.sleep(args.watch)
    except KeyboardInterrupt:
        print(f"\n{DIM}  ⏹ interrumpido por usuario tras {consulta_n} consulta(s){RESET}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
