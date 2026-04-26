"""Endpoints de salud y exposición del certificado público de la CA."""
from fastapi import APIRouter

from services.crypto.ca import ca_cert_pem

router = APIRouter(tags=["health"])


@router.get("/")
def root():
    return {"status": "ok", "api": "SecureRx", "version": "2.0"}


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/ca/certificate")
def get_ca_certificate():
    """Sirve la cadena pública de la CA interna para que clientes validen."""
    return {"pem": ca_cert_pem()}
