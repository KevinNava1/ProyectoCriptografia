#!/usr/bin/env bash
# Apaga todos los contenedores de SecureRx (db + api + nginx).
# Uso: ./stop.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/eprescriptions-backend"

echo "▸ Apagando docker compose..."
(cd "$BACKEND" && docker compose down)
echo "✓ Backend apagado."
echo "  (Si arrancaste el frontend con start.sh, ya se cerró al hacer Ctrl+C.)"
