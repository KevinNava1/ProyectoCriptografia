"""RSA-OAEP-SHA256 — para "envolver" la DEK simétrica.

¿Por qué envolver? Porque AES es simétrico: si SOLO tuviéramos AES, el médico
tendría que compartir la DEK con paciente y farmacias por algún canal pre-
establecido. Inviable. La solución es el patrón de cifrado híbrido:

   plaintext → AES (rápido, una sola vez)
   DEK       → RSA-OAEP (lento pero asimétrico, una vez por destinatario)

Cada destinatario aporta su llave PÚBLICA. Ciframos la misma DEK con cada
una. El destinatario recupera la DEK con SU privada y luego descifra con AES.
Así N destinatarios pueden recibir el mismo mensaje sin compartir secretos
entre ellos.

Sobre OAEP (Optimal Asymmetric Encryption Padding):
  RSA "raw" o con padding PKCS#1 v1.5 son rompibles (ataques de Bleichenbacher,
  manipulación del padding, etc.). OAEP añade aleatoriedad y mezcla con MGF1,
  dejando el cifrado IND-CCA2 — que en humano significa "no se puede romper
  ni siquiera con un oráculo de descifrado limitado". Es el padding que se
  usa en cualquier sistema serio.

Hash: SHA-256 tanto para el digest interno como para el MGF1. Si cambias
uno, debe coincidir en quien descifra, o falla el unwrap.
"""
from __future__ import annotations

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey

from .crypto_log import log_rsa_unwrap, log_rsa_wrap


# label=None es el default OAEP — el destinatario debe descifrar con el mismo
# label (o también None) o el unwrap explota. Lo dejamos None y nos olvidamos.
_PADDING = padding.OAEP(
    mgf=padding.MGF1(algorithm=hashes.SHA256()),
    algorithm=hashes.SHA256(),
    label=None,
)


def rsa_oaep_encrypt(pub_pem: str, dek: bytes) -> bytes:
    """Cifra la DEK con la pública del destinatario. Devuelve el c_wrap (bytes).

    Con RSA-2048 el output siempre mide 256 bytes (igual que el módulo n).
    No depende del tamaño de la DEK porque OAEP rellena hasta el bloque.
    """
    pub = serialization.load_pem_public_key(pub_pem.encode())
    c_wrap = pub.encrypt(dek, _PADDING)
    log_rsa_wrap(len(dek), "envoltura de DEK para destinatario")
    return c_wrap


def rsa_oaep_decrypt(priv: RSAPrivateKey | str, ciphertext: bytes) -> bytes:
    """Recupera la DEK envuelta. `priv` puede ser objeto cargado o PEM string.

    Si el padding está corrupto, el OAEP no fue aplicado correctamente,
    o la priv no corresponde con la pub que cifró: lanza excepción.
    Cualquier fallo aquí lo manejamos arriba devolviendo un 400 GENÉRICO
    para no exponer oráculos.
    """
    if isinstance(priv, str):
        priv = serialization.load_pem_private_key(priv.encode(), password=None)
    try:
        dek = priv.decrypt(ciphertext, _PADDING)
    except Exception:
        log_rsa_unwrap(False, "recuperación de DEK")
        raise
    log_rsa_unwrap(True, "recuperación de DEK")
    return dek
