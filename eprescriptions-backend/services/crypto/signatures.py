"""ECDSA sobre P-256 con SHA3-256 — obligatorio en TODO el sistema (spec §ECDSA_Sign).

No se usa SHA-256 aquí bajo ninguna circunstancia.
"""
from __future__ import annotations

import base64

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.ec import EllipticCurvePrivateKey


def ecdsa_sign(priv: EllipticCurvePrivateKey | str, message: bytes) -> str:
    """Firma `message` con ECDSA P-256 + SHA3-256. Retorna Base64 (DER)."""
    if isinstance(priv, str):
        priv = serialization.load_pem_private_key(priv.encode(), password=None)
    sig_der = priv.sign(message, ec.ECDSA(hashes.SHA3_256()))
    return base64.b64encode(sig_der).decode()


def ecdsa_verify(pub_pem: str, message: bytes, sig_b64: str) -> bool:
    """True si la firma es válida bajo ECDSA P-256 + SHA3-256."""
    try:
        pub = serialization.load_pem_public_key(pub_pem.encode())
        pub.verify(base64.b64decode(sig_b64), message, ec.ECDSA(hashes.SHA3_256()))
        return True
    except (InvalidSignature, ValueError, TypeError):
        return False
