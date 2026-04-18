"""
keygen.py - Generación de llaves ECDSA P-256 (NIST SECP256R1)
"""
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

CURVA = ec.SECP256R1()

def generar_par_llaves():
    """Genera un par de llaves ECDSA P-256. Retorna (priv_pem, pub_pem)."""
    priv = ec.generate_private_key(CURVA, default_backend())
    pub  = priv.public_key()
    priv_pem = priv.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption()
    ).decode()
    pub_pem = pub.public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode()
    return priv_pem, pub_pem