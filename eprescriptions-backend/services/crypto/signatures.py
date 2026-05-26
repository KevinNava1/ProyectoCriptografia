"""ECDSA P-256 + SHA3-256. Firma en DER → base64.

Por qué ECDSA y no RSA-PSS:
  - Llaves cortas (256 bits dan ~128 bits de seguridad simétrica equivalente,
    como RSA-3072 pero en una fracción del tamaño).
  - Firmas más cortas (~64 bytes vs ~256 bytes de RSA), importante porque las
    persistimos en cada receta, sello y acuse.
  - Operación de firma rapidísima.
La curva P-256 (secp256r1, NIST) está en cualquier librería seria y es la que
usa TLS por defecto.

SHA3-256 internamente: lo hacemos pasar el mensaje por SHA-3 antes de la firma.
Es importante que NO se separe — la librería integra hash + firma en una sola
llamada para evitar el clásico bug de "firmar el hash en vez del mensaje" o de
mezclar hashes distintos entre firmar y verificar.

Codificamos en DER (ASN.1) y luego base64 para transporte JSON. Cualquier byte
que entre por ahí debe salir por ahí — si re-codificamos a otro padding base64
o re-empaquetamos DER, la verificación se cae.
"""
from __future__ import annotations

import base64
import binascii

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.ec import EllipticCurvePrivateKey

from .crypto_log import log_sign, log_verify

_ALG = "ECDSA P-256 / SHA3-256"


def ecdsa_sign(priv: EllipticCurvePrivateKey | str, message: bytes) -> str:
    # Aceptamos tanto el objeto ya cargado como el PEM crudo. Útil porque a
    # veces ya tenemos el objeto (parseado del bundle) y otras veces solo el
    # texto del PEM (cargado desde disco o BD).
    if isinstance(priv, str):
        priv = serialization.load_pem_private_key(priv.encode(), password=None)

    sig_der = priv.sign(message, ec.ECDSA(hashes.SHA3_256()))
    sig_b64 = base64.b64encode(sig_der).decode()
    log_sign(_ALG, len(message), sig_b64, "firma sobre blob canónico")
    return sig_b64


def ecdsa_verify(pub_pem: str, message: bytes, sig_b64: str) -> bool:
    # Devuelve bool, no excepción: muchos call-sites quieren guardar el
    # resultado en `firma_ok=True/False` y mostrarlo en la UI sin que un
    # InvalidSignature haga 500.
    #
    # `validate=True` en b64decode: sin esto, Python descarta SILENCIOSAMENTE
    # cualquier char fuera del alfabeto base64 (whitespace, \n, !@#, etc.) —
    # un atacante podría inyectar basura en la firma persistida y la
    # decodificación seguiría dando los mismos bytes → verify pasaría. Con
    # validate=True cualquier char inválido levanta binascii.Error.
    try:
        pub = serialization.load_pem_public_key(pub_pem.encode())
        sig_bytes = base64.b64decode(sig_b64, validate=True)
        pub.verify(sig_bytes, message, ec.ECDSA(hashes.SHA3_256()))
        log_verify(_ALG, len(message), True, "verificación de firma")
        return True
    except (InvalidSignature, ValueError, TypeError, binascii.Error):
        log_verify(_ALG, len(message), False, "verificación de firma")
        return False
