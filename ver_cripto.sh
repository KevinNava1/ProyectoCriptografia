#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# SecureRx — Inspector criptográfico desde terminal.
# Hace SELECT directo a MySQL y pinta los bytes crudos (ciphertext,
# IV, TAG, AAD, wraps RSA-OAEP, firmas ECDSA, SHA3) por receta.
#
# Uso:
#   ./ver_cripto.sh                 # snapshot único
#   ./ver_cripto.sh --watch 3       # refresca cada 3s
#   ./ver_cripto.sh --receta 12     # solo una receta
#   ./ver_cripto.sh --diff 11 12    # compara dos recetas
#   ./ver_cripto.sh --audit         # audit log §12
#
# Detecta automáticamente:
#   - si el backend corre en docker compose → ejecuta dentro del container `api`
#   - si tienes venv local con .env apuntando a MySQL → corre local
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/eprescriptions-backend"
COMPOSE="$BACKEND/docker-compose.yml"

# Si el container `api` está vivo, lo usamos.
if command -v docker >/dev/null 2>&1 \
   && docker compose -f "$COMPOSE" ps --services --filter "status=running" 2>/dev/null | grep -qx "api"; then
    exec docker compose -f "$COMPOSE" exec -T api \
        python -m scripts.inspeccionar_cripto "$@"
fi

# Fallback: venv local + .env del backend.
if [[ -d "$BACKEND/venv" ]]; then
    cd "$BACKEND"
    # shellcheck disable=SC1091
    source venv/bin/activate
    exec python -m scripts.inspeccionar_cripto "$@"
fi

echo " No encuentro ni el container 'api' corriendo ni un venv en $BACKEND/venv." >&2
echo "  Arranca el stack con ./start.sh o crea el venv:" >&2
echo "    cd eprescriptions-backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt" >&2
exit 1
