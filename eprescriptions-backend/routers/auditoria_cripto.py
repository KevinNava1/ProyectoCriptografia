"""Auditoría criptográfica — vista cruda de los blobs persistidos en BD.

Permite al usuario observar los bytes reales que viven en la base de datos
(ciphertext, IV, TAG, AAD, wraps RSA-OAEP, firmas ECDSA, hashes SHA3) SIN
descifrar. El objetivo es pedagógico: que se vea concretamente que cada
operación criptográfica genera material distinto aunque el contenido
clínico sea idéntico (no determinismo de AES-GCM y RSA-OAEP).

No expone secretos:
- la priv RSA del paciente / farmacia NUNCA está en BD;
- el ciphertext sin DEK desenvuelto es ruido pseudoaleatorio;
- los wraps RSA-OAEP solo se abren con la priv del destinatario.

Visibilidad por rol:
- admin          → todas las recetas;
- medico         → las que firmó;
- paciente       → las suyas;
- farmaceutico   → aquellas a las que tiene acceso (RecetaAccesoFarmacia).
"""
from __future__ import annotations

import base64
import json
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import auth_required
from database import (
    AuditLog,
    EventoDispensacion,
    Receta,
    RecetaAccesoFarmacia,
    Usuario,
    get_db,
)

router = APIRouter(prefix="/auditoria-cripto", tags=["auditoria-cripto"])


# ───────── helpers ─────────
def _hex(b: Optional[bytes]) -> Optional[str]:
    return bytes(b).hex() if b is not None else None


def _b64(b: Optional[bytes]) -> Optional[str]:
    return base64.b64encode(bytes(b)).decode() if b is not None else None


def _aad_pretty(aad_bytes: Optional[bytes]) -> Optional[dict[str, Any]]:
    if not aad_bytes:
        return None
    try:
        return json.loads(bytes(aad_bytes).decode())
    except Exception:
        return None


def _isoformat(dt) -> Optional[str]:
    if not dt:
        return None
    # SQLAlchemy + MySQL → datetime naive en UTC (el contenedor corre en UTC).
    # Normalizamos a UTC con offset para que el frontend pueda localizar a CDMX.
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _recetas_visibles(user: Usuario, db: Session) -> list[Receta]:
    q = db.query(Receta)
    if user.rol == "admin":
        pass  # todas
    elif user.rol == "medico":
        q = q.filter(Receta.medico_id == user.id)
    elif user.rol == "paciente":
        q = q.filter(Receta.paciente_id == user.id)
    elif user.rol == "farmaceutico":
        ids = {
            a.receta_id
            for a in db.query(RecetaAccesoFarmacia)
            .filter(RecetaAccesoFarmacia.farmacia_id == user.id)
            .all()
        }
        if not ids:
            return []
        q = q.filter(Receta.id.in_(ids))
    else:
        return []
    return q.order_by(Receta.id.desc()).all()


def _serialize_receta(r: Receta, db: Session) -> dict[str, Any]:
    eventos = list(r.eventos or [])
    accesos = list(r.accesos_farmacias or [])
    return {
        "id": r.id,
        "medico_id": r.medico_id,
        "paciente_id": r.paciente_id,
        "estado": r.estado,
        "fecha_creacion": _isoformat(r.fecha_creacion),
        "fecha_cancelacion": _isoformat(r.fecha_cancelacion),
        "parent_id": r.parent_id,
        # Cuerpo cifrado
        "aes_gcm": {
            "ciphertext_hex": _hex(r.ciphertext),
            "ciphertext_len": len(r.ciphertext) if r.ciphertext else 0,
            "iv_hex": _hex(r.iv_aes),
            "tag_hex": _hex(r.tag_aes),
            "aad_json": _aad_pretty(r.aad),
        },
        # DEK envuelta para el paciente (RSA-OAEP-SHA256)
        "rsa_oaep_paciente": {
            "c_wrap_hex": _hex(r.c_wrap_pac),
            "c_wrap_len": len(r.c_wrap_pac) if r.c_wrap_pac else 0,
        },
        # DEK envuelta para cada farmacia autorizada
        "rsa_oaep_farmacias": [
            {
                "farmacia_id": a.farmacia_id,
                "c_wrap_hex": _hex(a.c_wrap_far),
                "c_wrap_len": len(a.c_wrap_far) if a.c_wrap_far else 0,
            }
            for a in accesos
        ],
        # Firma ECDSA P-256 del médico sobre R canónico
        "ecdsa_medico": {
            "firma_b64": r.firma_doctor if r.firma_doctor != "pending" else None,
        },
        # Hash SHA3-256 hex del R canónico
        "sha3_256_hex": r.hash_sha3_hex,
        # Sellos de dispensación
        "sellos_dispensacion": [
            {
                "evento_id": ev.id,
                "farmaceutico_id": ev.farmaceutico_id,
                "numero_dispensacion": ev.numero_dispensacion,
                "timestamp": _isoformat(ev.timestamp),
                "manifiesto_hex": _hex(ev.manifiesto_sello),
                "firma_farm_b64": ev.firma_sello,
                "firma_paciente_b64": ev.firma_paciente,
                "fecha_firma_paciente": _isoformat(ev.fecha_firma_paciente),
            }
            for ev in eventos
        ],
    }


# ───────── endpoints ─────────
@router.get("/inventario")
def inventario_cripto(
    user: Usuario = Depends(auth_required),
    db: Session = Depends(get_db),
):
    """Snapshot de todos los blobs criptográficos visibles para el usuario.

    Cada llamada hace una consulta fresca a la BD — el frontend puede
    invocarlo repetidamente y comparar timestamps de servidor para mostrar
    "consulta N realizada a las HH:MM:SS" sin recargar.
    """
    recetas = _recetas_visibles(user, db)
    return {
        "consultado_en": datetime.now(timezone.utc).isoformat(),
        "usuario_id": user.id,
        "rol": user.rol,
        "total": len(recetas),
        "recetas": [_serialize_receta(r, db) for r in recetas],
    }


@router.get("/receta/{receta_id}")
def detalle_cripto(
    receta_id: int,
    user: Usuario = Depends(auth_required),
    db: Session = Depends(get_db),
):
    """Detalle cripto de UNA receta — útil para inspeccionar un blob específico."""
    r = db.query(Receta).filter(Receta.id == receta_id).first()
    if not r:
        raise HTTPException(404, "Receta no encontrada")

    autorizado = (
        user.rol == "admin"
        or (user.rol == "medico" and r.medico_id == user.id)
        or (user.rol == "paciente" and r.paciente_id == user.id)
        or (
            user.rol == "farmaceutico"
            and db.query(RecetaAccesoFarmacia)
            .filter(
                RecetaAccesoFarmacia.receta_id == r.id,
                RecetaAccesoFarmacia.farmacia_id == user.id,
            )
            .first()
            is not None
        )
    )
    if not autorizado:
        raise HTTPException(403, "Sin acceso a esta receta")

    return {
        "consultado_en": datetime.now(timezone.utc).isoformat(),
        "receta": _serialize_receta(r, db),
    }


@router.get("/audit-log")
def audit_log_visible(
    user: Usuario = Depends(auth_required),
    db: Session = Depends(get_db),
    limit: int = 100,
):
    """Audit log (§12) — eventos de negocio. Visibles según rol:
    - admin: todos
    - resto: solo los suyos
    """
    q = db.query(AuditLog)
    if user.rol != "admin":
        q = q.filter(AuditLog.usuario_id == user.id)
    eventos = q.order_by(AuditLog.id.desc()).limit(min(max(limit, 1), 500)).all()

    return {
        "consultado_en": datetime.now(timezone.utc).isoformat(),
        "total": len(eventos),
        "eventos": [
            {
                "id": a.id,
                "usuario_id": a.usuario_id,
                "accion": a.accion,
                "id_receta": a.id_receta,
                "timestamp": _isoformat(a.timestamp),
                "resultado": a.resultado,
                "metadata": a.meta,
            }
            for a in eventos
        ],
    }
