"""SecureRx — punto de arranque de la API.

Este archivo SOLO monta la app, configura CORS, inicializa el schema y engancha
los routers. Toda la lógica vive en `routers/` y `services/`.

Layout:
    routers/    — uno por flujo del spec (§1..§9)
    services/   — operaciones del dominio (cifrado, descifrado, bundles, etc.)
    services/crypto/  — primitivas (AES-GCM, RSA-OAEP, ECDSA, Argon2, JWT, CA)
    schemas/    — contratos Pydantic de entrada/salida
    database.py — modelos SQLAlchemy (persistencia)
    auth.py     — dependencias de RBAC/JWT
    audit.py    — append-only log transaccional
"""
from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import SessionLocal, init_schema
from routers import (
    admin,
    health,
    recetas_cancelar,
    recetas_consulta,
    recetas_crear,
    recetas_dispensar,
    recetas_nueva_version,
    usuarios,
)

load_dotenv()

# Bootstrap del schema al arranque (idempotente).
init_schema(reset=False)

# Bootstrap del admin inicial si ADMIN_PASSWORD está presente (contenedores).
if os.getenv("ADMIN_PASSWORD"):
    from scripts.bootstrap_admin import bootstrap_admin
    _db = SessionLocal()
    try:
        bootstrap_admin(_db, verbose=True)
    except Exception as _e:
        # No tumbar el arranque si el admin ya existe con otro username.
        print(f"[startup] bootstrap_admin omitido: {_e}")
    finally:
        _db.close()

app = FastAPI(
    title="SecureRx — Sistema de Recetas Electrónicas",
    version="2.0",
    description="Implementación canónica del spec maestro de recetas cifradas.",
)

# CORS explícito por whitelist (sin comodín).
_origins = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Routers — uno por flujo del spec.
app.include_router(health.router)
app.include_router(usuarios.router)               # §1, §3
app.include_router(admin.router)                  # §2 (admin-in-the-loop)
app.include_router(recetas_crear.router)          # §4
app.include_router(recetas_consulta.router)      # §5
app.include_router(recetas_dispensar.router)     # §6
app.include_router(recetas_cancelar.router)      # §8
app.include_router(recetas_nueva_version.router)  # §9 (sustitución por nueva versión)
