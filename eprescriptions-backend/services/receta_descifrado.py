"""Operación de descifrado de una receta (spec §5 paciente, §6 farmacia).

Flujo:
    1. dek = RSA-OAEP-Decrypt(priv_rsa, C_wrap)       ← falla → rechaza
    2. R   = AES-256-GCM-Decrypt(dek, IV, C, TAG, AAD) ← TAG falla → rechaza
    3. Scrubear dek.

Cualquier error devuelve un mensaje GENÉRICO para no exponer oráculos de
padding / wrap-unwrap.
"""
from __future__ import annotations

import json

from cryptography.exceptions import InvalidTag
from fastapi import HTTPException

from services.crypto import aes_gcm_decrypt, rsa_oaep_decrypt

_CRIPTO_ERR = "INTEGRIDAD comprometida o firma inválida"


def descifrar(
    priv_rsa_pem: str,
    c_wrap: bytes,
    iv: bytes,
    ciphertext: bytes,
    tag: bytes,
    aad: bytes,
) -> dict:
    """Devuelve el JSON R descifrado como dict. Rechaza con 400 genérico ante
    cualquier fallo criptográfico (wrap inválido, TAG inválido, etc.)."""
    try:
        dek = rsa_oaep_decrypt(priv_rsa_pem, c_wrap)
    except Exception:
        raise HTTPException(400, _CRIPTO_ERR)
    try:
        plaintext = aes_gcm_decrypt(dek, iv, ciphertext, tag, aad)
    except (InvalidTag, Exception):
        raise HTTPException(400, _CRIPTO_ERR)
    finally:
        dek = b"\x00" * 32
    return json.loads(plaintext.decode())
