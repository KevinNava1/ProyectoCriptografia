"""
dispense.py - Verificación ECDSA y descifrado AES-256-GCM
"""
import json, base64
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidSignature

AES_KEY_PATH = "keys/server_aes.key"

def verificar(datos: dict, firma_b64: str, pub_pem: str) -> bool:
    """Verifica firma ECDSA. True si es válida, False si no."""
    clave = serialization.load_pem_public_key(pub_pem.encode())
    contenido = json.dumps(datos, sort_keys=True).encode()
    try:
        clave.verify(base64.b64decode(firma_b64), contenido, ec.ECDSA(hashes.SHA256()))
        return True
    except InvalidSignature:
        return False

def _load_key():
    with open(AES_KEY_PATH, "rb") as f:
        return f.read()

def descifrar(nonce: bytes, ciphertext: bytes, auth_tag: bytes) -> dict:
    """Descifra con AES-256-GCM. Lanza InvalidTag si fue alterado."""
    datos = AESGCM(_load_key()).decrypt(nonce, ciphertext + auth_tag, None)
    return json.loads(datos.decode())