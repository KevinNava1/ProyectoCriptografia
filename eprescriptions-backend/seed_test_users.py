"""Seed de usuarios de prueba — admin, medico, paciente, farmaceutico.

Crea cuatro cuentas YA ACTIVAS, comprimiendo en un solo paso lo que en
producción son dos: el registro §1 y la aprobación del admin §2. Por cada
usuario genera el par EC + el par RSA, hashea el password con Argon2id, emite
los dos certs X.509 con la CA interna y deja el estado en `activo` con el
email verificado.

Las llaves privadas NUNCA se guardan en BD: se escriben como .pem en OUT_DIR.

Uso (dentro del contenedor api):
    docker compose exec api python seed_test_users.py
"""
from __future__ import annotations

import os
import secrets
from datetime import datetime, timezone

from audit import registrar as audit_log
from database import Certificado, SessionLocal, SolicitudCertificado, Usuario, init_schema
from services.crypto import bundle_pem_privadas, generar_par_ecdsa, generar_par_rsa, hash_password
from services.crypto.ca import emitir_cert

OUT_DIR = os.getenv("OUT_DIR", "/app/_test_users_out")

# Password compartido para los cuatro — es un entorno de pruebas.
PASSWORD = os.getenv("SEED_PASSWORD", "SecureRx#2026")

# (rol, username, nombre, email)
USUARIOS = [
    ("admin",        "admin",            "Administrador General",  "admin@securerx.app"),
    ("medico",       "dr.lopez",         "Dr. Carlos Lopez",       "medico@securerx.app"),
    ("paciente",     "juan.perez",       "Juan Perez Garcia",      "paciente@securerx.app"),
    ("farmaceutico", "farmacia.central", "Farmacia Central",       "farmaceutico@securerx.app"),
]


def _escribir_pem(nombre: str, contenido: str) -> None:
    ruta = os.path.join(OUT_DIR, nombre)
    with open(ruta, "w", encoding="utf-8") as fh:
        fh.write(contenido if contenido.endswith("\n") else contenido + "\n")
    os.chmod(ruta, 0o600)


def crear(db, rol: str, username: str, nombre: str, email: str):
    ya = db.query(Usuario).filter(Usuario.username == username).first()
    if ya:
        print(f"  - {rol:13s} '{username}' ya existe (id={ya.id}) -- omitido")
        return

    par_ec = generar_par_ecdsa()   # firma de recetas/sellos/acuses
    par_rsa = generar_par_rsa()    # envoltura/desenvoltura de la DEK

    u = Usuario(
        username=username, nombre=nombre, email=email,
        password_hash=hash_password(PASSWORD), salt_pw=secrets.token_bytes(32),
        rol=rol, estado="activo", activo=True, email_verificado=True,
        pub_ec_pem=par_ec.pub_pem, pub_rsa_pem=par_rsa.pub_pem,
    )
    db.add(u)
    db.flush()

    sol = SolicitudCertificado(
        usuario_id=u.id, pub_ec_pem=par_ec.pub_pem, pub_rsa_pem=par_rsa.pub_pem,
        estado="aprobada", fecha_resolucion=datetime.now(timezone.utc),
    )
    db.add(sol)
    db.flush()

    cert_ec, ec_serial, ec_exp = emitir_cert(par_ec.pub_pem, nombre, rol, "firma")
    cert_rsa, rsa_serial, rsa_exp = emitir_cert(par_rsa.pub_pem, nombre, rol, "cifrado")
    db.add(Certificado(usuario_id=u.id, tipo="ec", uso="firma",
                       cert_pem=cert_ec, serial_hex=ec_serial, fecha_expiracion=ec_exp))
    db.add(Certificado(usuario_id=u.id, tipo="rsa", uso="cifrado",
                       cert_pem=cert_rsa, serial_hex=rsa_serial, fecha_expiracion=rsa_exp))

    audit_log(db, usuario_id=u.id, accion="registro",
              metadata={"rol": rol, "via": "seed_test_users"})
    audit_log(db, usuario_id=u.id, accion="emision_certificado",
              metadata={"tipo": "ec", "serial": ec_serial, "via": "seed_test_users"})
    audit_log(db, usuario_id=u.id, accion="emision_certificado",
              metadata={"tipo": "rsa", "serial": rsa_serial, "via": "seed_test_users"})
    db.commit()
    db.refresh(u)

    _escribir_pem(f"{username}_ec.pem", par_ec.priv_pem)
    _escribir_pem(f"{username}_rsa.pem", par_rsa.priv_pem)
    _escribir_pem(f"{username}.pem", bundle_pem_privadas(par_ec.priv_pem, par_rsa.priv_pem))
    print(f"  + {rol:13s} id={u.id:<3d} username={username}")


def main() -> None:
    init_schema(reset=False)
    os.makedirs(OUT_DIR, exist_ok=True)
    db = SessionLocal()
    try:
        print(f"Creando usuarios de prueba (password: {PASSWORD})")
        for rol, username, nombre, email in USUARIOS:
            crear(db, rol, username, nombre, email)
    finally:
        db.close()
    print(f"\nLlaves privadas (.pem) escritas en {OUT_DIR}")


if __name__ == "__main__":
    main()
