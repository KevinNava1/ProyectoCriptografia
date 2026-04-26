"""§8 — Cancelación de una receta.

Solo el doctor emisor puede cancelar, y solo si el estado es
`activa` o `en_proceso`. Una receta `dispensada_completa` NO es cancelable.
La cancelación genera un `M_cancel` firmado (S_cancel) que queda como prueba
criptográfica inmutable en la tabla `cancelaciones`.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from audit import registrar as audit_log
from auth import require_roles
from database import Cancelacion, Receta, Usuario, get_db
from schemas.recetas import CancelarInput
from services import bundle, canonical_receta
from services.crypto import ecdsa_sign
from services.estados import es_cancelable, to_legacy

router = APIRouter(prefix="/recetas", tags=["recetas"])


@router.post("/{receta_id}/cancelar")
def cancelar_receta(
    receta_id: int,
    datos: CancelarInput,
    user: Usuario = Depends(require_roles("medico")),
    db: Session = Depends(get_db),
):
    r = db.query(Receta).filter(Receta.id == receta_id).first()
    if not r:
        raise HTTPException(404, "Receta no encontrada")
    if r.medico_id != user.id:
        raise HTTPException(403, "Solo el médico que emitió la receta puede cancelarla")
    if not es_cancelable(r.estado):
        raise HTTPException(400, f"Una receta en estado '{to_legacy(r.estado)}' no se puede cancelar")

    # Valida pertenencia de la llave EC del bundle.
    ec_priv = bundle.exigir_ec(datos.llave_privada_medico, user.pub_ec_pem)

    # §8.2 — construir M_cancel.
    ts = datetime.now(timezone.utc)
    m_bytes = canonical_receta.build_M_cancel(
        id_receta=r.id, id_doctor=user.id,
        motivo=datos.motivo, timestamp_iso=ts.isoformat(),
        dispensaciones_realizadas_al_cancelar=r.dispensaciones_realizadas,
    )

    # §8.3 — firmar con ECDSA-SHA3.
    s_cancel = ecdsa_sign(ec_priv, m_bytes)

    # §8.4 — actualizar receta.
    r.estado = "cancelada"
    r.motivo_cancelacion = datos.motivo
    r.fecha_cancelacion = ts

    # §8.5 — persistir cancelación.
    db.add(Cancelacion(
        receta_id=r.id, doctor_id=user.id,
        manifiesto=m_bytes, firma_cancel=s_cancel,
        timestamp_cancel=ts, motivo=datos.motivo,
    ))

    # §8.6 — audit.
    audit_log(
        db, usuario_id=user.id, accion="cancelacion_receta", id_receta=r.id,
        metadata={"motivo": datos.motivo,
                  "dispensaciones_ya_realizadas": r.dispensaciones_realizadas},
    )
    db.commit()
    return {"ok": True, "receta_id": r.id, "estado": to_legacy(r.estado)}
