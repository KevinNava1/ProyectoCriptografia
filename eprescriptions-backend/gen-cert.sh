#!/usr/bin/env bash
# Genera un certificado auto-firmado ECDSA P-256 para nginx (TLS 1.3 local).
# Reejecutable: regenera cert+key en certs/ con vigencia de 365 días.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p certs

openssl ecparam -genkey -name prime256v1 -out certs/key.pem 2>/dev/null

openssl req -new -x509 \
    -key certs/key.pem \
    -out certs/cert.pem \
    -days 365 \
    -subj "/CN=localhost/O=SecureRx/C=MX" \
    -addext "subjectAltName=DNS:localhost,DNS:127.0.0.1,IP:127.0.0.1" \
    2>/dev/null

chmod 600 certs/key.pem
chmod 644 certs/cert.pem

echo "✓ Certificado generado en certs/ (válido 365 días)"
echo "  - certs/cert.pem  (público)"
echo "  - certs/key.pem   (privado, chmod 600)"
