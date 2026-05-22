# SecureRx — Diagrama de Arquitectura

Sistema de recetas electrónicas con criptografía real. Arquitectura cliente-servidor
de tres capas, contenerizada con Docker Compose, detrás de un reverse proxy con
terminación TLS 1.3.

---

## Diagrama de arquitectura (vista de despliegue + capas)

```mermaid
flowchart TB
    %% ─────────────── CLIENTE ───────────────
    subgraph CLIENTE["CLIENTE"]
        browser["<b>Navegador Web</b><br/>Almacena las llaves<br/>privadas .pem EC + RSA<br/>(jamás salen del cliente)"]
    end

    %% ─────────────── SERVICIOS EXTERNOS ───────────────
    smtp["<b>Servidor SMTP</b><br/>Verificación de email<br/>y reset de password"]

    %% ─────────────── HOST / DOCKER ───────────────
    subgraph HOST["HOST  ·  Docker Compose"]

        %% Capa de Presentacion
        subgraph L1["CAPA 1 · PRESENTACIÓN"]
            spa["<b>Frontend SPA — :5173</b><br/>React 18 · Vite · Zustand · Tailwind<br/>pages / components / api(axios)<br/>JWT + bundle privado en memoria"]
        end

        %% Capa de Borde
        subgraph L2["CAPA 2 · BORDE / TRANSPORTE"]
            nginx["<b>nginx 1.27 — :443 / :80→8080</b><br/>Terminación TLS 1.3 exclusivo<br/>Reverse proxy · HSTS · CSP<br/>X-Frame-Options · Permissions-Policy"]
        end

        %% Red interna
        subgraph NET["Red interna docker-compose  (sin exposición al host)"]

            subgraph L3["CAPA 3 · APLICACIÓN  ·  api FastAPI / uvicorn :8000"]
                routers["<b>routers/</b><br/>Endpoints REST §1–§12<br/>usuarios · admin · recetas_* · health"]
                services["<b>services/</b><br/>Lógica de dominio<br/>cifrado · descifrado · canónico · bundle"]
                crypto["<b>services/crypto/</b><br/>AES-128-GCM · RSA-OAEP · ECDSA P-256/SHA3<br/>Argon2id · JWT HS256 · CA interna X.509"]
                cross["<b>auth.py · audit.py · schemas/</b><br/>RBAC / JWT · audit log append-only · Pydantic"]
                routers --> services --> crypto
                routers --> cross
            end

            db[("<b>MySQL 8.4</b><br/>Solo públicas · X.509 · criptogramas<br/>C/TAG/IV/AAD · firmas · envolturas · audit")]

            adminer["<b>adminer — :8081</b><br/>GUI de BD (solo desarrollo)"]
        end

        %% Volumenes
        subgraph VOL["Volúmenes persistentes"]
            voldb[("dbdata<br/>datos MySQL")]
            volca[("ca-data<br/>material de la CA interna")]
        end
    end

    %% ─────────────── ARISTAS ───────────────
    browser -- "HTTPS · TLS 1.3" --> nginx
    browser -- "HTTP (dev)" --> spa
    spa -- "REST / axios" --> nginx
    nginx -- "HTTP interno (proxy_pass)" --> routers
    L3 -- "SQLAlchemy 2.x / PyMySQL" --> db
    adminer -- "consulta" --> db
    L3 -- "SMTP" --> smtp
    db -.-> voldb
    crypto -.-> volca

    %% ─────────────── ESTILOS ───────────────
    classDef cliente   fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#0d47a1
    classDef borde     fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#bf360c
    classDef app       fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#1b5e20
    classDef datos     fill:#f3e5f5,stroke:#6a1b9a,stroke-width:2px,color:#4a148c
    classDef ext       fill:#eceff1,stroke:#455a64,stroke-width:2px,color:#263238,stroke-dasharray:5 3
    classDef dev       fill:#fafafa,stroke:#9e9e9e,stroke-width:1px,color:#616161,stroke-dasharray:4 2

    class browser cliente
    class spa cliente
    class nginx borde
    class routers,services,crypto,cross app
    class db,voldb,volca datos
    class smtp ext
    class adminer dev
```

---

## Leyenda

| Color | Capa |
|---|---|
| Azul | Cliente / Presentación — navegador y SPA |
| Naranja | Borde / Transporte — nginx, terminación TLS 1.3 |
| Verde | Aplicación — API FastAPI y subcomponentes |
| Morado | Persistencia — MySQL y volúmenes |
| Gris (punteado) | Servicios externos y herramientas de desarrollo |

## Notas de arquitectura

- **nginx es la única entrada pública.** El `api` solo se publica por `expose` y
  MySQL nunca se publica: ambos viven en la red interna de docker-compose.
- **TLS 1.3 exclusivo** (sin fallback a 1.2), HSTS y CSP los aplica nginx.
- **El frontend (Vite) corre en el host**, no en contenedor.
- **Regla de oro:** las llaves privadas y la DEK nunca tocan el disco del
  servidor; la BD solo guarda públicas, certificados X.509, criptogramas,
  firmas, envolturas y el audit log.
- **Criptografía transversal:** AES-128-GCM (cifrado), RSA-OAEP (envoltura de
  clave), ECDSA P-256/SHA3-256 (firma), Argon2id (password), JWT HS256 (sesión),
  CA interna X.509 (certificación).
