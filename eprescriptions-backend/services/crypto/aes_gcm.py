"""AES-128-GCM: clave 16 B, IV 12 B, TAG 16 B."""
from __future__ import annotations

import secrets
from typing import Tuple

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .crypto_log import log_aes_decrypt, log_aes_encrypt


def new_dek() -> bytes:
    return secrets.token_bytes(16)


def new_iv() -> bytes:
    return secrets.token_bytes(12)


def aes_gcm_encrypt(key: bytes, iv: bytes, plaintext: bytes, aad: bytes) -> Tuple[bytes, bytes]:
    if len(key) != 16:
        raise ValueError("DEK debe ser de 128 bits (16 bytes)")
    if len(iv) != 12:
        raise ValueError("IV debe ser de 96 bits (12 bytes)")

    ct_tag = AESGCM(key).encrypt(iv, plaintext, aad)
    log_aes_encrypt(len(plaintext), len(aad), len(iv), "cifrado de receta R")
    return ct_tag[:-16], ct_tag[-16:]


def aes_gcm_decrypt(key: bytes, iv: bytes, ciphertext: bytes, tag: bytes, aad: bytes) -> bytes:
    if len(key) != 16:
        raise ValueError("DEK debe ser de 128 bits (16 bytes)")
    if len(tag) != 16:
        raise ValueError("TAG debe ser de 128 bits (16 bytes)")

    try:
        pt = AESGCM(key).decrypt(iv, ciphertext + tag, aad)
    except Exception:
        log_aes_decrypt(len(ciphertext), len(aad), False, "descifrado de receta R")
        raise

    log_aes_decrypt(len(ciphertext), len(aad), True, "descifrado de receta R")
    return pt
