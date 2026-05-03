"""Logger visual del flujo criptográfico — solo para desarrollo.

Silenciar: export CRYPTO_LOG=0
"""
from __future__ import annotations

import os
import sys

_ENABLED = os.getenv("CRYPTO_LOG", "1") != "0"

RESET   = "\033[0m"
BOLD    = "\033[1m"
DIM     = "\033[2m"
CYAN    = "\033[36m"
GREEN   = "\033[32m"
YELLOW  = "\033[33m"
RED     = "\033[31m"
MAGENTA = "\033[35m"
BLUE    = "\033[34m"


def _box(title: str, lines: list[str], color: str = CYAN) -> None:
    if not _ENABLED:
        return
    bar = "━" * 68
    print(f"\n{color}{bar}{RESET}", file=sys.stderr)
    print(f"{color}  {BOLD}[CRYPTO]{RESET}{color} {title}{RESET}", file=sys.stderr)
    print(f"{color}{bar}{RESET}", file=sys.stderr)
    for line in lines:
        print(f"  {line}", file=sys.stderr)
    print(f"{color}{bar}{RESET}", file=sys.stderr)
    sys.stderr.flush()


def log_sign(algorithm: str, message_len: int, signature_b64: str, contexto: str = "") -> None:
    preview = signature_b64[:40] + "…" if len(signature_b64) > 40 else signature_b64
    _box(
        f"FIRMA · {algorithm}",
        [
            f"{BOLD}Contexto:{RESET}   {contexto or '—'}",
            f"{BOLD}Mensaje:{RESET}    {message_len} bytes",
            f"{BOLD}Salida:{RESET}     {preview}",
            f"{DIM}            (DER → base64){RESET}",
        ],
        MAGENTA,
    )


def log_verify(algorithm: str, message_len: int, ok: bool, contexto: str = "") -> None:
    color = GREEN if ok else RED
    estado = f"{BOLD}VÁLIDA ✓{RESET}" if ok else f"{BOLD}INVÁLIDA ✗{RESET}"
    _box(
        f"VERIFICACIÓN · {algorithm}",
        [
            f"{BOLD}Contexto:{RESET}   {contexto or '—'}",
            f"{BOLD}Mensaje:{RESET}    {message_len} bytes",
            f"{BOLD}Resultado:{RESET}  {color}{estado}{RESET}",
        ],
        color,
    )


def log_aes_encrypt(plaintext_len: int, aad_len: int, iv_len: int, contexto: str = "") -> None:
    _box(
        "CIFRADO · AES-128-GCM",
        [
            f"{BOLD}Contexto:{RESET}   {contexto or '—'}",
            f"{BOLD}Plaintext:{RESET}  {plaintext_len} bytes",
            f"{BOLD}AAD:{RESET}        {aad_len} bytes",
            f"{BOLD}IV:{RESET}         {iv_len} bytes",
            f"{BOLD}TAG:{RESET}        16 bytes",
        ],
        YELLOW,
    )


def log_aes_decrypt(ciphertext_len: int, aad_len: int, ok: bool, contexto: str = "") -> None:
    color = GREEN if ok else RED
    estado = f"{BOLD}TAG OK ✓{RESET}" if ok else f"{BOLD}TAG FALLÓ ✗{RESET}"
    _box(
        "DESCIFRADO · AES-128-GCM",
        [
            f"{BOLD}Contexto:{RESET}   {contexto or '—'}",
            f"{BOLD}Ciphertext:{RESET} {ciphertext_len} bytes",
            f"{BOLD}AAD:{RESET}        {aad_len} bytes",
            f"{BOLD}Resultado:{RESET}  {color}{estado}{RESET}",
        ],
        color,
    )


def log_rsa_wrap(dek_len: int, contexto: str = "") -> None:
    _box(
        "RSA-OAEP · WRAP",
        [
            f"{BOLD}Contexto:{RESET}   {contexto or '—'}",
            f"{BOLD}Padding:{RESET}    OAEP / SHA-256 / MGF1-SHA-256",
            f"{BOLD}DEK:{RESET}        {dek_len} bytes → C_wrap",
        ],
        CYAN,
    )


def log_rsa_unwrap(ok: bool, contexto: str = "") -> None:
    color = GREEN if ok else RED
    estado = f"{BOLD}DEK recuperada ✓{RESET}" if ok else f"{BOLD}Fallo de unwrap ✗{RESET}"
    _box(
        "RSA-OAEP · UNWRAP",
        [
            f"{BOLD}Contexto:{RESET}   {contexto or '—'}",
            f"{BOLD}Padding:{RESET}    OAEP / SHA-256 / MGF1-SHA-256",
            f"{BOLD}Resultado:{RESET}  {color}{estado}{RESET}",
        ],
        color,
    )


def banner_flow(flow: str, descripcion: str) -> None:
    if not _ENABLED:
        return
    bar = "═" * 68
    print(f"\n{BOLD}{BLUE}{bar}{RESET}", file=sys.stderr)
    print(f"{BOLD}{BLUE}  ▶ FLUJO CRIPTOGRÁFICO — {flow}{RESET}", file=sys.stderr)
    print(f"{BOLD}{BLUE}    {descripcion}{RESET}", file=sys.stderr)
    print(f"{BOLD}{BLUE}{bar}{RESET}", file=sys.stderr)
    sys.stderr.flush()


def step(flow: str, n: int, descripcion: str) -> None:
    if not _ENABLED:
        return
    print(f"  {BOLD}{BLUE}[{flow} · paso {n}]{RESET} {descripcion}", file=sys.stderr)
    sys.stderr.flush()
