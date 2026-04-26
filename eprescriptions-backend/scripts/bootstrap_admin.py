"""Bootstrap del administrador inicial.

Idempotente: si ya existe al menos un usuario con rol=admin y estado=activo,
no hace nada. Se invoca también desde `main.py` en el startup si
ADMIN_PASSWORD está presente en el entorno (útil para contenedores).

Uso manual:
    python -m scripts.bootstrap_admin
"""
from __future__ import annotations

import os
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.orm import Session

from audit import registrar as audit_log
from database import (
    Certificado,
    SessionLocal,
    SolicitudCertificado,
    Usuario,
    init_schema,
)
from services.crypto import (
    bundle_pem_privadas,
    generar_par_ecdsa,
    generar_par_rsa,
    hash_password,
)
from services.crypto.ca import emitir_cert


def _resolver_directorio_destino(username: str, *, verbose: bool) -> Path:
    """Determina dónde escribir los .pem del admin.

    Prioridad:
      1. ADMIN_KEYS_DIR (env) — modo no-interactivo (Docker/CI/uvicorn).
      2. TTY interactivo → pregunta al usuario (Enter = ./admin_keys).
      3. Fallback: ./admin_keys (relativo al CWD).
    """
    env_dir = os.getenv("ADMIN_KEYS_DIR", "").strip()
    if env_dir:
        return Path(env_dir).expanduser().resolve()

    default = (Path.cwd() / "admin_keys").resolve()

    if not sys.stdin.isatty():
        if verbose:
            print(f"[bootstrap_admin] modo no interactivo — usando {default}")
        return default

    print()
    print("═" * 72)
    print(f"  Llaves del admin '{username}' — se generan UNA sola vez.")
    print(f"  Indica un directorio para guardarlas como archivos .pem.")
    print(f"  (Enter para usar el default: {default})")
    print("═" * 72)
    try:
        respuesta = input("Directorio destino: ").strip()
    except EOFError:
        respuesta = ""
    return (Path(respuesta).expanduser().resolve() if respuesta else default)


def _escribir_pem(path: Path, contenido: str, *, privado: bool) -> None:
    path.write_text(contenido, encoding="utf-8")
    if privado:
        try:
            os.chmod(path, 0o600)
        except Exception:
            pass


def _guardar_llaves_admin(par_ec, par_rsa, username: str, *, verbose: bool) -> Path:
    target = _resolver_directorio_destino(username, verbose=verbose)
    target.mkdir(parents=True, exist_ok=True)
    archivos = {
        f"{username}_priv_ec.pem":  (par_ec.priv_pem, True),
        f"{username}_priv_rsa.pem": (par_rsa.priv_pem, True),
        f"{username}_pub_ec.pem":   (par_ec.pub_pem,   False),
        f"{username}_pub_rsa.pem":  (par_rsa.pub_pem,  False),
    }
    rutas = []
    for nombre, (contenido, priv) in archivos.items():
        ruta = target / nombre
        _escribir_pem(ruta, contenido, privado=priv)
        rutas.append((ruta, priv))
    if verbose:
        print()
        print("✓ Llaves del admin guardadas (NO se volverán a mostrar):")
        for ruta, priv in rutas:
            tag = "priv (chmod 600)" if priv else "pub"
            print(f"    {tag:18s} {ruta}")
        print()
    return target


def bootstrap_admin(db: Session, *, verbose: bool = True) -> tuple[Usuario, str | None]:
    """Crea el primer admin si no existe. Devuelve (admin, bundle_pem|None).

    El bundle sólo se retorna la primera vez — si ya existe un admin activo,
    el bundle es None (la llave privada se entregó una única vez en su creación).
    """
    username = os.getenv("ADMIN_USERNAME", "admin")
    nombre = os.getenv("ADMIN_NOMBRE", "Administrador")
    # Default con TLD válido (no `.local`, que email-validator rechaza por RFC 6761).
    email = os.getenv("ADMIN_EMAIL", "admin@securerx.app")
    password = os.getenv("ADMIN_PASSWORD")

    existente = (
        db.query(Usuario)
        .filter(Usuario.rol == "admin", Usuario.estado == "activo")
        .first()
    )
    if existente:
        if verbose:
            print(f"[bootstrap_admin] admin ya existe (id={existente.id} username={existente.username}) — skip")
        return existente, None

    if not password:
        raise RuntimeError(
            "ADMIN_PASSWORD no configurado. Define ADMIN_USERNAME / ADMIN_NOMBRE / "
            "ADMIN_EMAIL / ADMIN_PASSWORD en el entorno para bootstrap del admin."
        )

    # Colisiones de username/email sin admin activo (p.ej. pendiente/suspendido previo).
    if db.query(Usuario).filter(Usuario.username == username).first():
        raise RuntimeError(f"Ya existe un usuario con username='{username}' (no admin activo)")
    if db.query(Usuario).filter(Usuario.email == email).first():
        raise RuntimeError(f"Ya existe un usuario con email='{email}' (no admin activo)")

    par_ec = generar_par_ecdsa()
    par_rsa = generar_par_rsa()
    salt_pw = secrets.token_bytes(32)
    pw_hash = hash_password(password)

    admin = Usuario(
        username=username, nombre=nombre, email=email,
        password_hash=pw_hash, salt_pw=salt_pw, rol="admin",
        estado="activo",
        pub_ec_pem=par_ec.pub_pem, pub_rsa_pem=par_rsa.pub_pem,
    )
    db.add(admin)
    db.flush()

    # Solicitud marcada como auto-aprobada para trazabilidad.
    sol = SolicitudCertificado(
        usuario_id=admin.id,
        pub_ec_pem=par_ec.pub_pem, pub_rsa_pem=par_rsa.pub_pem,
        estado="aprobada",
        fecha_resolucion=datetime.now(timezone.utc),
    )
    db.add(sol)
    db.flush()

    cert_ec_pem, ec_serial, ec_exp = emitir_cert(par_ec.pub_pem, nombre, "admin", "firma")
    cert_rsa_pem, rsa_serial, rsa_exp = emitir_cert(par_rsa.pub_pem, nombre, "admin", "cifrado")
    db.add(Certificado(
        usuario_id=admin.id, tipo="ec", uso="firma",
        cert_pem=cert_ec_pem, serial_hex=ec_serial, fecha_expiracion=ec_exp,
    ))
    db.add(Certificado(
        usuario_id=admin.id, tipo="rsa", uso="cifrado",
        cert_pem=cert_rsa_pem, serial_hex=rsa_serial, fecha_expiracion=rsa_exp,
    ))

    audit_log(db, usuario_id=admin.id, accion="bootstrap_admin",
              metadata={"via": "startup" if os.getenv("ADMIN_PASSWORD") else "cli"})
    audit_log(db, usuario_id=admin.id, accion="emision_certificado",
              metadata={"tipo": "ec", "serial": ec_serial, "bootstrap": True})
    audit_log(db, usuario_id=admin.id, accion="emision_certificado",
              metadata={"tipo": "rsa", "serial": rsa_serial, "bootstrap": True})

    db.commit()
    db.refresh(admin)

    if verbose:
        print(f"[bootstrap_admin] admin creado id={admin.id} username={admin.username}")
    # Las priv NO se imprimen al stdout: se escriben como archivos .pem en el
    # directorio que el operador elige (o ADMIN_KEYS_DIR en modo automatizado).
    _guardar_llaves_admin(par_ec, par_rsa, admin.username, verbose=verbose)
    bundle = bundle_pem_privadas(par_ec.priv_pem, par_rsa.priv_pem)
    return admin, bundle


def main() -> int:
    load_dotenv()
    init_schema(reset=False)
    db = SessionLocal()
    try:
        bootstrap_admin(db)
    except Exception as e:
        print(f"[bootstrap_admin] ERROR: {e}", file=sys.stderr)
        return 1
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
