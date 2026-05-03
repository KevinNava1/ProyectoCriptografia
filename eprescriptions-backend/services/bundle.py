"""Manejo del bundle PEM (EC + RSA) que los clientes envían en X-Priv-Keys."""
from __future__ import annotations

import base64

from cryptography.hazmat.primitives import serialization
from fastapi import HTTPException

from services.crypto import parse_pem_bundle
from services.crypto.keys import pub_pem_from_priv


def _priv_to_pem(priv) -> str:
    return priv.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()


def abrir(bundle_pem: str):
    """Devuelve (ec_priv, rsa_priv) — cualquiera puede ser None."""
    return parse_pem_bundle(bundle_pem)


def priv_ec_pem(ec_priv) -> str:
    return _priv_to_pem(ec_priv)


def priv_rsa_pem(rsa_priv) -> str:
    return _priv_to_pem(rsa_priv)


def exigir_ec(bundle_pem: str, pub_ec_registrada: str | None):
    """Extrae la EC del bundle y verifica que pertenece al usuario (priv → pub derivada == pub en BD)."""
    ec_priv, _ = parse_pem_bundle(bundle_pem)
    if ec_priv is None:
        raise HTTPException(400, "Falta la llave EC privada en el bundle")
    if not pub_ec_registrada:
        raise HTTPException(403, "Usuario sin llave EC pública registrada")
    if pub_pem_from_priv(_priv_to_pem(ec_priv)).strip() != pub_ec_registrada.strip():
        raise HTTPException(403, "La llave privada no pertenece a este usuario")
    return ec_priv


def exigir_rsa(bundle_pem: str, pub_rsa_registrada: str | None):
    """Extrae la RSA del bundle, verifica pertenencia y devuelve (priv_obj, priv_pem)."""
    _, rsa_priv = parse_pem_bundle(bundle_pem)
    if rsa_priv is None:
        raise HTTPException(400, "Falta la llave RSA privada en el bundle")
    if not pub_rsa_registrada:
        raise HTTPException(403, "Usuario sin llave RSA pública registrada")
    pem = _priv_to_pem(rsa_priv)
    if pub_pem_from_priv(pem).strip() != pub_rsa_registrada.strip():
        raise HTTPException(403, "La llave RSA no pertenece a este usuario")
    return rsa_priv, pem


def desde_header(x_priv_keys: str | None) -> str:
    # El cliente envía el bundle en base64 porque los headers no admiten CR/LF.
    # También aceptamos PEM en claro por compatibilidad.
    if not x_priv_keys:
        raise HTTPException(401, "Falta cabecera X-Priv-Keys con tu llave privada")
    if "BEGIN" in x_priv_keys:
        return x_priv_keys
    try:
        return base64.b64decode(x_priv_keys).decode("utf-8")
    except Exception:
        raise HTTPException(400, "Cabecera X-Priv-Keys malformada (base64 del bundle PEM esperado)")
