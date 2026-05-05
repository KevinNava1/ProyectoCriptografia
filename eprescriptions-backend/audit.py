"""Audit log transaccional (spec §12).

`registrar(db, ...)` agrega el INSERT dentro de la MISMA sesión — si falla, la
operación hace rollback completo. No se emite `commit` aquí: el caller decide.

Decisión deliberada: si el log no se puede escribir, la operación de negocio
tampoco se persiste. Es preferible un 500 visible a una receta firmada sin
rastro en el audit. El audit es append-only por contrato (la tabla no expone
UPDATE ni DELETE en el dominio).
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
    # `meta` (no `metadata`) en el modelo: la columna se llama "metadata" en BD
    # pero el atributo Python tuvo que renombrarse porque "metadata" choca con
    # el namespace de SQLAlchemy declarative_base.
    db.add(
        AuditLog(
            usuario_id=usuario_id,
            accion=accion,
            id_receta=id_receta,
            resultado=resultado,
            meta=metadata,
        )
    )
