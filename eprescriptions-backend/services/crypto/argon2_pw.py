"""Argon2id para hashing de contraseñas (spec §Argon2id).

¿Por qué Argon2id y no bcrypt o sha256+salt?
  - Es el ganador del Password Hashing Competition (2015) y el algoritmo que
    OWASP recomienda hoy. Está específicamente diseñado para ser caro en
    memoria, lo que neutraliza el ataque más relevante: GPUs/ASICs masivamente
    paralelos. Un atacante con una RTX 4090 puede romper SHA-256 a millones
    de hashes/segundo, pero Argon2id con 64MB lo deja con menos de 100/s por
    instancia.
  - "id" es la variante híbrida: resistente a side-channels (como Argon2i) y a
    trade-off attacks tiempo/memoria (como Argon2d).

Parámetros que usamos (los exige la spec):
  - m = 64 MB → coste en memoria por hash
  - t = 3    → 3 pasadas (iteraciones)
  - p = 4    → paralelismo interno
  - salt = 32 bytes (CSPRNG; argon2-cffi ya lo genera por defecto)

El string que devuelve `hash()` ya empaqueta los parámetros y el salt:
    $argon2id$v=19$m=65536,t=3,p=4$<salt_b64>$<hash_b64>
Por eso no necesitamos guardar salt y hash en columnas separadas — `verify`
lo desempaca solito. Aún así guardamos `salt_pw` aparte porque la spec lo pide
literal.
"""
from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHash

# 64 MB = 65536 KiB. La librería espera el coste en KiB.
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
    # Devolvemos bool en vez de propagar la excepción: el caller solo necesita
    # saber "coincide o no", y atrapamos cualquier `Exception` para que un
    # hash corrupto en BD no tumbe el login con un 500.
    try:
        _HASHER.verify(hash_str, password)
        return True
    except (VerifyMismatchError, InvalidHash, Exception):
        return False
