#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# SecureRx — arranque completo (backend + nginx TLS 1.3 + frontend)
# Uso: ./start.sh
# Apaga todo con Ctrl+C.
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/eprescriptions-backend"
FRONTEND="$ROOT/eprescriptions-frontend"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
info() { printf "${GREEN}▸${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}!${NC} %s\n" "$*"; }
fail() { printf "${RED}✗ %s${NC}\n" "$*" >&2; exit 1; }

# 1. Dependencias del host
info "Verificando dependencias del sistema..."
command -v docker >/dev/null  || fail "docker no instalado"
docker compose version >/dev/null 2>&1 || fail "docker compose v2 no disponible"
command -v npm >/dev/null     || fail "npm no instalado (instala Node 18+)"
command -v openssl >/dev/null || fail "openssl no instalado"

# 2. Certificado TLS para nginx (auto-firmado, ECDSA P-256)
if [[ ! -f "$BACKEND/certs/cert.pem" || ! -f "$BACKEND/certs/key.pem" ]]; then
    info "Generando certificado auto-firmado para TLS 1.3..."
    (cd "$BACKEND" && ./gen-cert.sh)
else
    info "Certificado TLS ya existe en $BACKEND/certs/ (regenera con ./eprescriptions-backend/gen-cert.sh)"
fi

# 3. .env del backend con JWT_SECRET fresco si falta
if [[ ! -f "$BACKEND/.env" ]]; then
    info "Creando $BACKEND/.env desde .env.example..."
    cp "$BACKEND/.env.example" "$BACKEND/.env"
    JWT_SECRET=$(openssl rand -hex 32)
    sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" "$BACKEND/.env" && rm -f "$BACKEND/.env.bak"
    warn ".env generado con JWT_SECRET aleatorio."
    warn "Define ADMIN_PASSWORD en $BACKEND/.env si quieres bootstrap automático del admin."
fi

# 4. Backend (api + db + nginx) en background
info "Levantando docker compose (db + api + nginx con TLS 1.3)..."
(cd "$BACKEND" && docker compose up -d --build)

# 5. Esperar al healthcheck del api
info "Esperando que el backend reporte healthy..."
ATTEMPTS=60
for ((i=1; i<=ATTEMPTS; i++)); do
    STATE=$(cd "$BACKEND" && docker compose ps --format json api 2>/dev/null | grep -o '"Health":"[^"]*"' | cut -d'"' -f4 || true)
    if [[ "$STATE" == "healthy" ]]; then
        info "Backend healthy."
        break
    fi
    if (( i == ATTEMPTS )); then
        warn "El backend tardó más de lo esperado. Revisa: docker compose -f $BACKEND/docker-compose.yml logs api"
    fi
    sleep 2
done

# 6. Probar handshake TLS 1.3 contra nginx
info "Verificando handshake TLS 1.3 contra https://localhost ..."
if curl -fsS --tlsv1.3 --tls-max 1.3 -k https://localhost/health -o /dev/null; then
    info "TLS 1.3 OK · respuesta de https://localhost/health válida"
else
    warn "No se pudo confirmar TLS 1.3 todavía (puede tomar unos segundos más)."
fi

# 7. Frontend deps
if [[ ! -d "$FRONTEND/node_modules" ]]; then
    info "Instalando dependencias del frontend (npm install)..."
    (cd "$FRONTEND" && npm install)
fi

# 8. Trap para apagar todo al Ctrl+C / EXIT
FRONT_PID=""
cleanup() {
    echo ""
    info "Apagando servicios..."
    if [[ -n "$FRONT_PID" ]] && kill -0 "$FRONT_PID" 2>/dev/null; then
        kill "$FRONT_PID" 2>/dev/null || true
        wait "$FRONT_PID" 2>/dev/null || true
    fi
    (cd "$BACKEND" && docker compose down) || true
    info "Listo."
}
trap cleanup INT TERM EXIT

# 9. Banner final
echo ""
printf "${BOLD}${GREEN}════════════════════════════════════════════════════════════════${NC}\n"
printf "${BOLD}  SecureRx levantado con TLS 1.3${NC}\n"
printf "${BOLD}${GREEN}════════════════════════════════════════════════════════════════${NC}\n"
echo "  Backend  →  https://localhost           (TLS 1.3 vía nginx)"
echo "  Frontend →  http://localhost:5173       (Vite dev server)"
echo "  API docs →  https://localhost/docs"
echo "  Adminer  →  http://localhost:8081       (GUI de la base de datos)"
echo ""
warn "PRIMERA VEZ: abre https://localhost en el navegador, clic en"
warn "  'Avanzado' → 'Continuar a localhost'. Esto registra el cert"
warn "  auto-firmado para que el frontend pueda llamar al API."
echo ""
echo "  Verificar TLS 1.3 en otra terminal:"
echo "    curl -v --tlsv1.3 -k https://localhost/"
echo ""
printf "${BOLD}Ctrl+C apaga frontend + docker compose.${NC}\n"
echo ""

# 10. Frontend en foreground
(cd "$FRONTEND" && npm run dev) &
FRONT_PID=$!
wait "$FRONT_PID"
