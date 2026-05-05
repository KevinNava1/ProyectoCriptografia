"""Cifrado de receta: cifrado híbrido AES-128-GCM + RSA-OAEP por destinatario.

Patrón clásico:
  1. Generamos una DEK aleatoria (clave simétrica de un solo uso).
  2. Ciframos la receta UNA vez con AES-GCM usando esa DEK.
  3. Envolvemos la DEK con la pub RSA de cada destinatario (paciente + cada
     farmacia activa). Resultado: N copias chicas de la DEK + 1 copia grande
     del ciphertext.

Alternativa naive: cifrar la receta entera con RSA contra cada destinatario.
RSA es 100x-1000x más lento que AES y tiene límite de tamaño por bloque.
El híbrido nos da O(receta) en cifrado simétrico + O(N · 256B) en wraps RSA.
"""
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
        # Sobrescribimos la DEK en memoria. No es garantía contra dumps de
        # heap (Python copia bytes inmutables), pero limita la ventana en
        # la que un dump capturaría la DEK útil.
        dek = b"\x00" * 16
    return Envolturas(ct, tag, iv, c_wrap_pac, c_wraps_far)
