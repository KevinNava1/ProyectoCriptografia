"""ECDSA P-256 + SHA3-256. Firma en DER → base64."""
from __future__ import annotations

import base64

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.ec import EllipticCurvePrivateKey

from .crypto_log import log_sign, log_verify

_ALG = "ECDSA P-256 / SHA3-256"


def ecdsa_sign(priv: EllipticCurvePrivateKey | str, message: bytes) -> str:
    if isinstance(priv, str):
        priv = serialization.load_pem_private_key(priv.encode(), password=None)

    sig_der = priv.sign(message, ec.ECDSA(hashes.SHA3_256()))
    sig_b64 = base64.b64encode(sig_der).decode()
    log_sign(_ALG, len(message), sig_b64, "firma sobre blob canónico")
    return sig_b64


def ecdsa_verify(pub_pem: str, message: bytes, sig_b64: str) -> bool:
    try:
        pub = serialization.load_pem_public_key(pub_pem.encode())
        pub.verify(base64.b64decode(sig_b64), message, ec.ECDSA(hashes.SHA3_256()))
        log_verify(_ALG, len(message), True, "verificación de firma")
        return True
    except (InvalidSignature, ValueError, TypeError):
        log_verify(_ALG, len(message), False, "verificación de firma")
        return False
