"""Schemas del dominio de usuarios (§1, §2, §3)."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, constr


class UsuarioInput(BaseModel):
    # El rol `admin` NO está — los admins no se autoregistran; se bootstrapean.
    username: constr(strip_whitespace=True, min_length=3, max_length=40)
    nombre: constr(strip_whitespace=True, min_length=2, max_length=120)
    email: EmailStr
    password: constr(min_length=6, max_length=120)
    rol: Literal["medico", "paciente", "farmaceutico"]


class UsuarioOutput(BaseModel):
    id: int
    username: str
    nombre: str
    # `str` (no `EmailStr`): el output sólo refleja la BD; ya validamos en input.
    # Esto permite emails con TLDs reservados como `.local` para el admin local.
    email: str
    rol: str
    estado: Optional[str] = None
    # Solo presente tras el registro — bundle PEM (EC + RSA) que el cliente
    # debe guardar una única vez (§1.5).
    llave_privada: Optional[str] = None
    # Llaves privadas separadas por tipo (mismas que el bundle, partidas).
    llave_privada_ec: Optional[str] = None
    llave_privada_rsa: Optional[str] = None
    # Públicas (no son secretas; quedan registradas en el servidor).
    llave_publica: Optional[str] = None       # alias de llave_publica_ec
    llave_publica_ec: Optional[str] = None
    llave_publica_rsa: Optional[str] = None
    token: Optional[str] = None


class LoginInput(BaseModel):
    username: constr(strip_whitespace=True, min_length=3, max_length=40)
    password: constr(min_length=1)
    rol: Literal["admin", "medico", "paciente", "farmaceutico"]
    # Para roles no-admin las llaves privadas son obligatorias en login —
    # el backend deriva la pública desde cada una y la compara con la pub
    # registrada. Si no coinciden, NO se emite JWT.
    llave_privada_ec: Optional[str] = None
    llave_privada_rsa: Optional[str] = None
