# SecureRx — Sistema de Recetas Electrónicas con Criptografía Real

Sistema de prescripciones médicas electrónicas con cifrado autenticado, firmas digitales y acuse no-repudiable de dispensación. Backend en FastAPI + MySQL detrás de nginx con **TLS 1.3 exclusivo**, frontend en React + Vite.

> Proyecto académico de Criptografía. Se evalúa por correctitud criptográfica y fidelidad al spec, no por features.

---

## Primitivas criptográficas

| Operación | Algoritmo | Uso |
|---|---|---|
| Firma de receta / sello / acuse / cancelación | **ECDSA P-256 + SHA3-256** | El hash es interno a ECDSA, no se separa. |
| Cifrado de la receta | **AES-128-GCM** (TAG 128 bits, IV 96 bits) | DEK aleatoria por receta. |
| Envoltura de la DEK por destinatario | **RSA-OAEP-SHA256** (MGF1-SHA256) | Una para el paciente y una por farmacia activa. |
| Hash de password | **Argon2id** (m=64MB, t=3, p=4, salt=32B) | Almacenado en BD; nunca password en claro. |
| Tokens de sesión | **JWT HS256**, exp=60 min, secret ≥32 chars | Validación de placeholder rechaza arranque. |
| Certificados | **X.509 v3** firmados por CA interna (SHA-256) | EC para firma, RSA para cifrado. |
| Transporte | **TLS 1.3** exclusivo (sin fallback a 1.2), HSTS | nginx termina TLS y proxea al api interno. |

**Llaves privadas: nunca se persisten en BD.** Se almacena solo la pública. Cuando el cliente sube su priv en una request, el server deriva la pub y compara.

---

## Roles y RBAC

| Rol | Capacidades |
|---|---|
| **admin** | Aprobar/suspender/rechazar solicitudes de certificado (§2). No emite ni dispensa recetas. |
| **medico** | Emitir receta nueva, sustituir por nueva versión, cancelar mientras esté `activa`/`en_proceso`. |
| **paciente** | Consultar sus recetas (las descifra con su RSA), firmar acuses de dispensación. |
| **farmaceutico** | Listar pendientes, dispensar (firma sello con su EC). Cualquier farmacia activa puede dispensar cualquier receta. |

---

## Flujo end-to-end

### 1. Registro (§1)
- Usuario manda `POST /usuarios/registro` con `username`, `nombre`, `email`, `password`, `rol`.
- Server genera dos pares de llaves (EC + RSA), hashea password con Argon2id, guarda **solo las pubs**, devuelve las priv al cliente UNA sola vez (descargables como `.pem`).
- Crea `solicitud_certificado` en estado `pendiente` y deja al usuario en estado `pendiente`. Login bloqueado.
- Envía correo de verificación (si SMTP está configurado).

### 2. Certificación (§2 — admin in the loop)
- Admin entra a `/admin/solicitudes` y ve la cola de pendientes.
- 3 acciones disponibles:
  - **Aprobar** → emite cert EC + cert RSA con la CA interna, activa la cuenta.
  - **Suspender** → bloquea login pero conserva username/email; revoca certs si los tenía.
  - **Rechazar** → borra al usuario; deja snapshot en `solicitudes_certificado` para evidencia. Bloqueado si el usuario ya tiene historial criptográfico (recetas, dispensaciones, etc.).

### 3. Login (§3)
- `POST /usuarios/login` con `username`, `password`, `rol`, `llave_privada_ec`, `llave_privada_rsa` (las dos últimas obligatorias salvo para admin).
- Server: Argon2id → rol → email verificado → estado activo → certs vigentes → **deriva pub desde cada priv y compara con la pub del registro**. Cualquier mismatch = 403, sin JWT.
- Si todo OK: JWT 60 min.

### 4. Emisión de receta (§4)
- Médico llena formulario (paciente con typeahead, medicamento, dosis, cantidad, `dispensaciones_permitidas`).
- `dispensaciones_permitidas == número de refills`. Es UN solo campo (cada dispensación es un refill).
- Server construye R canónico, lo firma con la EC del médico, cifra con AES-128-GCM, envuelve la DEK con RSA-OAEP del paciente y de cada farmacia activa, persiste.

### 5. Dispensación (§6)
- Farmacéutico ve `Pendientes`, dispensa con su bundle (EC + RSA).
- Server: descifra DEK con la RSA del farm, descifra R con AES-GCM (valida TAG), verifica firma del médico con su pub EC, **firma el sello** con la EC del farm.
- **Lock**: si la dispensación anterior aún tiene `firma_paciente=NULL`, devuelve 409. **No se permite dispensar de nuevo hasta que el paciente firme el acuse.**

### 6. Acuse del paciente
- El paciente entra a "Acuses" → ve sus recetas → escoge una → ve sus dispensaciones → firma cada acuse pendiente.
- La firma del paciente es ECDSA-SHA3 sobre el mismo `manifiesto_sello` que firmó la farmacia.
- Una vez firmado, la farmacia puede dispensar la siguiente.

### 7. Cancelación (§8) y Nueva versión (§9)
- Solo el médico emisor. Disponibles mientras la receta esté `activa`/`en_proceso` (no después de `dispensada_completa`).
- **Cancelar**: firma `M_cancel` con la EC, persiste en `cancelaciones`. La receta cifrada queda en BD para evidencia.
- **Nueva versión**: marca la original como `sustituida` (firma `M_cancel` con `motivo=sustituida_por_nueva_version`) y crea una nueva receta hija con `parent_id`.

### 8. Verificación de firmas
- Paciente entra a "Verificar firmas" → drill-down: receta → dispensación → resultado.
- La verificación es **por dispensación**, no por receta. Cada entrega pudo ser firmada por una farmacia distinta.
- Muestra: `cifrado_aes_gcm` (AAD coherente), firma del médico (vía AAD), firma del farm (`ecdsa_verify` directo sobre el sello), acuse del paciente.

---

## Estructura del repo

```
ProyectoCriptografia/
├── start.sh                        # arranque todo-en-uno (docker + nginx + frontend)
├── stop.sh                         # apaga docker compose
├── eprescriptions-backend/         # FastAPI + SQLAlchemy + MySQL
│   ├── main.py                     # arranque + bootstrap admin + CORS + routers
│   ├── database.py                 # modelos SQLAlchemy
│   ├── auth.py                     # auth_required / require_roles
│   ├── audit.py                    # append-only audit log
│   ├── reset_db.py                 # `python reset_db.py --confirm` borra todo
│   ├── smoke_test.py               # smoke end-to-end del flujo §1..§9
│   ├── docker-compose.yml          # db + api + nginx (TLS 1.3)
│   ├── nginx.conf                  # TLS 1.3 only, HSTS, headers de seguridad
│   ├── gen-cert.sh                 # genera cert auto-firmado ECDSA P-256 para nginx
│   ├── routers/                    # un router por flujo del spec
│   │   ├── usuarios.py             # §1 registro, §3 login, /buscar typeahead
│   │   ├── admin.py                # §2 admin in the loop
│   │   ├── recetas_crear.py        # §4
│   │   ├── recetas_consulta.py     # §5 + verificar-firmas legado
│   │   ├── recetas_dispensar.py    # §6 + lock + endpoints de acuse + verificar por evento
│   │   ├── recetas_cancelar.py     # §8
│   │   ├── recetas_nueva_version.py  # §9 (sustitución por nueva versión)
│   │   └── health.py               # / + /health + /ca/certificate
│   ├── schemas/                    # contratos Pydantic
│   ├── services/                   # cifrado, descifrado, bundle, canonical, hidratador
│   │   └── crypto/                 # ECDSA, RSA-OAEP, AES-GCM, Argon2, JWT, CA, keys
│   ├── scripts/
│   │   └── bootstrap_admin.py      # crea el admin inicial + escribe sus .pem
│   └── ca/                         # material persistente de la CA interna
│
├── eprescriptions-frontend/        # React 18 + Vite + Zustand + Tailwind
│   └── src/
│       ├── api/index.js            # axios + interceptors + endpoints
│       ├── store/useAuthStore.js   # sesión + bundle priv en memoria
│       ├── components/
│       │   ├── ui/                 # KeyFileInput, SessionKeyPicker, …
│       │   └── layout/             # Sidebar, Header, AppLayout
│       └── pages/
│           ├── Login.jsx           # login con file picker de las 2 .pem
│           ├── Registro.jsx
│           ├── Dashboard.jsx
│           ├── NuevaReceta.jsx     # con typeahead de paciente
│           ├── MisEmitidas.jsx     # médico: cancelar / nueva versión
│           ├── MisRecetas.jsx      # paciente
│           ├── Pendientes.jsx      # farm dispensa
│           ├── TicketsDispensacion.jsx  # acuses (paciente firma) / histórico
│           ├── Verificar.jsx       # drill-down por dispensación
│           └── AdminSolicitudes.jsx
│
├── prompt_maestro_rx_FINAL.md      # spec maestro (fuente de verdad)
└── README.md                       # este archivo
```

---

## Pre-requisitos

- **Docker** + **docker compose v2** (modo recomendado)
- **Node.js 18+** y npm (frontend)
- **openssl** (para generar el cert TLS auto-firmado)
- Para correr el backend sin Docker: **Python 3.12+** y **MySQL 8** local

Probado en Linux (Ubuntu); macOS y Windows-WSL deberían funcionar igual.

---

## Quick start (recomendado, con TLS 1.3)

```bash
git clone <repo> SecureRx
cd SecureRx
./start.sh
```

`start.sh` hace todo en cadena:

1. Verifica que `docker`, `docker compose`, `npm` y `openssl` estén instalados.
2. Genera un cert auto-firmado **ECDSA P-256** en `eprescriptions-backend/certs/` si no existe.
3. Crea `.env` desde `.env.example` con un `JWT_SECRET` aleatorio si falta.
4. Levanta `docker compose` (MySQL 8 + api FastAPI + nginx TLS 1.3).
5. Espera al healthcheck del api.
6. Verifica el handshake TLS 1.3 contra `https://localhost/health`.
7. `npm install` en el frontend si falta.
8. Arranca el frontend de Vite (`npm run dev`) en foreground.

**Ctrl+C** apaga el frontend Y el `docker compose` (vía trap).

Tras el arranque:

- Backend  → `https://localhost`           (TLS 1.3, vía nginx)
- Frontend → `http://localhost:5173`        (Vite dev server)
- API docs → `https://localhost/docs`

> **PRIMERA VEZ**: abre `https://localhost` en el navegador, clic en *Avanzado* → *Continuar a localhost*. Eso registra el cert auto-firmado para que el frontend pueda llamar al API.

Verifica TLS 1.3 desde otra terminal:

```bash
curl -v --tlsv1.3 -k https://localhost/health
```

### Apagar todo

```bash
./stop.sh           # baja docker compose
# Si arrancaste con start.sh, Ctrl+C ya cerró todo.
```

### Bootstrap del admin (con start.sh)

Si en `.env` hay `ADMIN_PASSWORD=...`, el contenedor del api lo bootstrappea solo en su primer arranque (idempotente). Las llaves del admin quedan dentro del volumen `ca-data` del contenedor — para extraerlas:

```bash
docker compose -f eprescriptions-backend/docker-compose.yml exec api ls -la /app/admin_keys
```

---

## Instalación manual (sin Docker)

Para hackear el backend con `--reload` directo desde el host.

### 1. Base de datos

```bash
mysql -u root -p <<EOF
CREATE DATABASE securerx CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'rxuser'@'localhost' IDENTIFIED BY 'changeme';
GRANT ALL PRIVILEGES ON securerx.* TO 'rxuser'@'localhost';
FLUSH PRIVILEGES;
EOF
```

### 2. Backend

```bash
cd eprescriptions-backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt

cp .env.example .env
# Edita .env: credenciales MySQL + JWT_SECRET (openssl rand -hex 32) + ADMIN_PASSWORD
nano .env

./venv/bin/python -c "from database import init_schema; init_schema(reset=False)"
```

### 3. Bootstrap del admin

Genera el primer admin y guarda sus `.pem`:

```bash
ADMIN_PASSWORD='admin123!' ./venv/bin/python -m scripts.bootstrap_admin
```

Pregunta interactivamente dónde guardar los 4 `.pem` (priv EC, priv RSA, pub EC, pub RSA). Enter usa `./admin_keys/`. Las priv quedan con `chmod 600`. **Guárdalas — no se vuelven a mostrar.**

Para automatizar (CI):

```bash
ADMIN_KEYS_DIR=/path/keys ADMIN_PASSWORD='…' ./venv/bin/python -m scripts.bootstrap_admin
```

### 4. Backend en foreground

```bash
ADMIN_PASSWORD='admin123!' ADMIN_USERNAME=admin \
  ./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 5. Frontend

```bash
cd ../eprescriptions-frontend
npm install
npm run dev
```

> En modo manual NO hay TLS — el frontend habla con `http://localhost:8000` directo. Para usar el cert TLS, levanta nginx con docker compose (o usa `start.sh`).

### Apagar uvicorn limpio

```bash
PID=$(lsof -ti tcp:8000 | head -1); [ -n "$PID" ] && kill "$PID"
```

> **No usar** `pkill -f uvicorn` — mata también al shell padre del comando.

---

## Smoke test (end-to-end automatizado)

Backend debe estar arriba (modo Docker o manual).

```bash
cd eprescriptions-backend
ADMIN_PASSWORD='Admin1234!' ADMIN_USERNAME=admin ./venv/bin/python smoke_test.py
```

Cubre: registro 3 roles → email autoverificado vía BD → admin aprueba → login con llaves → crear receta → paciente consulta → dispensar 1/2 → **lock 409** → paciente firma acuse → dispensar 2/2 → cancelar → nueva versión → RBAC negativos → admin suspende/aprueba/rechaza.

Salida esperada: `✔ Todos los pasos pasaron.`

> El smoke test marca el `email_verificado=True` directamente en BD para no depender de SMTP. En el flujo real el usuario hace clic en el link del correo.

---

## Variables de entorno (`.env`)

Copia desde `.env.example` y edita:

| Variable | Descripción | Obligatorio |
|---|---|---|
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | MySQL | Sí |
| `JWT_SECRET` | Secret HS256 (≥32 chars; placeholders rechazados al arranque) | Sí — `openssl rand -hex 32` |
| `JWT_EXPIRE_MINUTES` | Vigencia del JWT | No (default 60) |
| `CA_DIR` | Dónde persistir la CA interna | No (default `ca`) |
| `CORS_ORIGINS` | Whitelist separada por comas | No |
| `ADMIN_USERNAME` / `ADMIN_NOMBRE` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Bootstrap del primer admin | `ADMIN_PASSWORD` solo si quieres bootstrap automático |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` / `APP_URL` | Verificación de email + reset de password | No (sin SMTP, los correos se loggean y se omiten) |

---

## Operaciones comunes

### Reset completo de BD

```bash
cd eprescriptions-backend
./venv/bin/python reset_db.py --confirm
# Reinicia uvicorn / docker compose para que el bootstrap del admin vuelva a correr.
```

### Ver/inspeccionar la cadena de la CA interna

```bash
curl --tlsv1.3 -k https://localhost/ca/certificate     # con start.sh
curl http://localhost:8000/ca/certificate              # modo manual
```

### Cambiar la password del admin

El bootstrap es idempotente — si ya hay admin activo no lo toca. Para cambiar:

```bash
./venv/bin/python reset_db.py --confirm
# y vuelve a arrancar con el ADMIN_PASSWORD nuevo.
```

### Regenerar el cert TLS auto-firmado

```bash
rm -f eprescriptions-backend/certs/{cert,key}.pem
./eprescriptions-backend/gen-cert.sh
docker compose -f eprescriptions-backend/docker-compose.yml restart nginx
```

---

## Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| `pymysql.err.OperationalError: Unknown column …` | Schema desfasado del modelo. | `python reset_db.py --confirm` y reinicia. |
| Login del admin: `Usuario o contraseña incorrectos` | El admin nunca se bootstrappeó (faltó `ADMIN_PASSWORD`). | Reinicia con `ADMIN_PASSWORD='admin123!'` en el env. |
| Login: `Verifica tu email antes de iniciar sesión` | Usuario sin `email_verificado=True`. | Abre el link del correo, o si SMTP no está configurado, marca el flag a mano en BD. |
| Login: `Tu llave EC no coincide con la cuenta` | Subiste el `.pem` equivocado o de otro usuario. | Usa los `.pem` que descargaste al registrar ESE usuario. |
| Dispensar devuelve 409 "El paciente debe firmar el acuse…" | La dispensación anterior está pendiente de acuse. | El paciente entra a "Acuses", firma, y la farmacia puede continuar. |
| Browser bloquea `https://localhost` | Cert auto-firmado no aceptado. | *Avanzado* → *Continuar a localhost* (una sola vez). |
| `ERR_CERT_AUTHORITY_INVALID` permanente | El cert se regeneró tras aceptarlo. | Acepta de nuevo desde el navegador. |
| `RuntimeError: JWT_SECRET no configurado / placeholder` | El backend rechazó arrancar. | `openssl rand -hex 32 > /tmp/s && sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(cat /tmp/s)|" .env`. |
| `npm run dev` con CORS error | `CORS_ORIGINS` no incluye el origen del front. | Añade `https://localhost,http://localhost:5173` al `.env`. |

---

## Notas de seguridad

- **Llaves privadas en disco del cliente, jamás en la BD del servidor.** El backend las recibe en RAM solo durante el request y las descarta (best-effort scrub).
- **Validación de pertenencia en login** evita que un atacante con password robada (sin las llaves) obtenga JWT.
- **Lock de dispensación** garantiza que cada entrega tiene acuse no-repudiable del paciente antes de la siguiente.
- **CA interna** firma certs X.509 v3 con KeyUsage crítico y BasicConstraints `CA:FALSE` (los end-entity no pueden firmar otros certs).
- **Audit log** append-only registra cada acción crítica (registro, login, emisión, dispensación, acuse, cancelación, suspensión, rechazo).
- **TLS 1.3 only** (sin fallback a 1.2), HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.
- **JWT secret blindado** al arranque: rechaza placeholders conocidos, secretos < 32 chars y entropía aparente baja (< 8 caracteres únicos).
- **AAD bind**: el ciphertext está atado por GCM al `id_receta` + `id_doctor` + `id_paciente`. Mover el blob a otra fila rompe la verificación.

---

## Especificación canónica

`prompt_maestro_rx_FINAL.md` en la raíz del repo. Cualquier cambio que afecte al flujo §1..§12 debe respetarlo al pie de la letra. Si detectas que el código diverge del spec, es un bug.
