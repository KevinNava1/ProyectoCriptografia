"""§9 — Sustitución de receta: cancela la original y emite una nueva con parent_id.

Es una operación atómica de dos fases dentro de una sola transacción:
    Fase 1 → marca la original como `sustituida` y firma su M_cancel con
             motivo=`sustituida_por_nueva_version` (idéntico flujo que §8).
    Fase 2 → crea la receta hija con `parent_id` apuntando a la original y
             repite el pipeline completo de §4 (R + AAD + AES-GCM + RSA wraps).

Si cualquier paso falla, hace rollback completo: ni la cancelación ni la
nueva quedan persistidas. Eso evita el caso "original cancelada pero la
sustituta nunca llegó a crearse" que dejaría al paciente sin tratamiento.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from audit import registrar as audit_log
from auth import require_roles
from database import Cancelacion, Receta, RecetaAccesoFarmacia, Usuario, get_db
from schemas.recetas import NuevaVersionInput, RecetaOutput
from services import bundle, canonical_receta, receta_cifrado
from services.crypto import ecdsa_sign
from services.crypto.crypto_log import banner_flow, step
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

    banner_flow("§9 NUEVA VERSIÓN",
                "Cancela original (S_cancel) + emite nueva con DEK/IV/firma frescas")

    step("§9 NUEVA VERSIÓN", 0, "validar pertenencia de la priv EC del médico")
    ec_priv = bundle.exigir_ec(datos.llave_privada_medico, user.pub_ec_pem)

    # Fase 1: cancelar la original (idéntico a §8).
    step("§9 NUEVA VERSIÓN", 1, "M_cancel + ECDSA sign → S_cancel sobre la receta original")
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
    original.fecha_cancelacion  = ts
    db.add(Cancelacion(
        receta_id=original.id, doctor_id=user.id,
        manifiesto=m_cancel, firma_cancel=s_cancel,
        timestamp_cancel=ts, motivo="sustituida_por_nueva_version",
    ))

    # Fase 2: crear la nueva (replica §4 con parent_id).
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

    # Mismo patrón "placeholder + flush" que §4: necesitamos id_receta antes
    # de construir R/AAD. La diferencia con §4 es `parent_id=original.id` —
    # es lo que enlaza la cadena de versiones para auditoría futura.
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

    step("§9 NUEVA VERSIÓN", 2, "serializar R canónico de la receta sustituta")
    fecha = datetime.now(timezone.utc).isoformat()
    r_bytes = canonical_receta.build_R(
        id_receta=placeholder.id, id_doctor=user.id, id_paciente=paciente.id,
        medicamento=datos.medicamento, dosis=datos.dosis, cantidad=datos.cantidad,
        indicaciones=datos.instrucciones, fecha_creacion=fecha,
        dispensaciones_permitidas=datos.dispensaciones_permitidas,
        intervalo_dias=datos.intervalo_dias, parent_id=original.id,
    )

    step("§9 NUEVA VERSIÓN", 3, "ECDSA sign → firma del médico sobre R nueva")
    firma_doctor = ecdsa_sign(ec_priv, r_bytes)

    step("§9 NUEVA VERSIÓN", 4, "construir AAD de la nueva receta")
    aad = canonical_receta.build_AAD(
        id_receta=placeholder.id, id_doctor=user.id, id_paciente=paciente.id,
        fecha_creacion=fecha,
        dispensaciones_permitidas=datos.dispensaciones_permitidas,
    )

    step("§9 NUEVA VERSIÓN", 5,
         f"AES-GCM encrypt + RSA-OAEP wrap (paciente + {sum(1 for f in farmacias if f.pub_rsa_pem)} farmacia(s))")
    env = receta_cifrado.cifrar_y_envolver(
        r_bytes, aad, paciente.pub_rsa_pem,
        [(f.id, f.pub_rsa_pem) for f in farmacias if f.pub_rsa_pem],
    )

    placeholder.ciphertext    = env.ciphertext
    placeholder.tag_aes       = env.tag
    placeholder.iv_aes        = env.iv
    placeholder.aad           = aad
    placeholder.c_wrap_pac    = env.c_wrap_pac
    placeholder.firma_doctor  = firma_doctor
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
