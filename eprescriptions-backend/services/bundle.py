"""Manejo del bundle PEM (EC + RSA) que los clientes envían en X-Priv-Keys.

El frontend nunca persiste estas llaves en el server: las sube en cada request
que las necesita (firma, descifrado, acuse). Aquí parseamos el bundle, validamos
que la llave que llega realmente pertenece al usuario logueado (deriva pub →
compara con la pub registrada en BD) y devolvemos los objetos listos para que
los servicios cripto los usen sin pensar en serialización.

Por qué la verificación de pertenencia importa: si me roban tu password pero no
tengo tus .pem, no debo poder firmar como tú. Esta capa es lo que cierra esa
puerta — el backend rechaza con 403 antes de tocar cualquier operación.
"""
from __future__ import annotations

import base64

from cryptography.hazmat.primitives import serialization
from fastapi import HTTPException

from services.crypto import parse_pem_bundle
from services.crypto.keys import pub_pem_from_priv


def _priv_to_pem(priv) -> str:
    # Re-serializa un objeto de llave a PEM PKCS8 sin cifrar. Lo necesitamos
    # cuando ya tenemos el objeto cargado (parseado desde el bundle) pero un
    # consumidor de más abajo espera el string PEM.
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
    """Extrae la EC del bundle y valida pertenencia (priv → pub derivada == pub en BD).

    Si el chequeo falla devolvemos 403 (no 401): el usuario está autenticado
    por JWT, simplemente la llave que adjunta no es suya.
    """
    ec_priv, _ = parse_pem_bundle(bundle_pem)
    if ec_priv is None:
        raise HTTPException(400, "Falta la llave EC privada en el bundle")
    if not pub_ec_registrada:
        # Usuario sin pub en BD = caso anómalo (no debería loggear), pero si
        # llega aquí lo cortamos con 403 explícito.
        raise HTTPException(403, "Usuario sin llave EC pública registrada")
    if pub_pem_from_priv(_priv_to_pem(ec_priv)).strip() != pub_ec_registrada.strip():
        raise HTTPException(403, "La llave privada no pertenece a este usuario")
    return ec_priv


def exigir_rsa(bundle_pem: str, pub_rsa_registrada: str | None):
    """Igual que `exigir_ec` pero para la RSA. Devuelve (priv_obj, priv_pem)
    porque el código de descifrado a veces necesita el PEM crudo (para volver
    a invocar `load_pem_private_key` desde otra librería)."""
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
    """Decodifica el bundle de la cabecera X-Priv-Keys.

    Los headers HTTP no admiten CR/LF en su valor (RFC 7230) y un PEM siempre
    los lleva, así que el frontend manda el bundle codificado en base64. Aún
    así toleramos PEM en claro por si alguien prueba con curl a mano.
    """
    if not x_priv_keys:
        raise HTTPException(401, "Falta cabecera X-Priv-Keys con tu llave privada")
    if "BEGIN" in x_priv_keys:
        return x_priv_keys
    try:
        return base64.b64decode(x_priv_keys).decode("utf-8")
    except Exception:
        raise HTTPException(400, "Cabecera X-Priv-Keys malformada (base64 del bundle PEM esperado)")
