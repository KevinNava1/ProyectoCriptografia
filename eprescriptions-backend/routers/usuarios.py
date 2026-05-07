"""Usuarios — §1 Registro, §3 Login, perfil, verificación de email y recuperación de contraseña."""
from __future__ import annotations

import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy import or_
from sqlalchemy.orm import Session

from audit import registrar as audit_log
from auth import auth_required
from database import Certificado, SolicitudCertificado, Usuario, get_db
from services import bundle as bundle_svc
from services import email as email_svc
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


class _EmailBody(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None


class _ResetBody(BaseModel):
    token: str
    nueva_password: str


def _to_out(u: Usuario, **extra) -> UsuarioOutput:
    return UsuarioOutput(
        id=u.id, username=u.username, nombre=u.nombre, email=u.email,
        rol=u.rol, estado=u.estado, **extra,
    )


@router.post("/registro", response_model=UsuarioOutput, status_code=201)
def registrar(datos: UsuarioInput, db: Session = Depends(get_db)):
    """§1 — Alta de usuario.

    Genera dos pares de llaves (EC y RSA), guarda SOLO las públicas en BD y
    devuelve las privadas al cliente UNA sola vez. El usuario queda en estado
    `pendiente` con una solicitud de certificado abierta — necesita aprobación
    del admin (§2) antes de poder loggear.
    """
    if not _USERNAME_RE.match(datos.username):
        raise HTTPException(400, "Username solo admite letras, números, '.', '_', '-' (3-40)")
    # Pre-checks de unicidad con SQL: el constraint UNIQUE de la tabla también
    # nos cubriría, pero queremos un mensaje claro en español, no un IntegrityError.
    if db.query(Usuario).filter(Usuario.username == datos.username).first():
        raise HTTPException(409, "Ese nombre de usuario ya está en uso")
    if db.query(Usuario).filter(Usuario.email == datos.email).first():
        raise HTTPException(409, "El email ya está registrado")

    # Material criptográfico recién generado para este usuario:
    #   - EC P-256 → firma de recetas/sellos/acuses/cancelaciones.
    #   - RSA-2048 → envoltura/desenvoltura de la DEK simétrica.
    par_ec  = generar_par_ecdsa()
    par_rsa = generar_par_rsa()
    salt_pw = secrets.token_bytes(32)  # salt explícito por exigencia de la spec
    pw_hash = hash_password(datos.password)
    tok_ver = secrets.token_urlsafe(32)  # token para el correo de verificación

    nuevo = Usuario(
        username=datos.username, nombre=datos.nombre, email=datos.email,
        password_hash=pw_hash, salt_pw=salt_pw, rol=datos.rol,
        estado="pendiente", email_verificado=False, token_verificacion=tok_ver,
        pub_ec_pem=par_ec.pub_pem, pub_rsa_pem=par_rsa.pub_pem,
    )
    db.add(nuevo)
    db.flush()  # necesitamos `nuevo.id` antes de crear la solicitud

    sol = SolicitudCertificado(
        usuario_id=nuevo.id,
        pub_ec_pem=par_ec.pub_pem, pub_rsa_pem=par_rsa.pub_pem,
        estado="pendiente",
    )
    db.add(sol)
    db.flush()

    audit_log(db, usuario_id=nuevo.id, accion="registro", metadata={"rol": nuevo.rol})
    db.commit()
    db.refresh(nuevo)

    # El correo se envía DESPUÉS del commit: si SMTP falla, el usuario quedó
    # creado igualmente (puede pedir reenvío). Al revés sería un usuario
    # "fantasma" si la transacción de BD se cae después de mandar el correo.
    email_svc.enviar_verificacion(nuevo.email, nuevo.username, tok_ver)

    # Bundle = EC.priv ++ RSA.priv. El frontend lo guarda como un solo archivo
    # descargable. Esto SOLO sucede en este response — luego nunca más.
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


@router.get("/verificar-email")
def verificar_email(token: str = Query(...), db: Session = Depends(get_db)):
    # Idempotente: no nulificamos el token al verificar. Esto soporta:
    #  (a) React StrictMode en dev, que dispara el effect dos veces y antes
    #      causaba que la 2ª llamada devolviera 400 con falso "ya usado".
    #  (b) Pre-fetchers de Gmail/Outlook que abren el link antes que el user.
    # El token se rota cuando el user pide reenvío (`reenviar_verificacion`),
    # así que un token viejo deja de servir en cuanto se emite uno nuevo.
    u = db.query(Usuario).filter(Usuario.token_verificacion == token).first()
    if not u:
        raise HTTPException(400, "Token inválido o ya utilizado")
    if not u.email_verificado:
        u.email_verificado = True
        db.commit()
    return {"ok": True, "username": u.username}


@router.post("/reenviar-verificacion")
def reenviar_verificacion(body: _EmailBody, db: Session = Depends(get_db)):
    if body.email:
        u = db.query(Usuario).filter(Usuario.email == body.email).first()
    elif body.username:
        u = db.query(Usuario).filter(Usuario.username == body.username).first()
    else:
        return {"ok": True}
    if not u or u.email_verificado:
        return {"ok": True}
    tok = secrets.token_urlsafe(32)
    u.token_verificacion = tok
    db.commit()
    email_svc.enviar_verificacion(u.email, u.username, tok)
    return {"ok": True}


@router.post("/recuperar-password")
def recuperar_password(body: _EmailBody, db: Session = Depends(get_db)):
    # Devolvemos `{ok: True}` aunque el email no exista — así no le decimos a
    # un atacante "este email SÍ está registrado y este NO" (enumeration).
    u = db.query(Usuario).filter(Usuario.email == body.email).first()
    if not u:
        return {"ok": True}
    tok = secrets.token_urlsafe(32)
    u.token_reset_pw  = tok
    u.token_reset_exp = datetime.now(timezone.utc) + timedelta(hours=1)
    db.commit()
    email_svc.enviar_reset(u.email, u.username, tok)
    return {"ok": True}


@router.post("/reset-password")
def reset_password(body: _ResetBody, db: Session = Depends(get_db)):
    u = db.query(Usuario).filter(Usuario.token_reset_pw == body.token).first()
    if not u or not u.token_reset_exp:
        raise HTTPException(400, "Token inválido o expirado")
    exp = u.token_reset_exp
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > exp:
        u.token_reset_pw  = None
        u.token_reset_exp = None
        db.commit()
        raise HTTPException(400, "El enlace de recuperación ha expirado")
    if len(body.nueva_password) < 6:
        raise HTTPException(400, "La contraseña debe tener al menos 6 caracteres")
    u.password_hash   = hash_password(body.nueva_password)
    u.token_reset_pw  = None
    u.token_reset_exp = None
    audit_log(db, usuario_id=u.id, accion="reset_password")
    db.commit()
    return {"ok": True}


@router.post("/login", response_model=UsuarioOutput)
def login(datos: LoginInput, db: Session = Depends(get_db)):
    """§3 — Autenticación multifactor: password + posesión de las dos llaves.

    Una password robada no alcanza para loggear: el cliente además debe
    aportar sus dos .pem privados. El backend deriva la pública desde cada
    privada y la compara con la pública registrada en BD; cualquier mismatch
    devuelve 403 sin emitir JWT.

    El admin se exime del chequeo de llaves porque no opera con criptografía
    de dominio (no firma recetas ni descifra; solo aprueba solicitudes).
    """
    u = db.query(Usuario).filter(Usuario.username == datos.username).first()
    # Mensaje único para "no existe el usuario" y "password incorrecta" — evita
    # que el atacante distinga entre los dos casos al enumerar usernames.
    if not u or not verify_password(u.password_hash, datos.password):
        raise HTTPException(401, "Usuario o contraseña incorrectos")
    if u.rol != datos.rol:
        raise HTTPException(403, f"Este usuario no tiene rol '{datos.rol}'. Su rol real es '{u.rol}'.")
    if u.rol != "admin" and not u.email_verificado:
        raise HTTPException(403, "Verifica tu email antes de iniciar sesión")
    if not u.activo or u.estado != "activo":
        raise HTTPException(403, "Cuenta desactivada o pendiente de aprobación")

    # Necesitamos AL MENOS un cert EC vigente y AL MENOS uno RSA vigente.
    # Si el admin revocó alguno (suspensión), el login se cae aquí aunque
    # password y llaves sean correctas.
    now_utc = datetime.now(timezone.utc)
    certs = db.query(Certificado).filter(
        Certificado.usuario_id == u.id,
        Certificado.revocado == False,  # noqa: E712
    ).all()

    def _vigente(c):
        # MySQL puede devolver datetime sin tzinfo según el driver — normalizamos
        # a UTC para que la comparación con `now_utc` no truene.
        exp = c.fecha_expiracion
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        return exp > now_utc

    if not (any(c.tipo == "ec" and _vigente(c) for c in certs)
            and any(c.tipo == "rsa" and _vigente(c) for c in certs)):
        raise HTTPException(403, "Tus certificados no están activos")

    # Validación de pertenencia de las llaves (el "factor algo que tienes").
    # `exigir_*` deriva la pub desde la priv y la compara con la pub en BD.
    if u.rol != "admin":
        if not datos.llave_privada_ec or not datos.llave_privada_rsa:
            raise HTTPException(400, "Faltan tus llaves privadas EC y RSA")
        bundle_svc.exigir_ec(datos.llave_privada_ec, u.pub_ec_pem)
        bundle_svc.exigir_rsa(datos.llave_privada_rsa, u.pub_rsa_pem)

    token = sign_jwt(u.id, u.rol)
    audit_log(db, usuario_id=u.id, accion="login")
    db.commit()
    return _to_out(u, token=token)


@router.get("/buscar")
def buscar_usuarios(
    q: str = Query(..., min_length=1, max_length=40, description="prefijo o substring"),
    rol: Optional[str] = Query(default=None, regex=r"^(paciente|medico|farmaceutico)$"),
    limit: int = Query(default=10, ge=1, le=20),
    _user: Usuario = Depends(auth_required),
    db: Session = Depends(get_db),
):
    """Typeahead para que el médico encuentre pacientes al crear receta.

    Requiere JWT (no es un endpoint público). Filtramos a usuarios activos y
    limitamos el resultado para evitar que un atacante autenticado dump-ee la
    tabla entera con `q="a"`.
    """
    needle = f"%{q.strip()}%"
    query = db.query(Usuario).filter(
        Usuario.estado == "activo",
        Usuario.activo == True,  # noqa: E712
        or_(Usuario.username.ilike(needle), Usuario.nombre.ilike(needle)),
    )
    if rol:
        query = query.filter(Usuario.rol == rol)
    matches = query.order_by(Usuario.username.asc()).limit(limit).all()
    # Devolvemos lo mínimo para el autocompletado — nunca emails ni llaves.
    return [
        {"id": u.id, "username": u.username, "nombre": u.nombre, "rol": u.rol}
        for u in matches
    ]


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
