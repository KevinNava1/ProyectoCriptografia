# PROMPT MAESTRO — SECURE e-PRESCRIPTIONS FRONTEND
## Backend: FastAPI + MySQL + AES-256-GCM + ECDSA P-256 + SHA-256

---

### CONTEXTO DEL PROYECTO

Tengo un sistema de recetas médicas electrónicas seguras con criptografía real.
El backend está **100% terminado en FastAPI (Python) y NO debe modificarse**.
Tu trabajo es construir el **frontend completo** desde cero consumiendo exactamente
las rutas que te describo abajo.

**Criptografía real implementada en el backend:**
- **AES-256-GCM** — cifrado simétrico de recetas (nonce + ciphertext + auth_tag)
- **ECDSA P-256 + SHA-256** — firma digital del médico y del farmacéutico
- **SHA-256** — hash de integridad de cada receta
- **bcrypt** — hash de contraseñas de usuarios
- Las llaves privadas RSA/ECDSA se generan al registrar médicos y farmacéuticos
  y **solo se muestran una vez** — el usuario debe guardarlas

**Base URL del backend:** `http://localhost:8000`
(guardar en `.env` como `VITE_API_URL=http://localhost:8000`)

---

### ENDPOINTS REALES DEL BACKEND

```
GET  /
     → { status: "ok", api: "Secure e-prescriptions" }

POST /usuarios/registro
     Body: { nombre, email, password, rol: "medico"|"paciente"|"farmaceutico" }
     Response 201: { id, nombre, email, rol, llave_privada? }
     CRÍTICO: llave_privada solo se devuelve aquí, una sola vez.
              Médicos y farmacéuticos DEBEN copiarla antes de continuar.

GET  /recetas/paciente/{paciente_id}
     Response: lista de RecetaDescifrada[]
     Cada receta: { id, medico_id, paciente_id, fecha, medicamento, dosis,
                    cantidad, instrucciones, estado, hash_sha256, firma_medico }

GET  /recetas/pendientes
     Response: lista de recetas con estado "emitida" (para farmacéuticos)

POST /recetas?medico_id={id}
     Body: { paciente_id, medicamento, dosis, cantidad, instrucciones,
             llave_privada_medico }
     Response 201: { id, medico_id, paciente_id, estado, hash_sha256 }
     NOTA: el médico debe pegar su llave privada para firmar con ECDSA

POST /recetas/{receta_id}/dispensar
     Body: { farmaceutico_id, llave_privada_farmaceutico }
     Response: { mensaje, receta_id, estado, verificaciones: {
                   integridad_sha256, firma_medico_ecdsa, firma_farmaceutico } }
     NOTA: el backend verifica AES-GCM + SHA-256 + ECDSA antes de dispensar
```

**No existe endpoint de login JWT.** La autenticación es por rol/ID manual
(el sistema asume que el usuario conoce su ID y llave privada).
Implementa un "login simulado" en el frontend que guarde en localStorage:
`{ id, nombre, email, rol, llave_privada }` — la llave privada solo si el
usuario la pegó al registrarse.

---

### OBJETIVO DE DISEÑO

Crear un frontend que parezca construido por un equipo senior de HealthTech.
Dark medical futuristic. Seguridad visible. Animaciones con propósito.
Cada pantalla debe transmitir que los datos médicos están protegidos con
criptografía de nivel profesional.

---

### STACK TÉCNICO

- **React 18 + Vite**
- **TailwindCSS** (con config extendida para la paleta personalizada)
- **Framer Motion** — transiciones de página y micro-interacciones
- **React Three Fiber + @react-three/drei** — elementos 3D decorativos
- **React Router v6** — routing con transiciones animadas
- **Axios** — peticiones HTTP con interceptores
- **Zustand** — estado global (usuario logueado, llave privada en sesión)
- **Sonner o React Hot Toast** — notificaciones elegantes
- **Lucide React** — iconografía
- **Google Fonts**: Syne (headings) + DM Sans (body) + JetBrains Mono (hashes/llaves)

---

### PALETA DE COLORES

```css
--bg-primary:    #0A0E1A   /* fondo principal */
--bg-secondary:  #0F1628   /* cards, panels */
--bg-tertiary:   #161D35   /* inputs, hover states */
--cyan:          #00D4FF   /* primario, CTAs, highlights */
--violet:        #7C3AED   /* secundario, badges */
--emerald:       #10B981   /* éxito, "firmada", "válida" */
--amber:         #F59E0B   /* advertencias */
--red:           #EF4444   /* errores, revocada */
--text-primary:  #F0F6FF
--text-secondary:#8892A4
--border:        rgba(255,255,255,0.08)
--glass:         rgba(255,255,255,0.04)
```

---

### ELEMENTOS 3D (React Three Fiber)

**1. Login Background 3D**
Una molécula animada (esferas conectadas por líneas) rotando lentamente.
Usa `<mesh>` con `sphereGeometry` para nodos y `<Line>` de drei para
conexiones. Color cyan con emissive glow sutil. Fondo completamente oscuro.

**2. Dashboard Background**
Red de partículas flotantes conectadas (estilo "data network") como canvas
de fondo. Puntos pequeños blancos/cyan que se mueven lento y forman líneas
al acercarse. Implementar con `useFrame` y geometría de puntos.

**3. Escudo 3D en Header**
Icono de escudo 3D que rota levemente (-15° a +15°) al hacer hover.
Usar `<TorusKnot>` o geometría personalizada con material cyan metálico.

**4. Card Flip 3D para Recetas**
Al ver el detalle de una receta, mostrar una tarjeta 3D que:
- Anverso: datos de la receta (medicamento, dosis, paciente)
- Reverso: hash SHA-256 + firma ECDSA en formato monospace
- Click o botón "Ver firma" triggerea el flip con rotateY 180°
- Usar CSS 3D transform o implementar con Framer Motion `rotateY`

**5. Animación de Dispensado**
Cuando se dispensa exitosamente una receta: partículas verdes explotan
desde el centro + sello que cae (scaleY desde 0 + bounce) + texto
"DISPENSADA" con efecto glitch que se estabiliza.

Todos los elementos 3D deben tener fallback 2D si WebGL no está disponible.

---

### ANIMACIONES (Framer Motion)

**Transiciones de página:**
```js
// Usar en cada ruta
const pageVariants = {
  initial: { opacity: 0, y: 20, filter: "blur(8px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)",
             transition: { duration: 0.45, ease: "easeOut" } },
  exit:    { opacity: 0, y: -10, filter: "blur(4px)",
             transition: { duration: 0.25 } }
}
```

**Stagger al cargar listas:**
```js
const container = { animate: { transition: { staggerChildren: 0.07 } } }
const item = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35 } }
}
```

**Cards hover:**
- `whileHover={{ y: -4, boxShadow: "0 20px 40px rgba(0,212,255,0.15)" }}`
- `whileTap={{ scale: 0.98 }}`

**Botones CTA:**
- `whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(0,212,255,0.4)" }}`
- `whileTap={{ scale: 0.96 }}`

**Sidebar nav indicator:**
- Usar `layoutId="nav-indicator"` en Framer Motion para que el indicador
  de ruta activa se deslice fluidamente entre items

**Inputs focus:**
- Border animated que pasa de `--border` a `--cyan` con transición 200ms
- Pequeño glow cyan exterior al estar enfocado

**Números/stats:**
- `AnimatedCounter` que cuenta desde 0 hasta el valor real al aparecer
  en pantalla (usar Intersection Observer + framer-motion `animate`)

---

### PÁGINAS Y COMPONENTES

#### Página 1: REGISTRO / ONBOARDING
**Ruta:** `/registro`

Wizard de 2 pasos animado:
- Paso 1: Formulario con nombre, email, password, selector de rol
  (cards seleccionables: Médico / Paciente / Farmacéutico con iconos 3D)
- Paso 2 (solo médico/farmacéutico): Pantalla de "TU LLAVE PRIVADA"
  - Mostrar la llave privada recibida del backend en caja monospace
  - Warning GRANDE animado: "Esta llave solo se muestra una vez"
  - Botón "Copiar llave" con feedback visual + checkbox "Confirmé que la guardé"
  - No avanzar hasta que el checkbox esté marcado
- Para pacientes: redirect directo al login tras registro

POST `/usuarios/registro` → mostrar llave_privada si rol médico/farmacéutico

---

#### Página 2: LOGIN SIMULADO
**Ruta:** `/` o `/login`

- Fondo: molécula 3D animada
- Campos: ID de usuario + contraseña (solo para UI, no hay JWT real)
- Si es médico o farmacéutico: campo adicional "Pegar llave privada"
  con textarea monospace que valida que tenga formato PEM
- Al "iniciar sesión": hacer GET /recetas/pendientes o similar para
  verificar que el backend responde, luego guardar en Zustand + localStorage
- Transición de salida: la molécula 3D se "colapsa" hacia el centro

---

#### Página 3: DASHBOARD
**Ruta:** `/dashboard`

- Header con escudo 3D + nombre del usuario + rol badge + botón logout
- Sidebar izquierdo con nav animado (layoutId indicator)
- Fondo: red de partículas sutil

**Cards KPI** (AnimatedCounter):
- Total de recetas (según rol)
- Recetas emitidas/pendientes
- Recetas dispensadas
- Estado criptográfico: "Sistema seguro — AES-256-GCM activo" con dot verde pulsante

**Lista reciente de recetas** (últimas 5):
- Cada item como card con: medicamento, paciente/médico ID, fecha, StatusChip

**Accesos rápidos según rol:**
- Médico: "Nueva Receta" (botón CTA grande)
- Farmacéutico: "Ver Pendientes" (badge con contador)
- Paciente: "Mis Recetas"

---

#### Página 4: MIS RECETAS (Paciente)
**Ruta:** `/mis-recetas`

GET `/recetas/paciente/{paciente_id}`

- Grid de RecetaCards con stagger animation
- Cada card muestra: medicamento, dosis, fecha, estado chip
- Botón "Ver detalle" → abre modal con card flip 3D
  - Anverso: todos los datos de la receta
  - Reverso: hash SHA-256 (CryptoHash component) + firma ECDSA del médico
- Filtros animados: Todas / Emitidas / Dispensadas
- Estado vacío: ilustración SVG de receta + mensaje animado

---

#### Página 5: EMITIR RECETA (Médico)
**Ruta:** `/nueva-receta`

POST `/recetas?medico_id={id}`

Formulario multi-step con progress bar animada:

**Paso 1 — Paciente:**
- Input de ID del paciente con validación
- Preview de "Paciente #ID" al escribir

**Paso 2 — Medicamento:**
- Campos: medicamento (text), dosis (text), cantidad (number), instrucciones (textarea)
- Validación en tiempo real con mensajes animados

**Paso 3 — Firma Criptográfica:**
- Resumen de la receta en card glassmorphism
- Textarea monospace: "Pega tu llave privada ECDSA para firmar"
- Indicador visual: escudo con animación "verificando..." al hacer submit
- Animación de "firmando": partículas que convergen al centro + sello

**Paso 4 — Confirmación:**
- Animación de éxito (sello + confeti verde)
- Mostrar: ID de receta, hash SHA-256, estado
- Botón "Nueva receta" y "Ver mis recetas emitidas"

---

#### Página 6: RECETAS PENDIENTES (Farmacéutico)
**Ruta:** `/pendientes`

GET `/recetas/pendientes`

- Lista de recetas con estado "emitida" listas para dispensar
- Cada card: medicamento, dosis, ID médico, ID paciente, fecha, hash
- Botón "Dispensar" → abre modal de confirmación:
  - Muestra detalles de la receta
  - Input de ID del farmacéutico (pre-rellenado)
  - Textarea: "Pega tu llave privada para sellar el dispensado"
  - Al confirmar: animación de verificación (3 checks secuenciales animados):
    1. "Verificando integridad SHA-256..." ✓
    2. "Verificando firma ECDSA del médico..." ✓  
    3. "Sellando con tu firma..." ✓
  - Toast de éxito o error con mensaje del backend

POST `/recetas/{receta_id}/dispensar`

---

### COMPONENTES REUTILIZABLES

```
<SecureCard />       — card glassmorphism con border cyan sutil
<CryptoHash />       — hash truncado (primeros 8 + ... + últimos 8 chars)
                       en monospace cyan, botón copiar, tooltip con hash completo
<SignatureBadge />   — badge "✓ Firmada ECDSA" verde animado o "⚠ Sin firma" amber
<StatusChip />       — chips: emitida (cyan) / dispensada (verde) / revocada (rojo)
                       con dot pulsante para "emitida"
<RxCard3D />         — tarjeta con flip 3D (anverso datos, reverso firma+hash)
<PageTransition />   — wrapper Framer Motion para cada página
<AnimatedCounter />  — número que cuenta animado al entrar en viewport
<PrivKeyInput />     — textarea monospace para pegar llave privada PEM
                       con validación de formato y botón limpiar
<VerificationSteps /> — los 3 checks animados secuenciales del dispensado
<LoadingPulse />     — skeleton loader con forma del contenido que va a cargar
<EmptyState />       — ilustración SVG + mensaje cuando no hay datos
<Modal />            — modal con entrada en perspectiva 3D (scaleY desde 0.8)
```

---

### ARCHIVO src/api/index.js

```js
import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL })

export const usuariosAPI = {
  registrar: (datos) => api.post('/usuarios/registro', datos),
}

export const recetasAPI = {
  crear:           (medicoId, datos) => api.post(`/recetas?medico_id=${medicoId}`, datos),
  porPaciente:     (pacienteId)      => api.get(`/recetas/paciente/${pacienteId}`),
  pendientes:      ()                => api.get('/recetas/pendientes'),
  dispensar:       (recetaId, datos) => api.post(`/recetas/${recetaId}/dispensar`, datos),
}
```

---

### ESTRUCTURA DE CARPETAS ESPERADA

```
eprescriptions-frontend/
├── src/
│   ├── api/
│   │   └── index.js
│   ├── components/
│   │   ├── 3d/
│   │   │   ├── MoleculeBackground.jsx
│   │   │   ├── ParticleNetwork.jsx
│   │   │   └── Shield3D.jsx
│   │   ├── ui/
│   │   │   ├── SecureCard.jsx
│   │   │   ├── CryptoHash.jsx
│   │   │   ├── SignatureBadge.jsx
│   │   │   ├── StatusChip.jsx
│   │   │   ├── RxCard3D.jsx
│   │   │   ├── AnimatedCounter.jsx
│   │   │   ├── PrivKeyInput.jsx
│   │   │   ├── VerificationSteps.jsx
│   │   │   ├── LoadingPulse.jsx
│   │   │   ├── EmptyState.jsx
│   │   │   └── Modal.jsx
│   │   └── layout/
│   │       ├── Sidebar.jsx
│   │       ├── Header.jsx
│   │       └── PageTransition.jsx
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Registro.jsx
│   │   ├── Dashboard.jsx
│   │   ├── MisRecetas.jsx
│   │   ├── NuevaReceta.jsx
│   │   └── Pendientes.jsx
│   ├── store/
│   │   └── useAuthStore.js     ← Zustand: usuario, rol, llave privada
│   ├── hooks/
│   │   └── useAnimatedCounter.js
│   ├── App.jsx
│   └── main.jsx
├── .env
└── README_FRONTEND.md
```

---

### DETALLES DE UX CRÍTICOS

1. **La llave privada nunca viaja al servidor** — se usa solo en el cliente
   para armar el body del POST. Aclarar esto visualmente al usuario.

2. **Manejo del campo llave_privada**: usar `<PrivKeyInput />` que:
   - Valida que empiece con `-----BEGIN EC PRIVATE KEY-----`
   - Muestra "Formato válido ✓" en verde al detectar PEM correcto
   - Botón de ojo para mostrar/ocultar (por defecto oculto como password)

3. **Errores del backend** traducidos a español legible:
   - 409 → "Este email ya está registrado"
   - 403 → "No tienes permisos para esta acción"
   - 400 "INTEGRIDAD COMPROMETIDA" → toast rojo grande con ícono de alerta
   - 400 "FIRMA INVÁLIDA" → toast rojo con ícono de escudo roto

4. **Estados de carga**: cada fetch muestra skeleton con la forma exacta
   del contenido. Nunca spinners genéricos.

5. **Responsive**: prioridad desktop, funcional en tablet.

---

### CRITERIO DE ÉXITO

El frontend debe verse como si hubiera sido construido por un equipo de
ingenieros de una startup de HealthTech bien financiada. Cada animación
debe sentirse intencional, no decorativa. La criptografía debe ser
**visible y comprensible** para el usuario: hashes, firmas y estados
de verificación deben ser protagonistas del diseño, no datos escondidos.

**Empieza por:** crear el proyecto Vite + instalar dependencias +
configurar TailwindCSS con la paleta personalizada + crear el sistema
de routing. Luego implementa página por página en este orden:
Login → Registro → Dashboard → MisRecetas → NuevaReceta → Pendientes.

No modifiques ningún archivo del backend.