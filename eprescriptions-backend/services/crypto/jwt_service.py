"""JWT con HS256 usando secret fuerte en env (spec §JWT — acepta HS256 con
secret fuerte o ES256). Usamos HS256 por simplicidad operativa; el secret vive
sólo en .env y nunca se loggea.

Tokens: `{ id_usuario, rol, exp: now+3600 }`.
"""
from __future__ import annotations

import os
import time
from typing import Any

import jwt

_SECRET = os.getenv("JWT_SECRET")
_ALGO = os.getenv("JWT_ALGORITHM", "HS256")
_EXP_MIN = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))


def _require_secret() -> str:
    if not _SECRET or len(_SECRET) < 32:
        raise RuntimeError("JWT_SECRET no configurado o débil (<32 chars)")
    return _SECRET


def sign_jwt(id_usuario: int, rol: str) -> str:
    payload: dict[str, Any] = {
        "id_usuario": id_usuario,
        "rol": rol,
        "exp": int(time.time()) + _EXP_MIN * 60,
        "iat": int(time.time()),
    }
    return jwt.encode(payload, _require_secret(), algorithm=_ALGO)


def verify_jwt(token: str) -> dict[str, Any]:
    return jwt.decode(token, _require_secret(), algorithms=[_ALGO])
