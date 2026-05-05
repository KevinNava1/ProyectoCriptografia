"""Descifrado de receta: RSA-OAEP unwrap + AES-128-GCM decrypt.

Reglas de error: cualquier fallo cripto se mapea a UN solo mensaje genérico.
No diferenciamos "OAEP falló" de "TAG no cuadra" — exponer ese detalle daría
un oráculo al atacante (sabría si su manipulación afectó al wrap o al cuerpo).
Mismo principio que está detrás de Bleichenbacher y de los padding oracles.
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
) -> tuple[dict, bytes]:
    """Devuelve (contenido_dict, plaintext_bytes).

    Los bytes brutos son los mismos que firmó el médico (R canónico) y se
    necesitan para verificar la firma ECDSA sin re-canonicalización — si
    re-serializáramos el dict, el orden de claves y los espacios podrían
    diferir y la firma fallaría aunque los datos fueran correctos.
    """
    try:
        dek = rsa_oaep_decrypt(priv_rsa_pem, c_wrap)
    except Exception:
        raise HTTPException(400, _ERR)
    try:
        pt = aes_gcm_decrypt(dek, iv, ciphertext, tag, aad)
    except Exception:
        # Aquí ya tenemos la DEK en memoria — la borramos antes de propagar.
        raise HTTPException(400, _ERR)
    finally:
        dek = b"\x00" * 16
    return json.loads(pt.decode()), pt
