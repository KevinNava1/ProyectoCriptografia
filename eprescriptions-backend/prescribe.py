"""
prescribe.py - Firma ECDSA, hash SHA-256 y cifrado AES-256-GCM
"""
import os, json, base64, hashlib
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

AES_KEY_PATH = "keys/server_aes.key"

def firmar(datos: dict, priv_pem: str) -> str:
    """Firma un dict con ECDSA P-256 + SHA-256. Retorna firma en Base64."""
    clave = serialization.load_pem_private_key(priv_pem.encode(), password=None)
    contenido = json.dumps(datos, sort_keys=True).encode()
    firma = clave.sign(contenido, ec.ECDSA(hashes.SHA256()))
    return base64.b64encode(firma).decode()

def calcular_hash(receta: dict) -> str:
    """SHA-256 del contenido (excluye firmas y hash previo)."""
    campos = {k: v for k, v in receta.items()
              if k not in ("firma_medico", "firma_farmaceutico", "hash_sha256")}
    return hashlib.sha256(json.dumps(campos, sort_keys=True).encode()).hexdigest()

def _load_key():
    with open(AES_KEY_PATH, "rb") as f:
        return f.read()

def cifrar(receta: dict):
    """Cifra con AES-256-GCM. Retorna (nonce, ciphertext, auth_tag)."""
    nonce = os.urandom(12)
    ct_tag = AESGCM(_load_key()).encrypt(nonce, json.dumps(receta).encode(), None)
    return nonce, ct_tag[:-16], ct_tag[-16:]