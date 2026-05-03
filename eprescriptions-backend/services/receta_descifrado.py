"""Descifrado de receta: RSA-OAEP unwrap + AES-128-GCM decrypt.

Cualquier fallo criptográfico devuelve un 400 genérico — sin exponer oráculos.
"""
from __future__ import annotations

import json

from fastapi import HTTPException

from services.crypto import aes_gcm_decrypt, rsa_oaep_decrypt

_ERR = "INTEGRIDAD comprometida o firma inválida"


def descifrar(
    priv_rsa_pem: str,
    c_wrap: bytes,
    iv: bytes,
    ciphertext: bytes,
    tag: bytes,
    aad: bytes,
) -> dict:
    try:
        dek = rsa_oaep_decrypt(priv_rsa_pem, c_wrap)
    except Exception:
        raise HTTPException(400, _ERR)
    try:
        pt = aes_gcm_decrypt(dek, iv, ciphertext, tag, aad)
    except Exception:
        raise HTTPException(400, _ERR)
    finally:
        dek = b"\x00" * 16
    return json.loads(pt.decode())
