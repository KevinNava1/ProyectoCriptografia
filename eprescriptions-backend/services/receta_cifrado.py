"""Cifrado de receta: AES-128-GCM + RSA-OAEP wrap de DEK para paciente y farmacias."""
from __future__ import annotations

from dataclasses import dataclass

from services.crypto import aes_gcm_encrypt, new_dek, new_iv, rsa_oaep_encrypt


@dataclass
class Envolturas:
    ciphertext: bytes
    tag: bytes
    iv: bytes
    c_wrap_pac: bytes
    c_wraps_far: list[tuple[int, bytes]]  # [(farmacia_id, c_wrap), ...]


def cifrar_y_envolver(
    r_bytes: bytes,
    aad: bytes,
    pac_pub_pem: str,
    farmacias_pub: list[tuple[int, str]],  # [(id, pub_pem), ...]
) -> Envolturas:
    dek = new_dek()
    iv = new_iv()
    try:
        ct, tag = aes_gcm_encrypt(dek, iv, r_bytes, aad)
        c_wrap_pac = rsa_oaep_encrypt(pac_pub_pem, dek)
        c_wraps_far = [(fid, rsa_oaep_encrypt(pem, dek)) for fid, pem in farmacias_pub]
    finally:
        dek = b"\x00" * 16  # best-effort scrub
    return Envolturas(ct, tag, iv, c_wrap_pac, c_wraps_far)
