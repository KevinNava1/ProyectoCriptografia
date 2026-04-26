"""Middleware de autenticación y RBAC.

- `auth_required`: valida el JWT y devuelve el `Usuario` activo de BD.
- `require_roles(*roles)`: factoría de dependencias que exige un rol concreto.
"""
from __future__ import annotations

from typing import Iterable

import jwt
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from database import Usuario, get_db
from services.crypto import verify_jwt


def _extract_token(authorization: str | None) -> str:
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
        raise HTTPException(401, "Sesión expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token inválido")

    uid = payload.get("id_usuario")
    rol_tok = payload.get("rol")
    if not uid or not rol_tok:
        raise HTTPException(401, "Token incompleto")

    u = db.query(Usuario).filter(Usuario.id == uid).first()
    if not u:
        raise HTTPException(401, "Usuario no existe")
    if not u.activo or u.estado != "activo":
        raise HTTPException(403, "Cuenta inactiva")
    if u.rol != rol_tok:
        # El rol cambió en BD respecto al token.
        raise HTTPException(403, "Rol no coincide")
    return u


def require_roles(*roles: str):
    def _dep(user: Usuario = Depends(auth_required)) -> Usuario:
        if roles and user.rol not in roles:
            raise HTTPException(403, f"Rol requerido: {'/'.join(roles)}")
        return user

    return _dep
