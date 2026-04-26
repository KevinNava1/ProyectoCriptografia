# SecureRx — Sistema de Recetas Electrónicas con Criptografía Real

Sistema de prescripciones médicas electrónicas con cifrado autenticado, firmas digitales y acuse no-repudiable de dispensación. Backend en FastAPI + MySQL, frontend en React + Vite.

> Proyecto académico de Criptografía. Se evalúa por correctitud criptográfica y fidelidad al spec, no por features.

---

## Primitivas criptográficas

| Operación | Algoritmo | Uso |
|---|---|---|
| Firma de receta / sello / acuse / cancelación | **ECDSA P-256 + SHA3-256** | El hash es interno a ECDSA, no se separa. |
| Cifrado de la receta | **AES-256-GCM** (TAG 128, IV 96) | DEK aleatoria por receta. |
| Envoltura de la DEK por destinatario | **RSA-OAEP-SHA256** | Una para el paciente y una por farmacia activa. |
| Hash de password | **Argon2id** (m=64MB, t=3, p=4) | Almacenado en BD; nunca password en claro. |
| Tokens de sesión | **JWT HS256**, exp=60 min | |
| Certificados | **X.509 v3** firmados por CA interna (SHA-256 sobre la cadena del cert, no sobre el contenido del dominio) | EC para firma, RSA para cifrado. |

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

### 2. Certificación (§2 — admin in the loop)
- Admin entra a `/admin/solicitudes` y ve la cola de pendientes.
- 3 acciones disponibles:
  - **Aprobar** → emite cert EC + cert RSA con la CA interna, activa la cuenta.
  - **Suspender** → bloquea login pero conserva username/email; revoca certs si los tenía.
  - **Rechazar** → borra al usuario; deja snapshot en `solicitudes_certificado` para evidencia. Bloqueado si el usuario ya tiene historial criptográfico (recetas, dispensaciones, etc.).

### 3. Login (§3)
- `POST /usuarios/login` con `username`, `password`, `rol`, `llave_privada_ec`, `llave_privada_rsa` (las dos últimas obligatorias salvo para admin).
- Server: Argon2id → rol → estado activo → certs vigentes → **deriva pub desde cada priv y compara con la pub del registro**. Cualquier mismatch = 403, sin JWT.
- Si todo OK: JWT 60 min.

### 4. Emisión de receta (§4)
- Médico llena formulario (paciente con typeahead, medicamento, dosis, cantidad, `dispensaciones_permitidas`).
- `dispensaciones_permitidas == número de refills`. Es UN solo campo (cada dispensación es un refill).
- Server construye R canónico, lo firma con la EC del médico, cifra con AES-256-GCM, envuelve la DEK con RSA-OAEP del paciente y de cada farmacia activa, persiste.

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
├── eprescriptions-backend/        # FastAPI + SQLAlchemy + MySQL
│   ├── main.py                    # arranque + bootstrap admin + CORS + routers
│   ├── database.py                # modelos SQLAlchemy
│   ├── auth.py                    # auth_required / require_roles
│   ├── audit.py                   # append-only audit log
│   ├── reset_db.py                # `python reset_db.py --confirm` borra todo
│   ├── smoke_test.py              # smoke end-to-end del flujo §1..§9
│   ├── routers/                   # un router por flujo del spec
│   │   ├── usuarios.py            # §1 registro, §3 login, /buscar typeahead
│   │   ├── admin.py               # §2 admin in the loop
│   │   ├── recetas_crear.py       # §4
│   │   ├── recetas_consulta.py    # §5 + verificar-firmas legado
│   │   ├── recetas_dispensar.py   # §6 + lock + endpoints de acuse + verificar por evento
│   │   ├── recetas_cancelar.py    # §8
│   │   ├── recetas_nueva_version.py  # §9
│   │   └── health.py              # / + /health + /ca/certificate
│   ├── schemas/                   # contratos Pydantic
│   ├── services/                  # cifrado, descifrado, bundle, canonical, hidratador
│   │   └── crypto/                # ECDSA, RSA-OAEP, AES-GCM, Argon2, JWT, CA, keys
│   ├── scripts/
│   │   └── bootstrap_admin.py     # crea el admin inicial + escribe sus .pem
│   └── ca/                        # material persistente de la CA interna
│
├── eprescriptions-frontend/       # React 18 + Vite + Zustand + Tailwind
│   └── src/
│       ├── api/index.js           # axios + interceptors + endpoints
│       ├── store/useAuthStore.js  # sesión + bundle priv en memoria
│       ├── components/
│       │   ├── ui/                # KeyFileInput, SessionKeyPicker, …
│       │   └── layout/            # Sidebar, Header, AppLayout
│       └── pages/
│           ├── Login.jsx          # login con file picker de las 2 .pem
│           ├── Registro.jsx
│           ├── Dashboard.jsx
│           ├── NuevaReceta.jsx    # con typeahead de paciente
│           ├── MisEmitidas.jsx    # médico: cancelar / nueva versión
│           ├── MisRecetas.jsx     # paciente
│           ├── Pendientes.jsx     # farm dispensa
│           ├── TicketsDispensacion.jsx  # acuses (paciente firma) / histórico
│           ├── Verificar.jsx      # drill-down por dispensación
│           └── AdminSolicitudes.jsx
│
├── prompt_maestro_rx_FINAL.md     # spec maestro (fuente de verdad)
└── README.md                      # este archivo
```

---

## Pre-requisitos

- **Python 3.12+** (la venv del proyecto usa 3.12)
- **Node.js 18+** y npm
- **MySQL 8** corriendo localmente (o Docker)
- Linux (probado en Ubuntu); macOS y Windows-WSL deberían funcionar igual

---

## Instalación desde cero

### 1. Clonar y preparar BD

```bash
git clone <repo> SecureRx
cd SecureRx

# Crear BD y usuario en MySQL (ajusta credenciales a tu gusto):
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

# Venv + dependencias
python3 -m venv venv
./venv/bin/pip install -r requirements.txt

# Configura .env (copia el ejemplo y ajusta credenciales MySQL + JWT_SECRET)
cp .env.example .env
nano .env

# Inicializa el schema (crea las tablas):
./venv/bin/python -c "from database import init_schema; init_schema(reset=False)"
```

### 3. Bootstrap del admin

Genera el primer admin y guarda sus llaves como archivos `.pem`. **Solo corre la primera vez.**

```bash
ADMIN_PASSWORD='admin123!' ./venv/bin/python -m scripts.bootstrap_admin
```

Te pregunta interactivamente dónde guardar los 4 archivos `.pem` del admin (priv EC, priv RSA, pub EC, pub RSA). Enter usa `./admin_keys/`.

Para modo automatizado (Docker/CI): `ADMIN_KEYS_DIR=/path/keys ADMIN_PASSWORD='…' python -m scripts.bootstrap_admin`.

Las priv quedan con `chmod 600`. **Guárdalas — no se vuelven a mostrar.** Las usarás cada vez que el admin haga login en la UI.

### 4. Frontend

```bash
cd ../eprescriptions-frontend
npm install
```

---

## Cómo correr el proyecto

**Terminal 1 — Backend** (puerto 8000):

```bash
cd eprescriptions-backend
ADMIN_PASSWORD='admin123!' ADMIN_USERNAME=admin \
  ./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Frontend** (puerto 5173):

```bash
cd eprescriptions-frontend
npm run dev
```

Abre http://localhost:5173 → login con `admin` / `admin123!` (los `.pem` del admin no se requieren porque admin no opera con criptografía de dominio).

Para usuarios médico/paciente/farmacéutico: regístralos desde la UI, apruébalos como admin, luego login con sus dos `.pem` (EC y RSA) descargados al registrarse.

### Apagar uvicorn limpio

```bash
PID=$(lsof -ti tcp:8000 | head -1); [ -n "$PID" ] && kill "$PID"
```

> **No usar** `pkill -f uvicorn` — mata también al shell padre del comando.

---

## Smoke test (end-to-end automatizado)

Backend debe estar arriba.

```bash
cd eprescriptions-backend
ADMIN_PASSWORD='admin123!' ADMIN_USERNAME=admin ./venv/bin/python smoke_test.py
```

Cubre: registro 3 roles → admin aprueba → login con llaves → crear receta → paciente consulta → dispensar 1/2 → **lock 409** → paciente firma acuse → dispensar 2/2 → cancelar → nueva versión → RBAC negativos → admin suspende/aprueba/rechaza.

Salida esperada: `✔ Todos los pasos pasaron.`

---

## Operaciones comunes

### Reset completo de BD

```bash
cd eprescriptions-backend
./venv/bin/python reset_db.py --confirm
# Después reinicia uvicorn para que el bootstrap del admin vuelva a correr.
```

### Ver/inspeccionar la cadena de la CA interna

```bash
curl http://localhost:8000/ca/certificate
```

### Cambiar la password del admin

El bootstrap es idempotente — si ya hay admin activo no lo toca. Para cambiar password: `python reset_db.py --confirm` (borra todo) y vuelve a arrancar con el `ADMIN_PASSWORD` nuevo.

---

## Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| `pymysql.err.OperationalError: Unknown column …` | Schema desfasado del modelo. | `python reset_db.py --confirm` y reinicia uvicorn. |
| Login del admin: `Usuario o contraseña incorrectos` | El admin nunca se bootstrappeó (faltó `ADMIN_PASSWORD` al arrancar). | Reinicia uvicorn con `ADMIN_PASSWORD='admin123!'` en el env. |
| Login como paciente/médico: `Tu llave EC no coincide con la cuenta` | Subiste el `.pem` equivocado o de otro usuario. | Usa los `.pem` que descargaste al registrar ESE usuario. |
| Dispensar devuelve 409 "El paciente debe firmar el acuse…" | La dispensación anterior está pendiente de acuse. | El paciente entra a "Acuses", firma, y luego la farmacia puede continuar. |
| `npm run dev` con CORS error | `CORS_ORIGINS` en `.env` no incluye el origen del front. | Añade `http://localhost:5173,http://127.0.0.1:5173`. |
| Frontend no llega al backend | El proxy de Vite apunta a `localhost:8000` (`vite.config.js`). | Confirma que uvicorn escucha en `0.0.0.0:8000` o ajusta el proxy. |

---

## Notas de seguridad

- **Las llaves privadas viven en disco del cliente, jamás en la BD del servidor.** El backend las recibe en RAM solo durante el request y las descarta.
- **Validación de pertenencia en login** evita que un atacante con password robada (sin las llaves) obtenga JWT.
- **Lock de dispensación** garantiza que cada entrega tiene acuse no-repudiable del paciente antes de la siguiente.
- **CA interna** firma certs X.509 v3 con KeyUsage crítico y BasicConstraints `CA:FALSE` (los end-entity no pueden firmar otros certs).
- **Audit log** append-only registra cada acción crítica (registro, login, emisión, dispensación, acuse, cancelación, suspensión, rechazo).

---

## Especificación canónica

`prompt_maestro_rx_FINAL.md` en la raíz del repo. Cualquier cambio que afecte al flujo §1..§12 debe respetarlo al pie de la letra. Si detectas que el código diverge del spec, es un bug.
