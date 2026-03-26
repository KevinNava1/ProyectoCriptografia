"""
keygen.py - Registro de usuarios y generación de claves ECDSA P-384
"""
import argparse
import os
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

CURVA = ec.SECP256R1()
ROLES = ("medico", "farmaceutico", "paciente")

def registrar(nombre: str, rol: str, directorio: str = "keys"):
    if rol not in ROLES:
        raise ValueError(f"Rol invalido: {rol}")
    os.makedirs(directorio, exist_ok=True)

    clave_privada = ec.generate_private_key(CURVA, default_backend())
    clave_publica = clave_privada.public_key()

    base = os.path.join(directorio, f"{rol}_{nombre}")

    with open(f"{base}_priv.pem", "wb") as f:
        f.write(clave_privada.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption()
        ))

    with open(f"{base}_pub.pem", "wb") as f:
        f.write(clave_publica.public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo
        ))

    nums = clave_privada.private_numbers()
    print(f"\n  Usuario: {nombre}  |  Rol: {rol}")
    print(f"  Curva:   P-384 (NIST SECP384R1)")
    print(f"  d  = {nums.private_value}")
    print(f"  Qx = {nums.public_numbers.x}")
    print(f"  Qy = {nums.public_numbers.y}")
    print(f"  Privada: {base}_priv.pem")
    print(f"  Publica: {base}_pub.pem")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--nombre", required=True)
    parser.add_argument("--rol",    required=True, choices=ROLES)
    args = parser.parse_args()
    registrar(args.nombre, args.rol)