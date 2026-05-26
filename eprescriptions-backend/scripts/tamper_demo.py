"""Tampering controlado para demo — corrompe UN campo crítico por tabla
y guarda los valores originales en `tamper_backup.json`.

Objetivo: demostrar en el frontend que las verificaciones criptográficas
detectan modificaciones en la BD (firmas inválidas, AES-GCM tag mismatch,
RSA-OAEP unwrap fail, etc.). Para revertir: `restore_demo.py`.

Uso (desde eprescriptions-backend/):
    ./venv/bin/python -m scripts.tamper_demo
    ./venv/bin/python -m scripts.tamper_demo --receta 12   # forzar id
    ./venv/bin/python -m scripts.tamper_demo --dry-run     # solo mostrar

El script:
  1. Lee .env para credenciales.
  2. Si DB_HOST=localhost no responde (típico con docker-compose), busca la
     IP del contenedor `eprescriptions-backend-db-1` y la usa.
  3. Por cada tabla, elige el registro más reciente (o el que indique
     `--receta` cuando aplica) y tampera un campo criptográficamente
     sensible. Las recetas/eventos/cancelaciones/accesos se eligen
     atados a la misma receta para que el efecto sea visible en el front.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import socket
import subprocess
import sys
from datetime import datetime

import pymysql
from dotenv import load_dotenv

_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND = os.path.dirname(_HERE)
BACKUP_PATH = os.path.join(_HERE, "tamper_backup.json")


# ───────────── conexión ─────────────
def _resolve_db_host(env_host: str, port: int) -> str:
    """Prioriza el contenedor docker `eprescriptions-backend-db-1` (es el que
    usa el backend dockerizado y el que ve el frontend). Si no está, usa el
    host del .env. Hay setups donde también hay un MySQL local en
    localhost:3306 con datos distintos — esto evita pegarle al equivocado.
    """
    try:
        out = subprocess.check_output(
            [
                "docker",
                "inspect",
                "eprescriptions-backend-db-1",
                "--format",
                "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}",
            ],
            text=True,
            timeout=3,
            stderr=subprocess.DEVNULL,
        ).strip()
        if out:
            try:
                with socket.create_connection((out, port), timeout=2):
                    return out
            except OSError:
                pass
    except (subprocess.SubprocessError, FileNotFoundError):
        pass
    return env_host


def _connect():
    load_dotenv(os.path.join(_BACKEND, ".env"), override=True)
    host = _resolve_db_host(os.getenv("DB_HOST", "localhost"), int(os.getenv("DB_PORT", "3306")))
    return pymysql.connect(
        host=host,
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
        charset="utf8mb4",
        autocommit=False,
    )


# ───────────── helpers de tampering ─────────────
def _flip_last_char(s: str) -> str:
    """Cambia el último carácter base64 — invalida la firma sin romper el formato."""
    if not s:
        return s
    last = s.rstrip("=\n")  # respetar padding b64
    if not last:
        return s
    swap_map = {"A": "B", "/": "+", "+": "/", "=": "A"}
    pivot = last[-1]
    new_char = swap_map.get(pivot, "A" if pivot != "A" else "B")
    return last[:-1] + new_char + s[len(last):]


def _flip_first_byte(b: bytes) -> bytes:
    if not b:
        return b
    return bytes([b[0] ^ 0xFF]) + b[1:]


def _b64e(b: bytes | None) -> str | None:
    return None if b is None else base64.b64encode(b).decode("ascii")


# ───────────── operaciones por tabla ─────────────
def _pick_target_receta(cur, forced_id: int | None) -> int | None:
    if forced_id:
        cur.execute("SELECT id FROM recetas WHERE id=%s", (forced_id,))
    else:
        cur.execute("SELECT id FROM recetas ORDER BY id DESC LIMIT 1")
    row = cur.fetchone()
    return row[0] if row else None


def _tamper_recetas(cur, receta_id: int, backup: list, dry: bool) -> None:
    cur.execute(
        "SELECT firma_doctor, ciphertext FROM recetas WHERE id=%s",
        (receta_id,),
    )
    row = cur.fetchone()
    if not row:
        return
    firma_orig, cipher_orig = row
    firma_new = _flip_last_char(firma_orig)
    cipher_new = _flip_first_byte(cipher_orig)

    backup.append({
        "table": "recetas",
        "where": {"id": receta_id},
        "originals": {
            "firma_doctor": firma_orig,
            "ciphertext_b64": _b64e(cipher_orig),
        },
        "tamper": "flip último char de firma_doctor + flip primer byte de ciphertext",
        "expected_fail": "Verificación ECDSA del médico falla; AES-GCM tag mismatch al descifrar",
    })

    if not dry:
        cur.execute(
            "UPDATE recetas SET firma_doctor=%s, ciphertext=%s WHERE id=%s",
            (firma_new, cipher_new, receta_id),
        )
    print(f"  [recetas#{receta_id}] firma_doctor + ciphertext alterados")


def _tamper_receta_acceso(cur, receta_id: int, backup: list, dry: bool) -> None:
    cur.execute(
        "SELECT id, farmacia_id, c_wrap_far FROM receta_acceso_farmacias WHERE receta_id=%s LIMIT 1",
        (receta_id,),
    )
    row = cur.fetchone()
    if not row:
        print(f"  [receta_acceso_farmacias] sin filas para receta {receta_id} — skip")
        return
    acc_id, farm_id, wrap_orig = row
    wrap_new = _flip_first_byte(wrap_orig)

    backup.append({
        "table": "receta_acceso_farmacias",
        "where": {"id": acc_id},
        "originals": {"c_wrap_far_b64": _b64e(wrap_orig)},
        "tamper": "flip primer byte de c_wrap_far",
        "expected_fail": f"Farmacia {farm_id} no podrá desenvolver la DEK (RSA-OAEP fail)",
    })
    if not dry:
        cur.execute(
            "UPDATE receta_acceso_farmacias SET c_wrap_far=%s WHERE id=%s",
            (wrap_new, acc_id),
        )
    print(f"  [receta_acceso_farmacias#{acc_id}] c_wrap_far alterado")


def _tamper_eventos(cur, receta_id: int, backup: list, dry: bool) -> None:
    cur.execute(
        "SELECT id, firma_sello FROM eventos_dispensacion WHERE receta_id=%s "
        "ORDER BY numero_dispensacion DESC LIMIT 1",
        (receta_id,),
    )
    row = cur.fetchone()
    if not row:
        print(f"  [eventos_dispensacion] sin eventos para receta {receta_id} — busco último global")
        cur.execute("SELECT id, firma_sello FROM eventos_dispensacion ORDER BY id DESC LIMIT 1")
        row = cur.fetchone()
        if not row:
            print("  [eventos_dispensacion] tabla vacía — skip")
            return
    ev_id, firma_orig = row
    firma_new = _flip_last_char(firma_orig)

    backup.append({
        "table": "eventos_dispensacion",
        "where": {"id": ev_id},
        "originals": {"firma_sello": firma_orig},
        "tamper": "flip último char de firma_sello",
        "expected_fail": "Verificación de la firma del farmacéutico (acuse) falla",
    })
    if not dry:
        cur.execute(
            "UPDATE eventos_dispensacion SET firma_sello=%s WHERE id=%s",
            (firma_new, ev_id),
        )
    print(f"  [eventos_dispensacion#{ev_id}] firma_sello alterada")


def _tamper_cancelaciones(cur, receta_id: int, backup: list, dry: bool) -> None:
    cur.execute(
        "SELECT id, firma_cancel FROM cancelaciones WHERE receta_id=%s LIMIT 1",
        (receta_id,),
    )
    row = cur.fetchone()
    if not row:
        cur.execute("SELECT id, firma_cancel FROM cancelaciones ORDER BY id DESC LIMIT 1")
        row = cur.fetchone()
        if not row:
            print("  [cancelaciones] tabla vacía — skip")
            return
    can_id, firma_orig = row
    firma_new = _flip_last_char(firma_orig)

    backup.append({
        "table": "cancelaciones",
        "where": {"id": can_id},
        "originals": {"firma_cancel": firma_orig},
        "tamper": "flip último char de firma_cancel",
        "expected_fail": "Verificación de S_cancel falla; estado 'cancelada' no podrá probarse criptográficamente",
    })
    if not dry:
        cur.execute(
            "UPDATE cancelaciones SET firma_cancel=%s WHERE id=%s",
            (firma_new, can_id),
        )
    print(f"  [cancelaciones#{can_id}] firma_cancel alterada")


def _tamper_certificados(cur, backup: list, dry: bool) -> None:
    cur.execute(
        "SELECT id, serial_hex FROM certificados WHERE revocado=0 ORDER BY id DESC LIMIT 1"
    )
    row = cur.fetchone()
    if not row:
        print("  [certificados] no hay certificados activos — skip")
        return
    cert_id, serial_orig = row
    # Cambia un dígito hex del serial. Si era '0', a 'f'; si no, decrementa hex.
    pivot = serial_orig[-1]
    new_char = "f" if pivot == "0" else format((int(pivot, 16) - 1) % 16, "x")
    serial_new = serial_orig[:-1] + new_char

    backup.append({
        "table": "certificados",
        "where": {"id": cert_id},
        "originals": {"serial_hex": serial_orig},
        "tamper": "cambiar último dígito hex del serial",
        "expected_fail": "Validación contra el serial emitido por la CA falla / cert se ve como impostor",
    })
    if not dry:
        cur.execute(
            "UPDATE certificados SET serial_hex=%s WHERE id=%s",
            (serial_new, cert_id),
        )
    print(f"  [certificados#{cert_id}] serial_hex alterado ({serial_orig} → {serial_new})")


def _tamper_solicitudes(cur, backup: list, dry: bool) -> None:
    cur.execute(
        "SELECT id, estado FROM solicitudes_certificado ORDER BY id DESC LIMIT 1"
    )
    row = cur.fetchone()
    if not row:
        print("  [solicitudes_certificado] tabla vacía — skip")
        return
    sol_id, estado_orig = row
    # Si está aprobada/suspendida/rechazada, mandarla a pendiente.
    estado_new = "pendiente" if estado_orig != "pendiente" else "suspendida"

    backup.append({
        "table": "solicitudes_certificado",
        "where": {"id": sol_id},
        "originals": {"estado": estado_orig},
        "tamper": f"estado: {estado_orig} → {estado_new}",
        "expected_fail": "Panel admin muestra solicitud en estado incorrecto",
    })
    if not dry:
        cur.execute(
            "UPDATE solicitudes_certificado SET estado=%s WHERE id=%s",
            (estado_new, sol_id),
        )
    print(f"  [solicitudes_certificado#{sol_id}] estado: {estado_orig} → {estado_new}")


def _tamper_usuarios(cur, backup: list, dry: bool) -> None:
    # Solo tocamos `nombre` — visible en el frontend pero SIN romper crypto.
    # (Tamperear pub_ec_pem rompería TODAS las recetas firmadas por ese usuario,
    # no solo la target. Quirúrgico > espectacular.)
    cur.execute(
        "SELECT id, username, nombre FROM usuarios "
        "WHERE rol!='admin' ORDER BY id DESC LIMIT 1"
    )
    row = cur.fetchone()
    if not row:
        print("  [usuarios] no hay usuarios no-admin — skip")
        return
    user_id, username, nombre_orig = row
    nombre_new = "TAMPERED_DEMO_NAME"

    backup.append({
        "table": "usuarios",
        "where": {"id": user_id},
        "originals": {"nombre": nombre_orig},
        "tamper": f"nombre: '{nombre_orig}' → '{nombre_new}'",
        "expected_fail": f"En la UI el usuario '{username}' aparece con nombre cambiado",
    })
    if not dry:
        cur.execute(
            "UPDATE usuarios SET nombre=%s WHERE id=%s",
            (nombre_new, user_id),
        )
    print(f"  [usuarios#{user_id}] nombre alterado (usuario={username})")


def _tamper_audit(cur, backup: list, dry: bool) -> None:
    cur.execute(
        "SELECT id, accion, resultado FROM audit_logs ORDER BY id DESC LIMIT 1"
    )
    row = cur.fetchone()
    if not row:
        print("  [audit_logs] tabla vacía — skip")
        return
    aud_id, accion_orig, resultado_orig = row
    resultado_new = "rechazado" if resultado_orig == "ok" else "ok"
    accion_new = "TAMPERED_DEMO"

    backup.append({
        "table": "audit_logs",
        "where": {"id": aud_id},
        "originals": {"accion": accion_orig, "resultado": resultado_orig},
        "tamper": f"accion → 'TAMPERED_DEMO'; resultado: {resultado_orig} → {resultado_new}",
        "expected_fail": "Panel admin muestra acción/resultado distinto al real",
    })
    if not dry:
        cur.execute(
            "UPDATE audit_logs SET accion=%s, resultado=%s WHERE id=%s",
            (accion_new, resultado_new, aud_id),
        )
    print(f"  [audit_logs#{aud_id}] accion+resultado alterados")


# ───────────── main ─────────────
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--receta",
        type=int,
        default=None,
        help="ID de receta a tamperear (default: la más reciente)",
    )
    ap.add_argument("--dry-run", action="store_true", help="No escribe, solo muestra")
    ap.add_argument("--force", action="store_true", help="Sobreescribe backup existente")
    args = ap.parse_args()

    if os.path.exists(BACKUP_PATH) and not args.force and not args.dry_run:
        print(
            f"✘ Ya existe un backup en {BACKUP_PATH}. Corré restore_demo.py "
            "primero o pasá --force.",
            file=sys.stderr,
        )
        return 1

    conn = _connect()
    backup: list = []
    print(f"→ Conectado a {conn.host}:{conn.port}/{conn.db.decode() if isinstance(conn.db, bytes) else conn.db}")
    print(f"→ Modo: {'DRY-RUN' if args.dry_run else 'TAMPER'}")
    print()

    try:
        with conn.cursor() as cur:
            receta_id = _pick_target_receta(cur, args.receta)
            if receta_id is None:
                print("✘ No hay recetas en la BD — nada que tamperear.", file=sys.stderr)
                return 1
            print(f"→ Target receta_id = {receta_id}")
            print()

            print("· recetas")
            _tamper_recetas(cur, receta_id, backup, args.dry_run)
            print("· receta_acceso_farmacias")
            _tamper_receta_acceso(cur, receta_id, backup, args.dry_run)
            print("· eventos_dispensacion")
            _tamper_eventos(cur, receta_id, backup, args.dry_run)
            print("· cancelaciones")
            _tamper_cancelaciones(cur, receta_id, backup, args.dry_run)
            print("· certificados")
            _tamper_certificados(cur, backup, args.dry_run)
            print("· solicitudes_certificado")
            _tamper_solicitudes(cur, backup, args.dry_run)
            print("· usuarios")
            _tamper_usuarios(cur, backup, args.dry_run)
            print("· audit_logs")
            _tamper_audit(cur, backup, args.dry_run)

        if args.dry_run:
            conn.rollback()
            print("\n(dry-run — no se escribió nada)")
        else:
            conn.commit()
            payload = {
                "created_at": datetime.utcnow().isoformat() + "Z",
                "target_receta_id": receta_id,
                "entries": backup,
            }
            with open(BACKUP_PATH, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2, ensure_ascii=False)
            print(f"\n✔ Tampering aplicado. Backup en {BACKUP_PATH}")
            print(f"  Ahora abrí la receta {receta_id} en el frontend y mirá los errores.")
    except Exception as e:
        conn.rollback()
        print(f"✘ Error: {e}", file=sys.stderr)
        return 2
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
