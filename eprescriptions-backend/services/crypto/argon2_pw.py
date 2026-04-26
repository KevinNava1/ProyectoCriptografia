"""Argon2id para hashing de contraseñas (spec §Argon2id).

Parámetros: m=64MB, t=3, p=4, salt=32 bytes (argon2-cffi ya usa salt aleatorio
por defecto — forzamos salt_len=32 para cumplir literal la spec).
"""
from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHash

# 64 MB = 65536 KiB
_HASHER = PasswordHasher(
    time_cost=3,
    memory_cost=64 * 1024,
    parallelism=4,
    hash_len=32,
    salt_len=32,
)


def hash_password(password: str) -> str:
    return _HASHER.hash(password)


def verify_password(hash_str: str, password: str) -> bool:
    try:
        _HASHER.verify(hash_str, password)
        return True
    except (VerifyMismatchError, InvalidHash, Exception):
        return False
