"""Manejo de bundles PEM (EC + RSA) que los usuarios envían en su request.

El bundle es la concatenación textual de los dos bloques PEM privados (EC
primero, RSA después) emitidos durante el registro. Este módulo encapsula:

- parseo del bundle
- serialización a PEM
- verificación de que la llave privada pertenece al usuario autenticado
- decodificación del header `X-Priv-Keys` (que viaja base64 porque los headers
  HTTP no admiten CR/LF)

Ninguna llave privada cruza la frontera de este módulo en plano más de lo
necesario y NADA se persiste.
"""
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
    """Devuelve (ec_priv, rsa_priv) — cualquiera de los dos puede ser None."""
    return parse_pem_bundle(bundle_pem)


def priv_ec_pem(ec_priv) -> str:
    return _priv_to_pem(ec_priv)


def priv_rsa_pem(rsa_priv) -> str:
    return _priv_to_pem(rsa_priv)


def exigir_ec(bundle_pem: str, pub_ec_pem_registrada: str | None):
    """Extrae la EC del bundle y confirma que pertenece al usuario."""
    ec_priv, _ = parse_pem_bundle(bundle_pem)
    if ec_priv is None:
        raise HTTPException(400, "Falta la llave EC privada en el bundle")
    if not pub_ec_pem_registrada:
        raise HTTPException(403, "Usuario sin llave EC pública registrada")
    if pub_pem_from_priv(_priv_to_pem(ec_priv)).strip() != pub_ec_pem_registrada.strip():
        raise HTTPException(403, "La llave privada no pertenece a este usuario")
    return ec_priv


def exigir_rsa(bundle_pem: str, pub_rsa_pem_registrada: str | None):
    """Extrae la RSA del bundle, confirma pertenencia y la devuelve ya en PEM."""
    _, rsa_priv = parse_pem_bundle(bundle_pem)
    if rsa_priv is None:
        raise HTTPException(400, "Falta la llave RSA privada en el bundle")
    if not pub_rsa_pem_registrada:
        raise HTTPException(403, "Usuario sin llave RSA pública registrada")
    pem = _priv_to_pem(rsa_priv)
    if pub_pem_from_priv(pem).strip() != pub_rsa_pem_registrada.strip():
        raise HTTPException(403, "La llave RSA no pertenece a este usuario")
    return rsa_priv, pem


def desde_header(x_priv_keys: str | None) -> str:
    """Los headers HTTP no admiten CR/LF → el cliente envía el bundle en base64.
    Aceptamos también PEM en claro por retro-compat."""
    if not x_priv_keys:
        raise HTTPException(401, "Falta cabecera X-Priv-Keys con tu llave privada")
    if "BEGIN" in x_priv_keys:
        return x_priv_keys
    try:
        return base64.b64decode(x_priv_keys).decode("utf-8")
    except Exception:
        raise HTTPException(400, "Cabecera X-Priv-Keys malformada (base64 del bundle PEM esperado)")
