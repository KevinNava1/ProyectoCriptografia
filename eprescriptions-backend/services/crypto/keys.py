"""Generación y serialización de pares de llaves.

- ECDSA SecP256r1 (NIST P-256) — para firmas (spec §ECDSA_Sign).
- RSA 2048 bits, e=65537 — para envoltura de DEK con OAEP-SHA256.

El sistema entrega ambas llaves privadas al cliente UNA sola vez, concatenadas
como un bundle multi-PEM. El frontend ya las muestra como un único bloque de
texto, así no hay que cambiar el UI del paso de post-registro.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from cryptography.hazmat.primitives.asymmetric.ec import EllipticCurvePrivateKey, EllipticCurvePublicKey
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey, RSAPublicKey

from fastapi import HTTPException


@dataclass(frozen=True)
class ParClaves:
    priv_pem: str
    pub_pem: str


# ── Generadores ───────────────────────────────────────
def generar_par_ecdsa() -> ParClaves:
    priv = ec.generate_private_key(ec.SECP256R1())
    return ParClaves(
        priv_pem=_priv_to_pem(priv),
        pub_pem=_pub_to_pem(priv.public_key()),
    )


def generar_par_rsa() -> ParClaves:
    priv = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return ParClaves(
        priv_pem=_priv_to_pem(priv),
        pub_pem=_pub_to_pem(priv.public_key()),
    )


# ── Serialización PEM ──────────────────────────────────
def _priv_to_pem(priv) -> str:
    return priv.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()


def _pub_to_pem(pub) -> str:
    return pub.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()


# ── Bundle (EC + RSA en un solo string) ────────────────
def bundle_pem_privadas(priv_ec_pem: str, priv_rsa_pem: str) -> str:
    """Concatena PKCS8 EC + PKCS8 RSA como multi-PEM legible."""
    return priv_ec_pem.strip() + "\n" + priv_rsa_pem.strip() + "\n"


def parse_pem_bundle(bundle: str) -> Tuple[EllipticCurvePrivateKey | None, RSAPrivateKey | None]:
    """Extrae el par EC/RSA privado del bundle.

    Tolera recibir UNA sola llave (e.g. cuando el doctor sube solo su EC para
    firmar). Devuelve (ec_priv_or_None, rsa_priv_or_None).
    """
    if not bundle or "BEGIN" not in bundle:
        raise HTTPException(400, "Llave privada con formato PEM inválido")

    ec_priv: EllipticCurvePrivateKey | None = None
    rsa_priv: RSAPrivateKey | None = None

    # Fragmentamos por el delimitador PKCS8.
    blocks = _split_pem_blocks(bundle)
    if not blocks:
        raise HTTPException(400, "Llave privada con formato PEM inválido")

    for block in blocks:
        try:
            key = serialization.load_pem_private_key(block.encode(), password=None)
        except Exception:
            raise HTTPException(400, "Llave privada con formato PEM inválido")

        if isinstance(key, EllipticCurvePrivateKey):
            if not isinstance(key.curve, ec.SECP256R1):
                raise HTTPException(400, "Curva EC inválida: se requiere P-256")
            ec_priv = key
        elif isinstance(key, RSAPrivateKey):
            if key.key_size < 2048:
                raise HTTPException(400, "RSA inválida: se requiere mínimo 2048 bits")
            rsa_priv = key
        else:
            raise HTTPException(400, "Tipo de llave privada no soportado")

    return ec_priv, rsa_priv


def _split_pem_blocks(text: str) -> list[str]:
    blocks: list[str] = []
    current: list[str] = []
    inside = False
    for line in text.splitlines():
        if "BEGIN" in line:
            inside = True
            current = [line]
        elif "END" in line and inside:
            current.append(line)
            blocks.append("\n".join(current))
            inside = False
            current = []
        elif inside:
            current.append(line)
    return blocks


# ── Utilidades públicas ────────────────────────────────
def pub_pem_from_priv(priv_pem: str) -> str:
    """Deriva la llave pública PEM a partir de la privada (cualquier tipo)."""
    try:
        priv = serialization.load_pem_private_key(priv_pem.encode(), password=None)
    except Exception:
        raise HTTPException(400, "Llave privada con formato PEM inválido")
    return _pub_to_pem(priv.public_key())


def load_public_key_pem(pub_pem: str):
    return serialization.load_pem_public_key(pub_pem.encode())
