"""Middleware de autenticación y RBAC.

- `auth_required`: valida el JWT y devuelve el `Usuario` activo de BD.
- `require_roles(*roles)`: factoría de dependencias que exige un rol concreto.

Toda ruta protegida pasa por `auth_required`. Las que además exigen rol usan
`require_roles("medico")` o similares. El orden importa: SIEMPRE primero el
JWT (autenticación) y después el rol (autorización), nunca al revés.
"""
from __future__ import annotations

from typing import Iterable

import jwt
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from database import Usuario, get_db
from services.crypto import verify_jwt


def _extract_token(authorization: str | None) -> str:
    # Esquema "Bearer <token>" del RFC 6750. Si llega cualquier otra cosa
    # (Basic, vacío, etc.) lo tratamos como ausencia de credenciales.
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Falta token de sesión")
    return authorization.split(" ", 1)[1].strip()


def auth_required(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Usuario:
    token = _extract_token(authorization)
    try:
        payload = verify_jwt(token)
    except jwt.ExpiredSignatureError:
        # Token bien firmado pero vencido — el cliente debe re-loggear.
        raise HTTPException(401, "Sesión expirada")
    except jwt.InvalidTokenError:
        # Firma mala, alg distinto, payload corrupto, etc. Mensaje genérico
        # a propósito: no le decimos al atacante QUÉ falló.
        raise HTTPException(401, "Token inválido")

    uid = payload.get("id_usuario")
    rol_tok = payload.get("rol")
    if not uid or not rol_tok:
        raise HTTPException(401, "Token incompleto")

    # No basta con que el JWT sea válido: también revalidamos contra BD por si
    # el usuario fue suspendido/borrado o cambió de rol después de loggear.
    # Sin esto, un token vivo seguiría dando acceso aunque el admin lo haya
    # echado hace 30 segundos.
    u = db.query(Usuario).filter(Usuario.id == uid).first()
    if not u:
        raise HTTPException(401, "Usuario no existe")
    if not u.activo or u.estado != "activo":
        raise HTTPException(403, "Cuenta inactiva")
    if u.rol != rol_tok:
        # El rol cambió en BD respecto al token: invalidamos para que el
        # cliente re-loggee y obtenga un JWT con el rol actual.
        raise HTTPException(403, "Rol no coincide")
    return u


def require_roles(*roles: str):
    """Factoría de dependencia para exigir uno de los roles indicados.

    Uso típico en un endpoint:
        user: Usuario = Depends(require_roles("medico"))

    Internamente reutiliza `auth_required`, así que ya cuenta con el chequeo
    de JWT y de cuenta activa antes de evaluar el rol.
    """
    def _dep(user: Usuario = Depends(auth_required)) -> Usuario:
        if roles and user.rol not in roles:
            raise HTTPException(403, f"Rol requerido: {'/'.join(roles)}")
        return user

    return _dep
