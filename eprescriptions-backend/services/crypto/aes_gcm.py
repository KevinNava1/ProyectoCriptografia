"""AES-128-GCM — el cifrado simétrico autenticado del cuerpo de la receta.

Aquí ciframos R (la receta canónica en bytes) y el resultado son tres cosas:
ciphertext, tag (16 B) e IV (12 B). Los tres son obligatorios al descifrar.

Reglas a respetar a rajatabla:

  1. Nunca, NUNCA reuses el par (key, iv) con dos plaintexts distintos. Eso
     rompe GCM por completo (recuperas el XOR de los plaintexts). Como cada
     receta tiene una DEK fresca y un IV fresco, en este sistema nunca pasa,
     pero el día que lo refactorices acuérdate de esto.

  2. El IV no es secreto, pero sí tiene que ser único para cada cifrado bajo
     la misma key. 12 B aleatorios alcanzan.

  3. El TAG no es opcional. Sin él, AES-GCM se degrada a un AES-CTR sin
     integridad — y AES-CTR sin MAC es fácilmente maleable: cualquiera puede
     flipear bits del ciphertext y al descifrar saldría plaintext modificado
     sin que se note nada.

GCM por dentro: AES en modo CTR para cifrar + GHASH (multiplicación en
GF(2^128)) para autenticar. El TAG de 16 B autentica de un solo golpe el
ciphertext, el AAD y el IV. Cualquier alteración → InvalidTag al descifrar.
"""
from __future__ import annotations

import secrets
from typing import Tuple

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .crypto_log import log_aes_decrypt, log_aes_encrypt


def new_dek() -> bytes:
    # 16 bytes = 128 bits → AES-128 (lo que pide la spec; no AES-256).
    # `secrets.token_bytes` usa el CSPRNG del sistema operativo
    # (getrandom() en Linux), que es el generador correcto para material
    # criptográfico. NO uses random.* — no es seguro.
    return secrets.token_bytes(16)


def new_iv() -> bytes:
    # 96 bits es el tamaño de IV "nativo" recomendado para GCM. Otros
    # tamaños obligan a la librería a hacer pasos extra y abren la puerta
    # a bugs sutiles. Con 96 bits aleatorios la probabilidad de colisión
    # solo se vuelve relevante después de ~2^32 mensajes con la misma
    # key — y aquí cada receta tiene su propia DEK, así que jamás aplica.
    return secrets.token_bytes(12)


def aes_gcm_encrypt(key: bytes, iv: bytes, plaintext: bytes, aad: bytes) -> Tuple[bytes, bytes]:
    """Cifra `plaintext` y autentica `aad`. Devuelve (ciphertext, tag).

    El AAD viaja en claro pero queda atado al tag — quien intente cambiar
    el AAD al descifrar (por ejemplo: mover el ciphertext a otra fila de la
    BD con otro id_receta) verá fallar la verificación del tag.
    """
    if len(key) != 16:
        raise ValueError("DEK debe ser de 128 bits (16 bytes)")
    if len(iv) != 12:
        raise ValueError("IV debe ser de 96 bits (12 bytes)")

    # AESGCM(...).encrypt() devuelve ciphertext + tag CONCATENADOS, con el
    # tag siempre al final (16 B fijos). Por eso lo partimos a mano:
    #   ct_tag[:-16] → todo menos los últimos 16  → ciphertext
    #   ct_tag[-16:] → los últimos 16             → tag
    # Lo guardamos por separado para que cada uno viva en su columna de BD.
    ct_tag = AESGCM(key).encrypt(iv, plaintext, aad)
    log_aes_encrypt(len(plaintext), len(aad), len(iv), "cifrado de receta R")
    return ct_tag[:-16], ct_tag[-16:]


def aes_gcm_decrypt(key: bytes, iv: bytes, ciphertext: bytes, tag: bytes, aad: bytes) -> bytes:
    """Descifra y verifica integridad. Lanza si algo no cuadra.

    Atómico: si el tag no coincide (por cualquier razón: ciphertext alterado,
    AAD alterado, IV alterado, key incorrecta), la librería lanza InvalidTag
    y NO devuelve plaintext parcial. Esa atomicidad es lo que evita que el
    descifrado actúe como oráculo (ej. el famoso "padding oracle" de CBC).
    """
    if len(key) != 16:
        raise ValueError("DEK debe ser de 128 bits (16 bytes)")
    if len(tag) != 16:
        raise ValueError("TAG debe ser de 128 bits (16 bytes)")

    # decrypt() espera ciphertext + tag re-concatenados (al revés del split
    # que hicimos en encrypt). Internamente recalcula GHASH y compara contra
    # el tag bit a bit en tiempo constante.
    try:
        pt = AESGCM(key).decrypt(iv, ciphertext + tag, aad)
    except Exception:
        log_aes_decrypt(len(ciphertext), len(aad), False, "descifrado de receta R")
        raise

    log_aes_decrypt(len(ciphertext), len(aad), True, "descifrado de receta R")
    return pt
