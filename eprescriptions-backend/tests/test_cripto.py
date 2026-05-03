"""Tests de las primitivas y del esquema híbrido — caminos POSITIVOS y NEGATIVOS.

En cripto el camino feliz no demuestra nada: hay que demostrar que los caminos
malos FALLAN como deben. Estos tests cubren los modos de fallo principales:

  • ECDSA       — firma con clave A, verificación con clave B → falla
                  mensaje alterado tras firmar               → falla
                  firma alterada                             → falla
  • AES-GCM     — TAG manipulado     → InvalidTag
                  ciphertext alterado → InvalidTag
                  AAD alterado        → InvalidTag
                  IV cambiado         → InvalidTag
                  clave equivocada    → InvalidTag
  • RSA-OAEP    — descifrar con priv distinta → falla
                  ciphertext alterado          → falla

Uso:  python tests/test_cripto.py
      (silencia el logger:  CRYPTO_LOG=0 python tests/test_cripto.py )
"""
from __future__ import annotations

import os
import sys
import traceback
from pathlib import Path

# Añadir backend al path. El logger es ruidoso; lo silencio por defecto en tests.
os.environ.setdefault("CRYPTO_LOG", "0")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Importamos de forma "directa" para evitar __init__ con argon2 si no está.
import importlib.util
import types

CRYPTO_DIR = Path(__file__).resolve().parent.parent / "services" / "crypto"


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


# Stub del paquete cpkg para que los imports relativos `from .crypto_log` funcionen.
clog = _load("crypto_log", CRYPTO_DIR / "crypto_log.py")
fake = types.ModuleType("cpkg")
fake.__path__ = [str(CRYPTO_DIR)]
sys.modules["cpkg"] = fake
sys.modules["cpkg.crypto_log"] = clog

aes = _load("cpkg.aes_gcm", CRYPTO_DIR / "aes_gcm.py")
sig = _load("cpkg.signatures", CRYPTO_DIR / "signatures.py")
rsa = _load("cpkg.rsa_oaep", CRYPTO_DIR / "rsa_oaep.py")
keys = _load("cpkg.keys", CRYPTO_DIR / "keys.py")
canonical = _load("cpkg.canonical", CRYPTO_DIR / "canonical.py")


# ─────────────────────────────────────────────────────────────────────
#  Mini-runner de tests — colorea y resume
# ─────────────────────────────────────────────────────────────────────
GREEN = "\033[32m"
RED = "\033[31m"
BOLD = "\033[1m"
RESET = "\033[0m"

_PASS = []
_FAIL = []


def test(label):
    def deco(fn):
        try:
            fn()
            print(f"  {GREEN}✓{RESET} {label}")
            _PASS.append(label)
        except Exception as e:
            print(f"  {RED}✗ {label}{RESET}")
            print(f"    {RED}{e.__class__.__name__}: {e}{RESET}")
            traceback.print_exc(limit=2)
            _FAIL.append(label)
        return fn
    return deco


# ═════════════════════════════════════════════════════════════════════
#  ECDSA P-256 + SHA3-256
# ═════════════════════════════════════════════════════════════════════
print(f"\n{BOLD}── ECDSA P-256 + SHA3-256 ──{RESET}")

par_a = keys.generar_par_ecdsa()
par_b = keys.generar_par_ecdsa()
MSG = b'{"id_receta":1,"medicamento":"paracetamol"}'


@test("firma A → verifica con pub A (camino feliz)")
def _():
    s = sig.ecdsa_sign(par_a.priv_pem, MSG)
    assert sig.ecdsa_verify(par_a.pub_pem, MSG, s) is True


@test("firma A → verifica con pub B → DEBE FALLAR (clave cruzada)")
def _():
    s = sig.ecdsa_sign(par_a.priv_pem, MSG)
    assert sig.ecdsa_verify(par_b.pub_pem, MSG, s) is False


@test("mensaje alterado tras firmar → DEBE FALLAR")
def _():
    s = sig.ecdsa_sign(par_a.priv_pem, MSG)
    assert sig.ecdsa_verify(par_a.pub_pem, MSG + b"x", s) is False


@test("firma corrupta (un bit flip en base64) → DEBE FALLAR")
def _():
    import base64
    s = sig.ecdsa_sign(par_a.priv_pem, MSG)
    raw = bytearray(base64.b64decode(s))
    raw[0] ^= 0x01
    s_bad = base64.b64encode(bytes(raw)).decode()
    assert sig.ecdsa_verify(par_a.pub_pem, MSG, s_bad) is False


@test("firma vacía / mal formada → DEBE FALLAR sin lanzar excepción")
def _():
    assert sig.ecdsa_verify(par_a.pub_pem, MSG, "") is False
    assert sig.ecdsa_verify(par_a.pub_pem, MSG, "not-base64!!") is False


# ═════════════════════════════════════════════════════════════════════
#  AES-128-GCM
# ═════════════════════════════════════════════════════════════════════
print(f"\n{BOLD}── AES-128-GCM (clave 128 bits, TAG 128 bits) ──{RESET}")

PT = b"cuerpo R serializado: medicamento=paracetamol, cantidad=20"
AAD = b'{"id_receta":1,"id_doctor":7,"version":"1"}'


@test("DEK efímera mide 16 bytes (= 128 bits)")
def _():
    assert len(aes.new_dek()) == 16


@test("IV mide 12 bytes (= 96 bits, tamaño nativo de GCM)")
def _():
    assert len(aes.new_iv()) == 12


@test("encrypt → decrypt roundtrip (camino feliz)")
def _():
    dek, iv = aes.new_dek(), aes.new_iv()
    ct, tag = aes.aes_gcm_encrypt(dek, iv, PT, AAD)
    assert len(tag) == 16  # 128 bits
    assert aes.aes_gcm_decrypt(dek, iv, ct, tag, AAD) == PT


@test("clave de 32 bytes → DEBE LANZAR ValueError (forzamos AES-128)")
def _():
    try:
        aes.aes_gcm_encrypt(b"\x00" * 32, aes.new_iv(), PT, AAD)
    except ValueError:
        return
    raise AssertionError("debió rechazar clave de 256 bits")


@test("TAG manipulado → DEBE FALLAR (InvalidTag)")
def _():
    from cryptography.exceptions import InvalidTag
    dek, iv = aes.new_dek(), aes.new_iv()
    ct, tag = aes.aes_gcm_encrypt(dek, iv, PT, AAD)
    tag_bad = bytearray(tag); tag_bad[0] ^= 0x01
    try:
        aes.aes_gcm_decrypt(dek, iv, ct, bytes(tag_bad), AAD)
    except (InvalidTag, Exception):
        return
    raise AssertionError("debió detectar TAG alterado")


@test("ciphertext alterado (1 bit) → DEBE FALLAR")
def _():
    from cryptography.exceptions import InvalidTag
    dek, iv = aes.new_dek(), aes.new_iv()
    ct, tag = aes.aes_gcm_encrypt(dek, iv, PT, AAD)
    ct_bad = bytearray(ct); ct_bad[5] ^= 0x80
    try:
        aes.aes_gcm_decrypt(dek, iv, bytes(ct_bad), tag, AAD)
    except (InvalidTag, Exception):
        return
    raise AssertionError("debió detectar ciphertext alterado")


@test("AAD alterado → DEBE FALLAR (TAG vincula AAD al cuerpo)")
def _():
    from cryptography.exceptions import InvalidTag
    dek, iv = aes.new_dek(), aes.new_iv()
    ct, tag = aes.aes_gcm_encrypt(dek, iv, PT, AAD)
    aad_bad = AAD.replace(b'"id_receta":1', b'"id_receta":2')
    try:
        aes.aes_gcm_decrypt(dek, iv, ct, tag, aad_bad)
    except (InvalidTag, Exception):
        return
    raise AssertionError("debió detectar AAD alterado")


@test("IV cambiado → DEBE FALLAR")
def _():
    from cryptography.exceptions import InvalidTag
    dek, iv = aes.new_dek(), aes.new_iv()
    ct, tag = aes.aes_gcm_encrypt(dek, iv, PT, AAD)
    iv_bad = bytes(b ^ 0x01 for b in iv)
    try:
        aes.aes_gcm_decrypt(dek, iv_bad, ct, tag, AAD)
    except (InvalidTag, Exception):
        return
    raise AssertionError("debió detectar IV distinto")


@test("DEK distinta → DEBE FALLAR")
def _():
    from cryptography.exceptions import InvalidTag
    dek, iv = aes.new_dek(), aes.new_iv()
    ct, tag = aes.aes_gcm_encrypt(dek, iv, PT, AAD)
    try:
        aes.aes_gcm_decrypt(aes.new_dek(), iv, ct, tag, AAD)
    except (InvalidTag, Exception):
        return
    raise AssertionError("debió fallar con DEK distinta")


# ═════════════════════════════════════════════════════════════════════
#  RSA-OAEP-SHA256 (envoltura de DEK)
# ═════════════════════════════════════════════════════════════════════
print(f"\n{BOLD}── RSA-OAEP-SHA256 / MGF1-SHA256 ──{RESET}")

par_rsa_pac = keys.generar_par_rsa()
par_rsa_otro = keys.generar_par_rsa()


@test("wrap → unwrap roundtrip (camino feliz)")
def _():
    dek = aes.new_dek()
    cw = rsa.rsa_oaep_encrypt(par_rsa_pac.pub_pem, dek)
    assert rsa.rsa_oaep_decrypt(par_rsa_pac.priv_pem, cw) == dek


@test("unwrap con priv distinta → DEBE FALLAR")
def _():
    dek = aes.new_dek()
    cw = rsa.rsa_oaep_encrypt(par_rsa_pac.pub_pem, dek)
    try:
        rsa.rsa_oaep_decrypt(par_rsa_otro.priv_pem, cw)
    except Exception:
        return
    raise AssertionError("debió fallar con priv distinta (OAEP es CCA-seguro)")


@test("ciphertext del wrap alterado → DEBE FALLAR")
def _():
    dek = aes.new_dek()
    cw = rsa.rsa_oaep_encrypt(par_rsa_pac.pub_pem, dek)
    cw_bad = bytearray(cw); cw_bad[0] ^= 0x01
    try:
        rsa.rsa_oaep_decrypt(par_rsa_pac.priv_pem, bytes(cw_bad))
    except Exception:
        return
    raise AssertionError("debió rechazar wrap alterado")


# ═════════════════════════════════════════════════════════════════════
#  Esquema HÍBRIDO completo (lo que hace el sistema en §4 + §5/§6)
# ═════════════════════════════════════════════════════════════════════
print(f"\n{BOLD}── Esquema híbrido (firma + cifrado + envoltura) ──{RESET}")


def emitir(R, AAD, par_ec_doc, pub_rsa_destinatario):
    """Reproduce §4 — emisión completa."""
    S_D = sig.ecdsa_sign(par_ec_doc.priv_pem, R)
    dek = aes.new_dek()
    iv = aes.new_iv()
    ct, tag = aes.aes_gcm_encrypt(dek, iv, R, AAD)
    c_wrap = rsa.rsa_oaep_encrypt(pub_rsa_destinatario, dek)
    return {"S_D": S_D, "ct": ct, "tag": tag, "iv": iv, "aad": AAD, "c_wrap": c_wrap}


def consumir(env, par_ec_doc, par_rsa_destinatario):
    """Reproduce §5 — descifrar + verificar."""
    dek = rsa.rsa_oaep_decrypt(par_rsa_destinatario.priv_pem, env["c_wrap"])
    R = aes.aes_gcm_decrypt(dek, env["iv"], env["ct"], env["tag"], env["aad"])
    ok = sig.ecdsa_verify(par_ec_doc.pub_pem, R, env["S_D"])
    return R, ok


R = canonical.canonical_bytes({
    "id_receta": 42, "id_doctor": 7, "id_paciente": 13,
    "medicamento": "paracetamol", "dosis": "500mg", "cantidad": 20,
    "indicaciones": "cada 8h", "fecha_creacion": "2026-04-27",
    "dispensaciones_permitidas": 3, "intervalo_dias": 30, "parent_id": None,
})
AAD = canonical.canonical_bytes({
    "id_receta": 42, "id_doctor": 7, "id_paciente": 13,
    "fecha_creacion": "2026-04-27", "dispensaciones_permitidas": 3,
    "version": "1",
})
par_doc = keys.generar_par_ecdsa()
par_pac = keys.generar_par_rsa()


@test("emisión + consulta del paciente: TODO verifica")
def _():
    env = emitir(R, AAD, par_doc, par_pac.pub_pem)
    R_back, ok = consumir(env, par_doc, par_pac)
    assert R_back == R
    assert ok is True


@test("paciente equivocado (otra priv RSA) → wrap no abre")
def _():
    env = emitir(R, AAD, par_doc, par_pac.pub_pem)
    par_otro = keys.generar_par_rsa()
    try:
        consumir(env, par_doc, par_otro)
    except Exception:
        return
    raise AssertionError("la receta NO debía abrirse para otro paciente")


@test("médico suplantado (otra pub EC) → firma no verifica")
def _():
    env = emitir(R, AAD, par_doc, par_pac.pub_pem)
    par_falso = keys.generar_par_ecdsa()
    R_back, ok = consumir(env, par_falso, par_pac)
    assert R_back == R           # los bytes vuelven, pero...
    assert ok is False           # ...la firma denuncia la suplantación


@test("atacante cambia AAD para 'mover' la receta → TAG falla")
def _():
    env = emitir(R, AAD, par_doc, par_pac.pub_pem)
    AAD_falsificado = canonical.canonical_bytes({
        "id_receta": 999,        # ← intenta hacer pasar la receta por otra
        "id_doctor": 7, "id_paciente": 13,
        "fecha_creacion": "2026-04-27", "dispensaciones_permitidas": 3,
        "version": "1",
    })
    env_malo = dict(env, aad=AAD_falsificado)
    try:
        consumir(env_malo, par_doc, par_pac)
    except Exception:
        return
    raise AssertionError("debió fallar el TAG con AAD alterado")


# ═════════════════════════════════════════════════════════════════════
#  Resumen
# ═════════════════════════════════════════════════════════════════════
total = len(_PASS) + len(_FAIL)
print(f"\n{BOLD}══════════════════════════════════════════════════════════════════{RESET}")
print(f"  {BOLD}Resultado:{RESET}  "
      f"{GREEN}{len(_PASS)} OK{RESET}   "
      f"{RED}{len(_FAIL)} FAIL{RESET}   "
      f"de {total} tests")
print(f"{BOLD}══════════════════════════════════════════════════════════════════{RESET}\n")

sys.exit(0 if not _FAIL else 1)
