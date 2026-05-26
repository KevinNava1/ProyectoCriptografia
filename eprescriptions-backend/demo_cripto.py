#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║          SecureRx — Demo Criptográfico en Vivo  (Presentación)             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Muestra el flujo completo de una receta electrónica segura:               ║
║  creación, cifrado híbrido, firma ECDSA, verificación y ataques.           ║
║                                                                              ║
║  Uso (dentro del contenedor):                                               ║
║      docker compose exec api python demo_cripto.py                          ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import sys
from datetime import datetime, timezone

# ── colores ANSI ───────────────────────────────────────────────────────────────
R  = "\033[0m"          # reset
B  = "\033[1m"          # bold
CY = "\033[96m"         # cyan
GR = "\033[92m"         # verde
YE = "\033[93m"         # amarillo
RE = "\033[91m"         # rojo
BL = "\033[94m"         # azul
MA = "\033[95m"         # magenta
DIM = "\033[2m"         # tenue

PASO = 0

def banner():
    print(f"""
{BL}{B}╔══════════════════════════════════════════════════════════════════════╗
║      SecureRx  ·  Demo Criptográfico en Vivo                        ║
║      Flujo completo: Receta → Cifrado → Firma → Ataques             ║
╚══════════════════════════════════════════════════════════════════════╝{R}
""")

def titulo(n: int, texto: str):
    global PASO
    PASO = n
    linea = "═" * (len(texto) + 4)
    print(f"\n{CY}{B}╔{linea}╗")
    print(f"║  PASO {n}: {texto}  ║")
    print(f"╚{linea}╝{R}\n")

def ok(msg: str):
    print(f"  {GR}{B}✔  {R}{msg}")

def err(msg: str):
    print(f"  {RE}{B}✘  {R}{msg}")

def info(msg: str):
    print(f"  {BL}▸  {R}{msg}")

def detalle(label: str, valor: str):
    print(f"  {DIM}{label:<22}{R} {YE}{valor}{R}")

def advertencia(msg: str):
    print(f"\n  {YE}{B}⚠  {msg}{R}")

def seccion(titulo_: str):
    print(f"\n  {MA}{B}── {titulo_} ──{R}")

def enter(msg: str = "Presiona Enter para continuar…"):
    print(f"\n{DIM}  {'─'*60}")
    input(f"  {B}↵  {msg}{R}  ")
    print()

def hex_preview(b: bytes, n: int = 24) -> str:
    h = b.hex()
    return h[:n*2] + f"{DIM}…({len(b)} bytes){R}" if len(b) > n else h

def b64_preview(s: str, n: int = 32) -> str:
    return s[:n] + f"{DIM}…{R}" if len(s) > n else s


# ══════════════════════════════════════════════════════════════════════
#  CARGA DE SERVICIOS CRIPTO Y BD
# ══════════════════════════════════════════════════════════════════════
def cargar_dependencias():
    sys.path.insert(0, "/app")
    os.environ.setdefault("DB_HOST", "db")

    from database import SessionLocal, Usuario, Receta, RecetaAccesoFarmacia, init_schema
    from services.crypto import (
        ecdsa_sign, ecdsa_verify,
        aes_gcm_encrypt, aes_gcm_decrypt,
        rsa_oaep_encrypt, rsa_oaep_decrypt,
        new_dek, new_iv,
        parse_pem_bundle,
    )
    from services.canonical_receta import build_R, build_AAD, sha3_hex
    from services.crypto.keys import _priv_to_pem as priv_to_pem_str

    return {
        "SessionLocal": SessionLocal,
        "Usuario": Usuario,
        "Receta": Receta,
        "RecetaAccesoFarmacia": RecetaAccesoFarmacia,
        "init_schema": init_schema,
        "ecdsa_sign": ecdsa_sign,
        "ecdsa_verify": ecdsa_verify,
        "aes_gcm_encrypt": aes_gcm_encrypt,
        "aes_gcm_decrypt": aes_gcm_decrypt,
        "rsa_oaep_encrypt": rsa_oaep_encrypt,
        "rsa_oaep_decrypt": rsa_oaep_decrypt,
        "new_dek": new_dek,
        "new_iv": new_iv,
        "parse_pem_bundle": parse_pem_bundle,
        "build_R": build_R,
        "build_AAD": build_AAD,
        "sha3_hex": sha3_hex,
        "priv_to_pem_str": priv_to_pem_str,
    }


def leer_bundle(username: str) -> str:
    ruta = f"/app/_test_users_out/{username}.pem"
    with open(ruta) as f:
        return f.read()


# ══════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════
def main():
    banner()
    enter("Iniciando demo… (Enter para comenzar)")

    # ── cargar módulos ────────────────────────────────────────────────
    info("Cargando servicios criptográficos…")
    dep = cargar_dependencias()
    ok("Servicios cargados")

    db = dep["SessionLocal"]()
    ecdsa_sign      = dep["ecdsa_sign"]
    ecdsa_verify    = dep["ecdsa_verify"]
    aes_gcm_encrypt = dep["aes_gcm_encrypt"]
    aes_gcm_decrypt = dep["aes_gcm_decrypt"]
    rsa_oaep_encrypt = dep["rsa_oaep_encrypt"]
    rsa_oaep_decrypt = dep["rsa_oaep_decrypt"]
    new_dek         = dep["new_dek"]
    new_iv          = dep["new_iv"]
    parse_pem_bundle = dep["parse_pem_bundle"]
    build_R         = dep["build_R"]
    build_AAD       = dep["build_AAD"]
    sha3_hex        = dep["sha3_hex"]
    priv_to_pem_str = dep["priv_to_pem_str"]
    Receta          = dep["Receta"]
    RecetaAccesoFarmacia = dep["RecetaAccesoFarmacia"]
    Usuario         = dep["Usuario"]

    DEMO_RECETA_ID = None  # se asigna al crear

    try:
        # ══════════════════════════════════════════════════════════════
        # PASO 1 — Actores y llaves
        # ══════════════════════════════════════════════════════════════
        titulo(1, "Actores del sistema y sus llaves")

        medico    = db.query(Usuario).filter_by(username="dr.lopez").first()
        paciente  = db.query(Usuario).filter_by(username="juan.perez").first()
        farmacias = db.query(Usuario).filter_by(rol="farmaceutico").all()

        info(f"Médico     → {B}{medico.nombre}{R}  (id={medico.id})")
        detalle("Pub EC (firma):",  medico.pub_ec_pem.strip().splitlines()[1][:48] + "…")
        detalle("Pub RSA (cifrado):", medico.pub_rsa_pem.strip().splitlines()[1][:48] + "…")

        print()
        info(f"Paciente   → {B}{paciente.nombre}{R}  (id={paciente.id})")
        detalle("Pub EC:",  paciente.pub_ec_pem.strip().splitlines()[1][:48] + "…")
        detalle("Pub RSA:", paciente.pub_rsa_pem.strip().splitlines()[1][:48] + "…")

        print()
        for f in farmacias:
            info(f"Farmacia   → {B}{f.nombre}{R}  (id={f.id})")
            detalle("Pub RSA:", f.pub_rsa_pem.strip().splitlines()[1][:48] + "…")

        advertencia("Las llaves PRIVADAS nunca llegan al servidor. Solo se usan en el cliente.")

        enter()

        # ══════════════════════════════════════════════════════════════
        # PASO 2 — Construcción del R canónico (§4.1)
        # ══════════════════════════════════════════════════════════════
        titulo(2, "JSON Canónico R  (§4.1 de la especificación)")

        MEDICAMENTO     = "Amoxicilina 500mg"
        DOSIS           = "1 cápsula cada 8 horas"
        CANTIDAD        = 21
        INDICACIONES    = "Tomar con alimentos. Completar el tratamiento."
        FECHA_CREACION  = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        DISP_PERMITIDAS = 2
        ID_RECETA_DEMO  = 9999  # ID temporal para construir R

        r_bytes = build_R(
            id_receta=ID_RECETA_DEMO,
            id_doctor=medico.id,
            id_paciente=paciente.id,
            medicamento=MEDICAMENTO,
            dosis=DOSIS,
            cantidad=CANTIDAD,
            indicaciones=INDICACIONES,
            fecha_creacion=FECHA_CREACION,
            dispensaciones_permitidas=DISP_PERMITIDAS,
            intervalo_dias=None,
            parent_id=None,
        )

        r_dict = json.loads(r_bytes.decode())
        print(f"  {GR}R canónico (bytes ordenados, sin espacios):{R}")
        print(f"\n  {YE}{json.dumps(r_dict, indent=4, ensure_ascii=False)}{R}\n")

        detalle("Tamaño R:", f"{len(r_bytes)} bytes")
        info("Las claves están ordenadas alfabéticamente → mismo blob en cualquier implementación.")
        info("Un solo campo diferente → bytes completamente distintos → firma inválida.")

        enter()

        # ══════════════════════════════════════════════════════════════
        # PASO 3 — SHA3-256 de R
        # ══════════════════════════════════════════════════════════════
        titulo(3, "Huella SHA3-256 del R canónico")

        hash_r = sha3_hex(r_bytes)
        info("SHA3-256 es resistente a preimagen y a colisiones.")
        info("Cambiar 1 bit del R produce una huella completamente distinta (efecto avalancha).")
        print()
        detalle("SHA3-256(R):", hash_r)

        seccion("Demostración del efecto avalancha")
        r_modificado = r_bytes[:-1] + bytes([r_bytes[-1] ^ 0x01])  # flip del último bit
        hash_mod = sha3_hex(r_modificado)
        detalle("SHA3-256(R original):  ", hash_r)
        detalle("SHA3-256(R + 1 bit):   ", hash_mod)
        bits_distintos = bin(int(hash_r, 16) ^ int(hash_mod, 16)).count("1")
        ok(f"Bits diferentes en el hash: {bits_distintos} / 256  → efecto avalancha confirmado")

        enter()

        # ══════════════════════════════════════════════════════════════
        # PASO 4 — Firma ECDSA P-256 + SHA3-256
        # ══════════════════════════════════════════════════════════════
        titulo(4, "Firma ECDSA  P-256 + SHA3-256  (§ECDSA_Sign)")

        bundle_medico = leer_bundle("dr.lopez")
        ec_priv_medico, _ = parse_pem_bundle(bundle_medico)
        ec_priv_medico_pem = priv_to_pem_str(ec_priv_medico)

        info(f"El médico {B}{medico.nombre}{R} firma R con su llave EC privada.")
        info("Primitiva:  ECDSA sobre la curva secp256r1 (NIST P-256), hash SHA3-256.")
        info("La firma va en DER → base64 para transporte JSON.")
        print()

        firma_doctor = ecdsa_sign(ec_priv_medico_pem, r_bytes)

        sig_bytes = base64.b64decode(firma_doctor)
        detalle("Algoritmo:", "ECDSA P-256 / SHA3-256")
        detalle("Formato:",   "DER (ASN.1) → Base64")
        detalle("Tamaño:",    f"{len(sig_bytes)} bytes  (~64 bytes en P-256)")
        detalle("Firma (b64):", b64_preview(firma_doctor, 48))
        detalle("Firma (hex):", hex_preview(sig_bytes, 20))

        seccion("Verificación con la llave pública del médico")
        ok_firma = ecdsa_verify(medico.pub_ec_pem, r_bytes, firma_doctor)
        ok(f"Verificación con pub_ec de {medico.nombre}: {GR}VÁLIDA{R}") if ok_firma else err("INVÁLIDA")

        enter()

        # ══════════════════════════════════════════════════════════════
        # PASO 5 — DEK + IV + AES-128-GCM
        # ══════════════════════════════════════════════════════════════
        titulo(5, "Cifrado simétrico  AES-128-GCM  (§AES_GCM_Enc)")

        dek = new_dek()
        iv  = new_iv()

        aad_bytes = build_AAD(
            id_receta=ID_RECETA_DEMO,
            id_doctor=medico.id,
            id_paciente=paciente.id,
            fecha_creacion=FECHA_CREACION,
            dispensaciones_permitidas=DISP_PERMITIDAS,
        )

        info("Se genera una DEK (clave simétrica) aleatoria de 128 bits — solo para esta receta.")
        info("Se genera un IV aleatorio de 96 bits — único para este cifrado.")
        info("El AAD (datos autenticados, NO cifrados) incluye metadatos de la receta.")
        print()
        detalle("DEK (128 bits):", hex_preview(dek, 4) + f"  {DIM}[resto oculto]{R}")
        detalle("IV  (96 bits):", hex_preview(iv))
        detalle("AAD:", json.dumps(json.loads(aad_bytes.decode()), ensure_ascii=False)[:80] + "…")
        print()

        ciphertext, tag = aes_gcm_encrypt(dek, iv, r_bytes, aad_bytes)

        info(f"Se cifra R ({len(r_bytes)} bytes) → ciphertext + TAG de integridad.")
        detalle("Ciphertext:", hex_preview(ciphertext, 20))
        detalle("TAG (128 bits):", ciphertext.hex()[:4] + "…  " + tag.hex())
        detalle("Tamaño ciphertext:", f"{len(ciphertext)} bytes  (igual que plaintext — GCM no expande)")

        seccion("¿Por qué AES-128-GCM y no solo AES-CTR?")
        info("CTR cifra pero NO autentica → un atacante puede voltear bits sin que se note.")
        info("GCM = CTR + GHASH (MAC criptográfico) → cualquier alteración → TAG inválido.")

        enter()

        # ══════════════════════════════════════════════════════════════
        # PASO 6 — Envoltura RSA-OAEP (cifrado híbrido)
        # ══════════════════════════════════════════════════════════════
        titulo(6, "Envoltura RSA-OAEP  (cifrado híbrido §4.3)")

        info("La DEK NO se guarda en claro. Se cifra con la pub RSA de cada destinatario.")
        info("Ventaja: el cuerpo de la receta se cifra UNA sola vez (AES, rápido).")
        info("Solo los wraps de la DEK se multiplican por destinatario (RSA, pequeños).")
        print()

        c_wrap_pac = rsa_oaep_encrypt(paciente.pub_rsa_pem, dek)
        detalle("Wrap DEK → paciente:", hex_preview(c_wrap_pac, 16))

        c_wraps_far = []
        for far in farmacias:
            c_wrap = rsa_oaep_encrypt(far.pub_rsa_pem, dek)
            c_wraps_far.append((far.id, c_wrap))
            detalle(f"Wrap DEK → {far.nombre[:20]}:", hex_preview(c_wrap, 16))

        print()
        detalle("Tamaño de un wrap RSA-OAEP:", f"{len(c_wrap_pac)} bytes")
        detalle("Cuerpo cifrado (compartido):", f"{len(ciphertext)} bytes  ← solo uno para todos")
        info("RSA-OAEP-SHA256: relleno probabilístico — cada vez produce un wrap distinto.")

        enter()

        # ══════════════════════════════════════════════════════════════
        # PASO 7 — Guardado en BD
        # ══════════════════════════════════════════════════════════════
        titulo(7, "¿Qué se guarda en la base de datos?")

        seccion("SE GUARDA (datos criptográficos)")
        info(f"{GR}ciphertext{R}      — R cifrado con AES-128-GCM")
        info(f"{GR}tag_aes{R}         — TAG de integridad (16 bytes)")
        info(f"{GR}iv_aes{R}          — Vector de inicialización (12 bytes)")
        info(f"{GR}aad{R}             — Metadatos autenticados (en claro)")
        info(f"{GR}firma_doctor{R}    — Firma ECDSA del médico sobre R")
        info(f"{GR}c_wrap_pac{R}      — DEK envuelta con pub RSA del paciente")
        info(f"{GR}c_wrap_far[]{R}    — DEK envuelta con pub RSA de cada farmacia")
        info(f"{GR}hash_sha3_hex{R}   — Huella SHA3-256 del R canónico")

        seccion(f"{RE}JAMÁS SE GUARDA{R}")
        err(f"Llave EC privada del médico  (solo en su dispositivo / .pem)")
        err(f"Llave RSA privada del paciente (solo en su dispositivo / .pem)")
        err(f"La DEK en claro  (se destruye de memoria tras envolver)")
        err(f"El plaintext R   (medicamento, dosis, indicaciones)")

        print()
        info(f"Creando receta DEMO en la BD…")

        receta_demo = Receta(
            medico_id=medico.id,
            paciente_id=paciente.id,
            ciphertext=ciphertext,
            tag_aes=tag,
            iv_aes=iv,
            aad=aad_bytes,
            c_wrap_pac=c_wrap_pac,
            firma_doctor=firma_doctor,
            dispensaciones_permitidas=DISP_PERMITIDAS,
            dispensaciones_realizadas=0,
            estado="activa",
            hash_sha3_hex=sha3_hex(r_bytes),
        )
        db.add(receta_demo)
        db.flush()

        for far_id, c_wrap in c_wraps_far:
            db.add(RecetaAccesoFarmacia(
                receta_id=receta_demo.id,
                farmacia_id=far_id,
                c_wrap_far=c_wrap,
            ))

        db.commit()
        db.refresh(receta_demo)
        DEMO_RECETA_ID = receta_demo.id

        ok(f"Receta DEMO guardada  →  id={B}{DEMO_RECETA_ID}{R}")
        detalle("hash_sha3_hex en BD:", receta_demo.hash_sha3_hex[:32] + "…")
        detalle("Estado:", receta_demo.estado)

        enter()

        # ══════════════════════════════════════════════════════════════
        # PASO 8 — Verificación exitosa (flujo normal)
        # ══════════════════════════════════════════════════════════════
        titulo(8, "Verificación exitosa — Flujo normal del paciente")

        info("El paciente descifra con su llave RSA privada y verifica la firma del médico.")
        print()

        bundle_paciente = leer_bundle("juan.perez")
        _, rsa_priv_pac = parse_pem_bundle(bundle_paciente)
        rsa_priv_pac_pem = priv_to_pem_str(rsa_priv_pac)

        receta_db = db.query(Receta).filter_by(id=DEMO_RECETA_ID).first()

        seccion("1) RSA-OAEP: Desenvuelve la DEK con la llave privada RSA del paciente")
        dek_rec = rsa_oaep_decrypt(rsa_priv_pac_pem, receta_db.c_wrap_pac)
        ok(f"DEK recuperada: {dek_rec[:4].hex()}…  ({len(dek_rec)} bytes)")

        seccion("2) AES-128-GCM: Descifra el cuerpo y verifica el TAG")
        r_recuperado = aes_gcm_decrypt(
            dek_rec, receta_db.iv_aes, receta_db.ciphertext, receta_db.tag_aes, receta_db.aad
        )
        r_dict_rec = json.loads(r_recuperado.decode())
        ok("TAG de integridad verificado  →  datos no alterados")
        print()
        print(f"  {GR}Contenido descifrado:{R}")
        print(f"  {YE}{json.dumps(r_dict_rec, indent=4, ensure_ascii=False)}{R}\n")

        seccion("3) ECDSA: Verifica la firma del médico sobre el R canónico")
        firma_ok = ecdsa_verify(medico.pub_ec_pem, r_recuperado, receta_db.firma_doctor)
        ok(f"Firma ECDSA del Dr. {medico.nombre}: {GR}{B}VÁLIDA ✔{R}") if firma_ok else err("INVÁLIDA")

        enter()

        # ══════════════════════════════════════════════════════════════
        # PASO 9 — ATAQUE 1: Manipulación del ciphertext en BD
        # ══════════════════════════════════════════════════════════════
        titulo(9, f"ATAQUE 1 — Manipulación del ciphertext en BD")

        advertencia("Simulamos que un atacante con acceso a la BD modifica 1 byte del ciphertext.")
        print()

        ct_original = receta_db.ciphertext
        ct_corrupto = bytearray(ct_original)
        ct_corrupto[0] ^= 0xFF  # flip de 8 bits en el primer byte
        ct_corrupto = bytes(ct_corrupto)

        info(f"Byte original:  0x{ct_original[0]:02x}")
        info(f"Byte corrupto:  0x{ct_corrupto[0]:02x}  (XOR 0xFF)")

        receta_db.ciphertext = ct_corrupto
        db.commit()
        ok("Ciphertext modificado en BD")

        print()
        seccion("Intento de descifrado con ciphertext alterado")
        try:
            dek_rec2 = rsa_oaep_decrypt(rsa_priv_pac_pem, receta_db.c_wrap_pac)
            aes_gcm_decrypt(dek_rec2, receta_db.iv_aes, receta_db.ciphertext, receta_db.tag_aes, receta_db.aad)
            err("¡El sistema aceptó datos corrompidos! (esto NO debería ocurrir)")
        except Exception as e:
            err(f"AES-GCM rechazó los datos → {RE}{B}InvalidTag{R}")
            ok("El TAG de integridad detectó la alteración")
            ok("El atacante NO puede leer el contenido ni pasar desapercibido")

        print(f"""
  {YE}{B}  ┌─────────────────────────────────────────────────────────────┐
  │  👉  Dónde verlo en el frontend:                            │
  │                                                             │
  │  1. Inicia sesión como paciente  (juan.perez)               │
  │  2. Ve a "Mis recetas"                                      │
  │  3. Busca la Receta #{DEMO_RECETA_ID} (Amoxicilina)                   │
  │  4. Intenta ver su contenido (subir el .pem)                │
  │  → Error: INTEGRIDAD COMPROMETIDA — TAG GCM inválido        │
  └─────────────────────────────────────────────────────────────┘{R}
""")
        enter(f"↵  Muéstralo en el frontend… luego Enter para RESTAURAR")

        seccion("Restaurando ciphertext original en BD")
        receta_db.ciphertext = ct_original
        db.commit()
        ok("BD restaurada ✔  (receta legible de nuevo en el frontend)")

        enter()

        # ══════════════════════════════════════════════════════════════
        # PASO 10 — ATAQUE 2: Manipulación del AAD
        # ══════════════════════════════════════════════════════════════
        titulo(10, "ATAQUE 2 — Reasignación de receta (manipular AAD)")

        advertencia("El atacante intenta reasignar la receta a otro paciente cambiando el AAD.")
        advertencia("El AAD contiene id_paciente y viaja en claro, ¿puede cambiarse?")
        print()

        aad_original = receta_db.aad
        aad_dict = json.loads(aad_original.decode())
        info(f"AAD original:  id_paciente = {aad_dict['id_paciente']}")

        aad_dict["id_paciente"] = 9999  # paciente inexistente
        aad_falso = json.dumps(aad_dict, sort_keys=True, separators=(",", ":")).encode()

        receta_db.aad = aad_falso
        db.commit()
        ok(f"AAD modificado en BD  →  id_paciente = 9999")

        seccion("Intento de descifrado con AAD alterado")
        try:
            dek_rec3 = rsa_oaep_decrypt(rsa_priv_pac_pem, receta_db.c_wrap_pac)
            aes_gcm_decrypt(dek_rec3, receta_db.iv_aes, receta_db.ciphertext, receta_db.tag_aes, receta_db.aad)
            err("¡Aceptó el AAD falso!")
        except Exception:
            err(f"AES-GCM rechazó el AAD alterado → {RE}{B}InvalidTag{R}")
            ok("El TAG incluye el AAD en su cálculo → cualquier cambio en AAD lo invalida")
            ok("La reasignación de receta es IMPOSIBLE sin la DEK original")

        print(f"""
  {YE}{B}  ┌─────────────────────────────────────────────────────────────┐
  │  👉  Dónde verlo en el frontend:                            │
  │                                                             │
  │  1. Inicia sesión como paciente  (juan.perez)               │
  │  2. Ve a "Mis recetas"                                      │
  │  3. Busca la Receta #{DEMO_RECETA_ID} (Amoxicilina)                   │
  │  4. Intenta ver su contenido (subir el .pem)                │
  │  → Error: INTEGRIDAD COMPROMETIDA — TAG GCM inválido        │
  │    (el AAD fue alterado; el TAG ya no coincide)             │
  └─────────────────────────────────────────────────────────────┘{R}
""")
        enter(f"↵  Muéstralo en el frontend… luego Enter para RESTAURAR")

        seccion("Restaurando AAD original en BD")
        receta_db.aad = aad_original
        db.commit()
        ok("BD restaurada ✔  (receta legible de nuevo en el frontend)")

        enter()

        # ══════════════════════════════════════════════════════════════
        # PASO 11 — ATAQUE 3: Firma ECDSA corrupta en BD
        # ══════════════════════════════════════════════════════════════
        titulo(11, "ATAQUE 3 — Firma ECDSA corrupta (repudio de autoría)")

        advertencia("El atacante intenta forjar o corromper la firma del médico en BD.")
        print()

        firma_original = receta_db.firma_doctor
        sig_bytes_orig = base64.b64decode(firma_original)
        sig_corrupta = bytearray(sig_bytes_orig)
        sig_corrupta[-1] ^= 0x01  # flip del último bit
        firma_corrupta = base64.b64encode(bytes(sig_corrupta)).decode()

        receta_db.firma_doctor = firma_corrupta
        db.commit()
        ok("Firma ECDSA modificada en BD (1 bit alterado)")

        seccion("Verificación de firma con firma corrupta")
        dek_rec4 = rsa_oaep_decrypt(rsa_priv_pac_pem, receta_db.c_wrap_pac)
        r_ok = aes_gcm_decrypt(dek_rec4, receta_db.iv_aes, receta_db.ciphertext, receta_db.tag_aes, receta_db.aad)
        firma_valida = ecdsa_verify(medico.pub_ec_pem, r_ok, receta_db.firma_doctor)

        if not firma_valida:
            err(f"ECDSA rechazó la firma → {RE}{B}InvalidSignature{R}")
            ok("No repudio garantizado: solo el médico puede producir una firma válida")
            ok("Ni siquiera el servidor puede forjar una firma sin la llave privada EC del médico")
        else:
            err("¡ECDSA aceptó la firma corrupta! (esto no debería ocurrir)")

        print(f"""
  {YE}{B}  ┌─────────────────────────────────────────────────────────────┐
  │  👉  Dónde verlo en el frontend:                            │
  │                                                             │
  │  1. Inicia sesión como paciente  (juan.perez)               │
  │  2. Ve a "Mis recetas"                                      │
  │  3. Busca la Receta #{DEMO_RECETA_ID} (Amoxicilina)                   │
  │  4. Intenta ver su contenido (subir el .pem)                │
  │  → Contenido descifrado OK, pero aparece:                   │
  │    ✘  FIRMA DEL MÉDICO INVÁLIDA                             │
  │    (el TAG GCM pasa porque solo el ciphertext/AAD cambian;  │
  │     la verificación ECDSA posterior detecta la corrupción)  │
  └─────────────────────────────────────────────────────────────┘{R}
""")
        enter(f"↵  Muéstralo en el frontend… luego Enter para RESTAURAR")

        seccion("Restaurando firma original en BD")
        receta_db.firma_doctor = firma_original
        db.commit()
        ok("BD restaurada ✔  (firma válida de nuevo en el frontend)")

        enter()

        # ══════════════════════════════════════════════════════════════
        # PASO 12 — ATAQUE 4: Llave RSA incorrecta (en memoria)
        # ══════════════════════════════════════════════════════════════
        titulo(12, "ATAQUE 4 — Llave RSA incorrecta (otra farmacia intenta leer la receta)")

        advertencia("Una farmacia sin acceso intenta desenvover la DEK del paciente con su llave RSA.")
        print()

        bundle_farmacia = leer_bundle("farmacia.central")
        _, rsa_priv_far = parse_pem_bundle(bundle_farmacia)
        rsa_priv_far_pem = priv_to_pem_str(rsa_priv_far)

        info(f"Farmacia Central usa su RSA privada para intentar desenvolver c_wrap_pac del paciente.")

        seccion("Intento de RSA-OAEP decrypt con llave incorrecta")
        try:
            dek_falsa = rsa_oaep_decrypt(rsa_priv_far_pem, receta_db.c_wrap_pac)
            # Si OAEP no falla, el ciphertext seguirá siendo ilegible
            try:
                aes_gcm_decrypt(dek_falsa, receta_db.iv_aes, receta_db.ciphertext, receta_db.tag_aes, receta_db.aad)
                err("¡Consiguió descifrar!")
            except Exception:
                err(f"RSA-OAEP devolvió basura → AES-GCM rechazó → {RE}{B}InvalidTag{R}")
                ok("La receta del paciente es ilegible para la farmacia (sin su c_wrap_far)")
        except Exception:
            err(f"RSA-OAEP falló directamente → {RE}{B}ValueError / OAEP padding error{R}")
            ok("La llave equivocada no puede desenvolver la DEK")

        ok("La separación de wraps por destinatario garantiza confidencialidad individual")
        info("(Este ataque ocurre en memoria — la BD no fue modificada)")

        enter("🔍 Explica el resultado al jurado… luego Enter para continuar")

        # ══════════════════════════════════════════════════════════════
        # PASO 13 — Resumen y limpieza
        # ══════════════════════════════════════════════════════════════
        titulo(13, "Resumen de garantías criptográficas")

        print(f"""
  {CY}{B}┌─────────────────────────────────────────────────────────────┐
  │  Propiedad          Primitiva              Resultado          │
  ├─────────────────────────────────────────────────────────────┤{R}
  {GR}│  Confidencialidad   AES-128-GCM + RSA-OAEP  Solo destinatario puede leer  │{R}
  {GR}│  Integridad         AES-GCM TAG (128 bits)  Cualquier alteración → fallo  │{R}
  {GR}│  Autenticidad       ECDSA P-256 / SHA3-256  Solo el médico puede firmar   │{R}
  {GR}│  No repudio         ECDSA (llave privada)   No puede negar haber firmado  │{R}
  {GR}│  Multi-destinatario Cifrado híbrido         N wraps, 1 cuerpo cifrado     │{R}
  {CY}{B}└─────────────────────────────────────────────────────────────┘{R}
""")

        info("Eliminando receta DEMO de la BD…")
        db.query(RecetaAccesoFarmacia).filter_by(receta_id=DEMO_RECETA_ID).delete()
        db.query(Receta).filter_by(id=DEMO_RECETA_ID).delete()
        db.commit()
        ok(f"Receta DEMO (id={DEMO_RECETA_ID}) eliminada  →  BD en estado original")

        print(f"""
{BL}{B}╔══════════════════════════════════════════════════════════════════════╗
║              Demo completado exitosamente  ✔                        ║
╚══════════════════════════════════════════════════════════════════════╝{R}
""")

    except KeyboardInterrupt:
        print(f"\n\n{YE}Demo interrumpido. Limpiando BD…{R}")
        if DEMO_RECETA_ID:
            try:
                db.query(RecetaAccesoFarmacia).filter_by(receta_id=DEMO_RECETA_ID).delete()
                db.query(Receta).filter_by(id=DEMO_RECETA_ID).delete()
                db.commit()
                ok("BD restaurada")
            except Exception:
                pass
    except Exception as ex:
        print(f"\n{RE}{B}Error en paso {PASO}: {ex}{R}")
        if DEMO_RECETA_ID:
            try:
                db.query(RecetaAccesoFarmacia).filter_by(receta_id=DEMO_RECETA_ID).delete()
                db.query(Receta).filter_by(id=DEMO_RECETA_ID).delete()
                db.commit()
                print(f"  {GR}BD restaurada{R}")
            except Exception:
                pass
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
