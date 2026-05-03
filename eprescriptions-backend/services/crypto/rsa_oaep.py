"""RSA-OAEP-SHA256 / MGF1-SHA256 — wrap/unwrap de DEK."""
from __future__ import annotations

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey

from .crypto_log import log_rsa_unwrap, log_rsa_wrap


_PADDING = padding.OAEP(
    mgf=padding.MGF1(algorithm=hashes.SHA256()),
    algorithm=hashes.SHA256(),
    label=None,
)


def rsa_oaep_encrypt(pub_pem: str, dek: bytes) -> bytes:
    pub = serialization.load_pem_public_key(pub_pem.encode())
    c_wrap = pub.encrypt(dek, _PADDING)
    log_rsa_wrap(len(dek), "envoltura de DEK para destinatario")
    return c_wrap


def rsa_oaep_decrypt(priv: RSAPrivateKey | str, ciphertext: bytes) -> bytes:
    if isinstance(priv, str):
        priv = serialization.load_pem_private_key(priv.encode(), password=None)
    try:
        dek = priv.decrypt(ciphertext, _PADDING)
    except Exception:
        log_rsa_unwrap(False, "recuperación de DEK")
        raise
    log_rsa_unwrap(True, "recuperación de DEK")
    return dek
