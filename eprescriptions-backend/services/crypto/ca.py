"""CA interna para emisión de certificados X.509 v3.

- Raíz self-signed (se crea on-first-boot).
- Clave privada de la CA **nunca** sale de `ca/` y **nunca** se devuelve al cliente.
- Emite dos certificados por usuario: uno para firma (EC) con KeyUsage=digitalSignature,
  nonRepudiation; uno para cifrado (RSA) con KeyUsage=keyEncipherment.

Spec §CA_Sign: X.509 v3, KeyUsage crítico, BasicConstraints CA=FALSE en subs.
"""
from __future__ import annotations

import datetime as dt
import os
from pathlib import Path
from typing import Literal

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID

CA_DIR = Path(os.getenv("CA_DIR", "ca"))
CA_KEY_PATH = CA_DIR / "ca_key.pem"
CA_CERT_PATH = CA_DIR / "ca_cert.pem"
CA_COMMON_NAME = "SecureRx Internal CA"


def _ensure_ca() -> tuple[ec.EllipticCurvePrivateKey, x509.Certificate]:
    """Crea la CA raíz la primera vez; en arranques posteriores la carga de disco."""
    CA_DIR.mkdir(parents=True, exist_ok=True)
    if CA_KEY_PATH.exists() and CA_CERT_PATH.exists():
        ca_key = serialization.load_pem_private_key(CA_KEY_PATH.read_bytes(), password=None)
        ca_cert = x509.load_pem_x509_certificate(CA_CERT_PATH.read_bytes())
        return ca_key, ca_cert

    # Raíz nueva. EC P-256 para firmar todos los certificados de usuario.
    ca_key = ec.generate_private_key(ec.SECP256R1())
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, CA_COMMON_NAME),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "SecureRx"),
        x509.NameAttribute(NameOID.COUNTRY_NAME, "MX"),
    ])
    now = dt.datetime.now(dt.timezone.utc)
    ca_cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(ca_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - dt.timedelta(minutes=5))
        .not_valid_after(now + dt.timedelta(days=3650))
        .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True, content_commitment=False,
                key_encipherment=False, data_encipherment=False,
                key_agreement=False, key_cert_sign=True, crl_sign=True,
                encipher_only=False, decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(x509.SubjectKeyIdentifier.from_public_key(ca_key.public_key()), critical=False)
        .sign(private_key=ca_key, algorithm=hashes.SHA256())
    )

    CA_KEY_PATH.write_bytes(
        ca_key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )
    CA_KEY_PATH.chmod(0o600)
    CA_CERT_PATH.write_bytes(ca_cert.public_bytes(serialization.Encoding.PEM))
    return ca_key, ca_cert


def ca_cert_pem() -> str:
    _, ca_cert = _ensure_ca()
    return ca_cert.public_bytes(serialization.Encoding.PEM).decode()


def emitir_cert(
    pub_pem: str,
    nombre: str,
    rol: str,
    uso: Literal["firma", "cifrado"],
    dias_validez: int = 365,
) -> tuple[str, str, dt.datetime]:
    """Emite un cert X.509 v3 firmado por la CA. Retorna (cert_pem, serial_hex, exp_utc)."""
    ca_key, ca_cert = _ensure_ca()
    pub = serialization.load_pem_public_key(pub_pem.encode())

    subject = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, nombre),
        x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, rol),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "SecureRx"),
    ])
    now = dt.datetime.now(dt.timezone.utc)
    serial = x509.random_serial_number()

    builder = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(ca_cert.subject)
        .public_key(pub)
        .serial_number(serial)
        .not_valid_before(now - dt.timedelta(minutes=5))
        .not_valid_after(now + dt.timedelta(days=dias_validez))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(x509.SubjectKeyIdentifier.from_public_key(pub), critical=False)
        .add_extension(
            x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_key.public_key()),
            critical=False,
        )
    )

    if uso == "firma":
        ku = x509.KeyUsage(
            digital_signature=True, content_commitment=True,
            key_encipherment=False, data_encipherment=False,
            key_agreement=False, key_cert_sign=False, crl_sign=False,
            encipher_only=False, decipher_only=False,
        )
    else:  # cifrado
        ku = x509.KeyUsage(
            digital_signature=False, content_commitment=False,
            key_encipherment=True, data_encipherment=False,
            key_agreement=False, key_cert_sign=False, crl_sign=False,
            encipher_only=False, decipher_only=False,
        )
    builder = builder.add_extension(ku, critical=True)

    cert = builder.sign(private_key=ca_key, algorithm=hashes.SHA256())
    return (
        cert.public_bytes(serialization.Encoding.PEM).decode(),
        f"{serial:x}",
        cert.not_valid_after_utc,
    )
