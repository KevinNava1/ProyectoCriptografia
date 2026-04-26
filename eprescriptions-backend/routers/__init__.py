"""Routers HTTP — uno por flujo del spec maestro (§1..§9).

Cada módulo expone un `router` (APIRouter) que se monta en main.py. La lógica
criptográfica vive en `services/`, los routers son thin controllers.
"""
