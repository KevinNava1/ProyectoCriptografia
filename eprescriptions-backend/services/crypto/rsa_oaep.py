"""RSA-OAEP con SHA-256 y MGF1-SHA-256 (spec §RSA-OAEP-Encrypt).

Envuelve la DEK de 32 bytes. La llave pública va como PEM; la privada puede
venir como PEM o como objeto cryptography.
"""
from __future__ import annotations

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey


_PADDING = padding.OAEP(
    mgf=padding.MGF1(algorithm=hashes.SHA256()),
    algorithm=hashes.SHA256(),
    label=None,
)


def rsa_oaep_encrypt(pub_pem: str, dek: bytes) -> bytes:
    pub = serialization.load_pem_public_key(pub_pem.encode())
    return pub.encrypt(dek, _PADDING)


def rsa_oaep_decrypt(priv: RSAPrivateKey | str, ciphertext: bytes) -> bytes:
    if isinstance(priv, str):
        priv = serialization.load_pem_private_key(priv.encode(), password=None)
    return priv.decrypt(ciphertext, _PADDING)
