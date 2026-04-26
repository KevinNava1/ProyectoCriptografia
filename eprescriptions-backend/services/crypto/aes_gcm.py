"""AES-256-GCM con TAG de 128 bits (spec §AES-256-GCM).

Reglas críticas:
  * K = 32 bytes de CSPRNG, único por operación.
  * IV = 12 bytes de CSPRNG, único por operación — JAMÁS reutilizar con la misma K.
  * AAD obligatorio y vinculado a la operación.
  * Tras uso, borrar K del buffer (best-effort en Python).
"""
from __future__ import annotations

import secrets
from typing import Tuple

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def new_dek() -> bytes:
    return secrets.token_bytes(32)


def new_iv() -> bytes:
    return secrets.token_bytes(12)


def aes_gcm_encrypt(key: bytes, iv: bytes, plaintext: bytes, aad: bytes) -> Tuple[bytes, bytes]:
    """Cifra `plaintext` con AES-256-GCM. Retorna (ciphertext, tag_16B).

    Levanta ValueError si la clave o IV no tienen el tamaño correcto.
    """
    if len(key) != 32:
        raise ValueError("DEK debe ser de 256 bits (32 bytes)")
    if len(iv) != 12:
        raise ValueError("IV debe ser de 96 bits (12 bytes)")
    ct_tag = AESGCM(key).encrypt(iv, plaintext, aad)
    return ct_tag[:-16], ct_tag[-16:]


def aes_gcm_decrypt(key: bytes, iv: bytes, ciphertext: bytes, tag: bytes, aad: bytes) -> bytes:
    """Descifra y verifica el TAG. Levanta InvalidTag si fue alterado."""
    if len(tag) != 16:
        raise ValueError("TAG debe ser de 128 bits (16 bytes)")
    return AESGCM(key).decrypt(iv, ciphertext + tag, aad)
