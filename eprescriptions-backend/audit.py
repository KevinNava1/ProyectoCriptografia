"""Audit log transaccional (spec §12).

`registrar(db, ...)` agrega el INSERT dentro de la MISMA sesión — si falla, la
operación hace rollback completo. No se emite `commit` aquí: el caller decide.
"""
from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.orm import Session

from database import AuditLog


def registrar(
    db: Session,
    *,
    usuario_id: Optional[int],
    accion: str,
    id_receta: Optional[int] = None,
    resultado: str = "ok",
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    db.add(
        AuditLog(
            usuario_id=usuario_id,
            accion=accion,
            id_receta=id_receta,
            resultado=resultado,
            meta=metadata,
        )
    )
