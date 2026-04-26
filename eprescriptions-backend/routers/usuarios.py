"""Usuarios — §1 Registro, §3 Login, perfil.

§1 deja al usuario en estado=pendiente y genera la solicitud de certificado.
La certificación §2 (emisión de los dos X.509) la realiza un administrador
desde `routers/admin.py`. Hasta entonces, el login con ese usuario es rechazado.
"""
from __future__ import annotations

import re
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from audit import registrar as audit_log
from auth import auth_required
from database import Certificado, SolicitudCertificado, Usuario, get_db
from services import bundle as bundle_svc
from schemas.usuarios import LoginInput, UsuarioInput, UsuarioOutput
from services.crypto import (
    bundle_pem_privadas,
    generar_par_ecdsa,
    generar_par_rsa,
    hash_password,
    sign_jwt,
    verify_password,
)

router = APIRouter(prefix="/usuarios", tags=["usuarios"])

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.-]{3,40}$")


def _to_out(u: Usuario, **extra) -> UsuarioOutput:
    return UsuarioOutput(
        id=u.id, username=u.username, nombre=u.nombre, email=u.email,
        rol=u.rol, estado=u.estado, **extra,
    )


# ─────────────────────────────────────────────────────────────────────
#  §1 REGISTRO — deja al usuario en estado=pendiente.
#  §2 la resuelve el admin desde /admin/solicitudes/{id}/aprobar.
# ─────────────────────────────────────────────────────────────────────
@router.post("/registro", response_model=UsuarioOutput, status_code=201)
def registrar(datos: UsuarioInput, db: Session = Depends(get_db)):
    if not _USERNAME_RE.match(datos.username):
        raise HTTPException(400, "Username solo admite letras, números, '.', '_', '-' (3-40)")
    if db.query(Usuario).filter(Usuario.username == datos.username).first():
        raise HTTPException(409, "Ese nombre de usuario ya está en uso")
    if db.query(Usuario).filter(Usuario.email == datos.email).first():
        raise HTTPException(409, "El email ya está registrado")

    # §1.1 — dos pares de llaves.
    par_ec = generar_par_ecdsa()
    par_rsa = generar_par_rsa()

    # §1.2 — Argon2id(password, salt_pw).
    salt_pw = secrets.token_bytes(32)
    pw_hash = hash_password(datos.password)

    # §1.3 — INSERT usuario en estado=pendiente (sin certs; los emite el admin).
    nuevo = Usuario(
        username=datos.username, nombre=datos.nombre, email=datos.email,
        password_hash=pw_hash, salt_pw=salt_pw, rol=datos.rol,
        estado="pendiente",
        pub_ec_pem=par_ec.pub_pem, pub_rsa_pem=par_rsa.pub_pem,
    )
    db.add(nuevo)
    db.flush()

    # §1.4 — solicitud de certificado pendiente (cola para el admin).
    sol = SolicitudCertificado(
        usuario_id=nuevo.id,
        pub_ec_pem=par_ec.pub_pem, pub_rsa_pem=par_rsa.pub_pem,
        estado="pendiente",
    )
    db.add(sol)
    db.flush()

    # §1.7 — auditoría.
    audit_log(db, usuario_id=nuevo.id, accion="registro", metadata={"rol": nuevo.rol})

    db.commit()
    db.refresh(nuevo)

    # §1.5 — entregar las llaves privadas al cliente UNA sola vez. Mantenemos
    # el bundle (compat con flujos que lo concatenan) y además las dos llaves
    # separadas, que es la forma natural en que el frontend pide al usuario
    # subirlas en login (un .pem EC y un .pem RSA distintos).
    bundle_priv = bundle_pem_privadas(par_ec.priv_pem, par_rsa.priv_pem)
    return _to_out(
        nuevo,
        llave_privada=bundle_priv,
        llave_privada_ec=par_ec.priv_pem,
        llave_privada_rsa=par_rsa.priv_pem,
        llave_publica=par_ec.pub_pem,
        llave_publica_ec=par_ec.pub_pem,
        llave_publica_rsa=par_rsa.pub_pem,
    )


# ─────────────────────────────────────────────────────────────────────
#  §3 LOGIN
# ─────────────────────────────────────────────────────────────────────
@router.post("/login", response_model=UsuarioOutput)
def login(datos: LoginInput, db: Session = Depends(get_db)):
    # §3.1 — verificar Argon2id.
    u = db.query(Usuario).filter(Usuario.username == datos.username).first()
    if not u or not verify_password(u.password_hash, datos.password):
        raise HTTPException(401, "Usuario o contraseña incorrectos")
    if u.rol != datos.rol:
        raise HTTPException(403, f"Este usuario no tiene rol '{datos.rol}'. Su rol real es '{u.rol}'.")
    # §3.2 — estado activo.
    if not u.activo or u.estado != "activo":
        raise HTTPException(403, "Cuenta desactivada o pendiente de aprobación")

    # §3.3 — ambos certs vigentes.
    now_utc = datetime.now(timezone.utc)
    certs = db.query(Certificado).filter(
        Certificado.usuario_id == u.id,
        Certificado.revocado == False,  # noqa: E712
    ).all()

    def _vigente(c):
        exp = c.fecha_expiracion
        if exp.tzinfo is None:  # MySQL devuelve naive; interpretamos como UTC
            exp = exp.replace(tzinfo=timezone.utc)
        return exp > now_utc

    if not (any(c.tipo == "ec" and _vigente(c) for c in certs)
            and any(c.tipo == "rsa" and _vigente(c) for c in certs)):
        raise HTTPException(403, "Tus certificados no están activos")

    # §3.4a — Verificación de pertenencia de llaves privadas.
    # Para roles no-admin: derivamos la pub desde cada priv subida y la
    # comparamos con la pub guardada (pub_ec_pem / pub_rsa_pem). Si una de
    # las dos no deriva a la pub registrada, RECHAZAMOS el login antes de
    # emitir JWT — así el atacante con password robada pero sin las llaves
    # nunca obtiene sesión.
    if u.rol != "admin":
        if not datos.llave_privada_ec or not datos.llave_privada_rsa:
            raise HTTPException(400, "Faltan tus llaves privadas EC y RSA")
        bundle_svc.exigir_ec(datos.llave_privada_ec, u.pub_ec_pem)
        bundle_svc.exigir_rsa(datos.llave_privada_rsa, u.pub_rsa_pem)

    # §3.4 — JWT con exp=60min.
    token = sign_jwt(u.id, u.rol)
    # §3.5 — audit.
    audit_log(db, usuario_id=u.id, accion="login")
    db.commit()
    return _to_out(u, token=token)


# ─────────────────────────────────────────────────────────────────────
#  Búsqueda incremental — typeahead. Devuelve hasta 10 coincidencias por
#  username/nombre. Solo autenticados; no expone llaves ni email.
# ─────────────────────────────────────────────────────────────────────
@router.get("/buscar")
def buscar_usuarios(
    q: str = Query(..., min_length=1, max_length=40, description="prefijo o substring"),
    rol: Optional[str] = Query(default=None, regex=r"^(paciente|medico|farmaceutico)$"),
    limit: int = Query(default=10, ge=1, le=20),
    _user: Usuario = Depends(auth_required),
    db: Session = Depends(get_db),
):
    needle = f"%{q.strip()}%"
    query = db.query(Usuario).filter(
        Usuario.estado == "activo",
        Usuario.activo == True,  # noqa: E712
        or_(Usuario.username.ilike(needle), Usuario.nombre.ilike(needle)),
    )
    if rol:
        query = query.filter(Usuario.rol == rol)
    matches = query.order_by(Usuario.username.asc()).limit(limit).all()
    return [
        {"id": u.id, "username": u.username, "nombre": u.nombre, "rol": u.rol}
        for u in matches
    ]


# ─────────────────────────────────────────────────────────────────────
#  Perfil público por username (expone solo pub_ec, nunca privados)
# ─────────────────────────────────────────────────────────────────────
@router.get("/{username}", response_model=UsuarioOutput)
def obtener_usuario(username: str, db: Session = Depends(get_db)):
    u = db.query(Usuario).filter(Usuario.username == username).first()
    if not u:
        raise HTTPException(404, "Usuario no encontrado")
    return _to_out(
        u,
        llave_publica=u.pub_ec_pem,
        llave_publica_ec=u.pub_ec_pem,
        llave_publica_rsa=u.pub_rsa_pem,
    )
