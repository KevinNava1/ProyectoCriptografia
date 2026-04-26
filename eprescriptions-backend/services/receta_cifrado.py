"""Operación de cifrado de una receta (spec §4.3–§4.9).

Flujo:
    1. dek   ← Random(256 bits)               ← efímera, nunca persistida
    2. iv    ← Random(96  bits)
    3. C, TAG = AES-256-GCM(dek, iv, R, AAD)
    4. C_wrap_pac    = RSA-OAEP(pub_rsa_pac, dek)
    5. Para cada farmacia activa F:
         C_wrap_farF = RSA-OAEP(pub_rsa_F,   dek)
    6. Scrubear dek de memoria.

La DEK ES efímera y única por receta — ningún actor del servidor la retiene.
"""
from __future__ import annotations

from dataclasses import dataclass

from services.crypto import aes_gcm_encrypt, new_dek, new_iv, rsa_oaep_encrypt


@dataclass
class Envolturas:
    """Resultado del cifrado listo para persistir en BD."""
    ciphertext: bytes
    tag: bytes
    iv: bytes
    c_wrap_pac: bytes
    c_wraps_far: list[tuple[int, bytes]]  # [(farmacia_id, c_wrap_far), ...]


def cifrar_y_envolver(
    r_bytes: bytes,
    aad: bytes,
    pub_rsa_paciente_pem: str,
    farmacias_pub: list[tuple[int, str]],
) -> Envolturas:
    """Cifra R una sola vez y envuelve la DEK para el paciente y cada farmacia.

    `farmacias_pub` es la lista [(id_farmacia, pub_rsa_pem), ...] de las
    farmacias activas obtenidas por el caller.
    """
    dek = new_dek()
    iv = new_iv()
    try:
        ct, tag = aes_gcm_encrypt(dek, iv, r_bytes, aad)
        c_wrap_pac = rsa_oaep_encrypt(pub_rsa_paciente_pem, dek)
        c_wraps_far = [(fid, rsa_oaep_encrypt(pem, dek)) for fid, pem in farmacias_pub]
    finally:
        dek = b"\x00" * 32  # scrub (best effort; Python no garantiza)
    return Envolturas(ct, tag, iv, c_wrap_pac, c_wraps_far)
