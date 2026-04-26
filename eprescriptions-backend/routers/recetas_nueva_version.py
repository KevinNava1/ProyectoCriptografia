"""§9 — Nueva versión de receta (sustitución con trazabilidad).

Flujo:
    1. Validar que la receta original es del doctor autenticado y sustituible.
    2. Cancelar original con motivo "sustituida_por_nueva_version" y dejar su
       S_cancel persistido (idéntico a §8).
    3. Repetir §4 creando una nueva receta con `parent_id = id_original`.
       La nueva recibe: DEK nueva, IV nuevo, AAD nuevo, firma nueva.
       El contador `dispensaciones_realizadas` reinicia en 0.
"""
from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from audit import registrar as audit_log
from auth import require_roles
from database import Cancelacion, Receta, RecetaAccesoFarmacia, Usuario, get_db
from schemas.recetas import NuevaVersionInput, RecetaOutput
from services import bundle, canonical_receta, receta_cifrado
from services.crypto import ecdsa_sign
from services.estados import es_cancelable, to_legacy

router = APIRouter(prefix="/recetas", tags=["recetas"])


@router.post("/{receta_id}/nueva-version", response_model=RecetaOutput, status_code=201)
def nueva_version(
    receta_id: int,
    datos: NuevaVersionInput,
    user: Usuario = Depends(require_roles("medico")),
    db: Session = Depends(get_db),
):
    original = db.query(Receta).filter(Receta.id == receta_id).first()
    if not original:
        raise HTTPException(404, "Receta original no encontrada")
    if original.medico_id != user.id:
        raise HTTPException(403, "Solo el médico emisor puede sustituir la receta")
    if not es_cancelable(original.estado):
        raise HTTPException(400, "La receta original no está en un estado sustituible")

    ec_priv = bundle.exigir_ec(datos.llave_privada_medico, user.pub_ec_pem)

    # ── 1. Cancelar original (reusa el manifiesto M_cancel con motivo especial).
    ts = datetime.now(timezone.utc)
    m_cancel = canonical_receta.build_M_cancel(
        id_receta=original.id, id_doctor=user.id,
        motivo="sustituida_por_nueva_version",
        timestamp_iso=ts.isoformat(),
        dispensaciones_realizadas_al_cancelar=original.dispensaciones_realizadas,
    )
    s_cancel = ecdsa_sign(ec_priv, m_cancel)
    original.estado = "sustituida"
    original.motivo_cancelacion = "sustituida_por_nueva_version"
    original.fecha_cancelacion = ts
    db.add(Cancelacion(
        receta_id=original.id, doctor_id=user.id,
        manifiesto=m_cancel, firma_cancel=s_cancel,
        timestamp_cancel=ts, motivo="sustituida_por_nueva_version",
    ))

    # ── 2. Crear la nueva (replica flujo §4 con parent_id).
    paciente = db.query(Usuario).filter(
        Usuario.username == datos.paciente_username, Usuario.rol == "paciente",
    ).first()
    if not paciente or not paciente.pub_rsa_pem:
        raise HTTPException(404, "Paciente inválido")
    farmacias = db.query(Usuario).filter(
        Usuario.rol == "farmaceutico", Usuario.estado == "activo", Usuario.activo == True,  # noqa: E712
    ).all()
    if not farmacias:
        raise HTTPException(503, "No hay farmacias activas")

    placeholder = Receta(
        medico_id=user.id, paciente_id=paciente.id,
        ciphertext=b"\x00", tag_aes=b"\x00" * 16, iv_aes=b"\x00" * 12,
        aad=b"\x00", c_wrap_pac=b"\x00", firma_doctor="pending",
        dispensaciones_permitidas=datos.dispensaciones_permitidas,
        dispensaciones_realizadas=0, intervalo_dias=datos.intervalo_dias,
        estado="activa", parent_id=original.id, hash_sha3_hex="0" * 64,
    )
    db.add(placeholder)
    db.flush()

    fecha_creacion = date.today().isoformat()
    r_bytes = canonical_receta.build_R(
        id_receta=placeholder.id, id_doctor=user.id, id_paciente=paciente.id,
        medicamento=datos.medicamento, dosis=datos.dosis, cantidad=datos.cantidad,
        indicaciones=datos.instrucciones, fecha_creacion=fecha_creacion,
        dispensaciones_permitidas=datos.dispensaciones_permitidas,
        intervalo_dias=datos.intervalo_dias, parent_id=original.id,
    )
    firma_doctor = ecdsa_sign(ec_priv, r_bytes)
    aad = canonical_receta.build_AAD(
        id_receta=placeholder.id, id_doctor=user.id, id_paciente=paciente.id,
        fecha_creacion=fecha_creacion,
        dispensaciones_permitidas=datos.dispensaciones_permitidas,
    )
    env = receta_cifrado.cifrar_y_envolver(
        r_bytes, aad, paciente.pub_rsa_pem,
        [(f.id, f.pub_rsa_pem) for f in farmacias if f.pub_rsa_pem],
    )

    placeholder.ciphertext = env.ciphertext
    placeholder.tag_aes = env.tag
    placeholder.iv_aes = env.iv
    placeholder.aad = aad
    placeholder.c_wrap_pac = env.c_wrap_pac
    placeholder.firma_doctor = firma_doctor
    placeholder.hash_sha3_hex = canonical_receta.sha3_hex(r_bytes)
    for farm_id, c_wrap_far in env.c_wraps_far:
        db.add(RecetaAccesoFarmacia(
            receta_id=placeholder.id, farmacia_id=farm_id, c_wrap_far=c_wrap_far,
        ))

    audit_log(
        db, usuario_id=user.id, accion="nueva_version_receta", id_receta=placeholder.id,
        metadata={
            "id_receta_original": original.id,
            "id_receta_nueva": placeholder.id,
            "motivo": datos.motivo_sustitucion,
        },
    )
    db.commit()
    db.refresh(placeholder)

    return RecetaOutput(
        id=placeholder.id, medico_id=placeholder.medico_id,
        paciente_id=placeholder.paciente_id,
        estado=to_legacy(placeholder.estado),
        hash_sha3=placeholder.hash_sha3_hex,
    )
