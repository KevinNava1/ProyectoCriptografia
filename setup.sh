#!/bin/bash

# =============================================================
# Secure e-prescriptions — Script de instalación
# Uso: bash setup.sh
# =============================================================

echo ""
echo "=============================================="
echo " Secure e-prescriptions — Instalación"
echo "=============================================="

# ── Variables de configuración ────────────────────────────────

DB_NAME="eprescriptions"
DB_USER="eprescriptions_app"
DB_PASS="Eprescriptions1."
BACKEND_DIR="eprescriptions-backend"
FRONTEND_DIR="eprescriptions-frontend"

# ── 1. Verificar dependencias del sistema ─────────────────────

echo ""
echo "[1/7] Verificando dependencias del sistema..."

command -v python3 >/dev/null || { echo "ERROR: Python3 no instalado"; exit 1; }
command -v node    >/dev/null || { echo "ERROR: Node.js no instalado (instala con nvm: nvm install 22)"; exit 1; }
command -v npm     >/dev/null || { echo "ERROR: npm no instalado"; exit 1; }
command -v mysql   >/dev/null || { echo "ERROR: MySQL no instalado. Corre: sudo apt install mysql-server"; exit 1; }

echo "  ✓ Python3: $(python3 --version)"
echo "  ✓ Node:    $(node --version)"
echo "  ✓ npm:     $(npm --version)"
echo "  ✓ MySQL:   disponible"

# ── 2. Crear base de datos MySQL ──────────────────────────────

echo ""
echo "[2/7] Configurando MySQL..."
echo "  Se necesita la contraseña de root de MySQL:"

sudo mysql -u root << MYSQL_EOF
CREATE DATABASE IF NOT EXISTS ${DB_NAME}
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost'
IDENTIFIED BY '${DB_PASS}';

GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
MYSQL_EOF

echo "  ✓ Base de datos '${DB_NAME}' creada"
echo "  ✓ Usuario '${DB_USER}' configurado"

# ── 3. Configurar backend ─────────────────────────────────────

echo ""
echo "[3/7] Configurando backend..."

cd "$BACKEND_DIR"

# Entorno virtual
python3 -m venv venv
source venv/bin/activate

# Instalar dependencias
pip install --quiet fastapi uvicorn[standard] sqlalchemy pymysql \
cryptography python-jose[cryptography] passlib[bcrypt] \
python-multipart python-dotenv bcrypt pydantic[email]

echo "  ✓ Dependencias de Python instaladas"

# Crear carpeta de llaves
mkdir -p keys

# Generar llave AES-256 del servidor
if [ ! -f "keys/server_aes.key" ]; then
python3 -c "import os; open('keys/server_aes.key','wb').write(os.urandom(32))"
echo "  ✓ Llave AES-256 generada: keys/server_aes.key"
else
echo "  ✓ Llave AES-256 ya existe, no se sobreescribe"
fi

# Crear .env si no existe
if [ ! -f ".env" ]; then
JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
cat > .env << ENV_EOF
DB_HOST=localhost
DB_PORT=3306
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}
DB_NAME=${DB_NAME}

JWT_SECRET=${JWT_SECRET}
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60

AES_KEY_PATH=keys/server_aes.key
ENV_EOF
echo "  ✓ Archivo .env creado"
else
echo "  ✓ Archivo .env ya existe, no se sobreescribe"
fi

deactivate
cd ..

# ── 4. Configurar frontend ────────────────────────────────────

echo ""
echo "[4/7] Configurando frontend..."

cd "$FRONTEND_DIR"
npm install --silent
echo "  ✓ Dependencias de Node instaladas"
cd ..

# ── 5. Verificar conexión a BD ────────────────────────────────

echo ""
echo "[5/7] Verificando conexión a la base de datos..."

cd "$BACKEND_DIR"
source venv/bin/activate

python3 -c "
from sqlalchemy import create_engine
import os
from dotenv import load_dotenv
load_dotenv()
url = f\"mysql+pymysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}\"
try:
    engine = create_engine(url)
    engine.connect()
    print('  ✓ Conexión a MySQL exitosa')
except Exception as e:
    print(f'  ERROR: {e}')
    exit(1)
"

deactivate
cd ..

# ── 6. Crear tablas ───────────────────────────────────────────

echo ""
echo "[6/7] Creando tablas en la base de datos..."

cd "$BACKEND_DIR"
source venv/bin/activate

python3 -c "
from database import engine, Base
from database import Usuario, Receta
Base.metadata.create_all(bind=engine)
print('  ✓ Tablas creadas correctamente')
"

deactivate
cd ..

# ── 7. Resumen final ──────────────────────────────────────────

echo ""
echo "=============================================="
echo "  Instalación completada"
echo "=============================================="
echo ""
echo "  Para correr el proyecto necesitas 2 terminales:"
echo ""
echo "  Terminal 1 — Backend:"
echo "    cd ${BACKEND_DIR}"
echo "    source venv/bin/activate"
echo "    uvicorn main:app --reload"
echo ""
echo "  Terminal 2 — Frontend:"
echo "    cd ${FRONTEND_DIR}"
echo "    npm run dev"
echo ""
echo "  Frontend: http://localhost:5173"
echo "  API docs: http://localhost:8000/docs"
echo ""
echo "  IMPORTANTE: El archivo .env y la carpeta keys/"
echo "  NO están en el repositorio. Se generaron localmente."
echo "=============================================="