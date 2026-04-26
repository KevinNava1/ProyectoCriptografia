"""Primitivas criptográficas del sistema — NIST/FIPS/RFC.

Todas las operaciones sensibles (firma, cifrado, derivación) se exponen aquí
para que el resto del código no toque directamente la librería `cryptography`.
"""
from .canonical import canonical_json, canonical_bytes
from .keys import generar_par_ecdsa, generar_par_rsa, bundle_pem_privadas, parse_pem_bundle
from .signatures import ecdsa_sign, ecdsa_verify
from .aes_gcm import aes_gcm_encrypt, aes_gcm_decrypt, new_dek, new_iv
from .rsa_oaep import rsa_oaep_encrypt, rsa_oaep_decrypt
from .argon2_pw import hash_password, verify_password
from .jwt_service import sign_jwt, verify_jwt
