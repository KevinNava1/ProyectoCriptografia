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

# Placeholders y valores triviales que han aparecido en defaults o en docs;
# cualquiera de ellos significa que el operador olvidó setear un secreto real.
# Comparamos en lowercase para atrapar variantes de capitalización.
_PLACEHOLDERS = frozenset(
    s.lower() for s in (
        "change-this-secret-in-prod",
        "cambia-este-secreto-en-produccion",
        "changeme",
        "secret",
        "jwt-secret",
        "default",
        "test",
        "supersecret",
    )
)


def _require_secret() -> str:
    if not _SECRET:
        raise RuntimeError(
            "JWT_SECRET no configurado. Genera uno con: openssl rand -hex 32"
        )
    if len(_SECRET) < 32:
        raise RuntimeError(
            f"JWT_SECRET demasiado débil ({len(_SECRET)} chars; mínimo 32). "
            "Genera uno con: openssl rand -hex 32"
        )
    if _SECRET.lower() in _PLACEHOLDERS:
        raise RuntimeError(
            "JWT_SECRET es un placeholder conocido (rechazado por seguridad). "
            "Genera uno real con: openssl rand -hex 32"
        )
    # Heurística adicional: si el secreto tiene muy poca entropía aparente
    # (ej. todos los caracteres iguales o secuencia trivial), también rechaza.
    if len(set(_SECRET)) < 8:
        raise RuntimeError(
            "JWT_SECRET tiene entropía insuficiente (<8 caracteres únicos). "
            "Genera uno real con: openssl rand -hex 32"
        )
    return _SECRET


# Validación al import: el módulo NO carga si el secreto es inválido.
# Esto rompe el arranque del backend antes de servir cualquier request,
# evitando que una instancia con JWT trivialmente falsificable quede en línea.
_require_secret()


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
