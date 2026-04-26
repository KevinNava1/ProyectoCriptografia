"""§4 — Creación de una receta electrónica.

Orquestación:
    validar RBAC/ownership → construir R canónico → firmar con ECDSA-SHA3 →
    cifrar con AES-256-GCM → envolver DEK para paciente y farmacias activas →
    persistir + auditar. Toda la criptografía vive en `services/`.
"""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from audit import registrar as audit_log
from auth import require_roles
from database import Receta, RecetaAccesoFarmacia, Usuario, get_db
from schemas.recetas import RecetaInput, RecetaOutput
from services import bundle, canonical_receta, receta_cifrado
from services.crypto import ecdsa_sign
from services.estados import to_legacy

router = APIRouter(prefix="/recetas", tags=["recetas"])


@router.post("", response_model=RecetaOutput, status_code=201)
def crear_receta(
    datos: RecetaInput,
    medico_id: int = Query(..., description="ID del médico (debe coincidir con JWT)"),
    user: Usuario = Depends(require_roles("medico")),
    db: Session = Depends(get_db),
):
    # RBAC duro: el id del query tiene que coincidir con el JWT (anti-IDOR).
    if medico_id != user.id:
        raise HTTPException(403, "medico_id no coincide con la sesión")

    # La llave EC del bundle debe derivar a la pub_ec_pem del médico.
    ec_priv = bundle.exigir_ec(datos.llave_privada_medico, user.pub_ec_pem)

    paciente = db.query(Usuario).filter(
        Usuario.username == datos.paciente_username,
        Usuario.rol == "paciente",
    ).first()
    if not paciente or paciente.estado != "activo":
        raise HTTPException(404, f"No existe un paciente activo con username '{datos.paciente_username}'")
    if not paciente.pub_rsa_pem:
        raise HTTPException(400, "El paciente no tiene llave RSA pública registrada")

    # Todas las farmacias activas → cada una recibe su C_wrap_far.
    farmacias = db.query(Usuario).filter(
        Usuario.rol == "farmaceutico",
        Usuario.estado == "activo",
        Usuario.activo == True,  # noqa: E712
    ).all()
    if not farmacias:
        raise HTTPException(503, "No hay farmacias activas para recibir la receta")

    # Placeholder para obtener el id_receta (se necesita DENTRO de R y AAD).
    placeholder = Receta(
        medico_id=user.id, paciente_id=paciente.id,
        ciphertext=b"\x00", tag_aes=b"\x00" * 16, iv_aes=b"\x00" * 12,
        aad=b"\x00", c_wrap_pac=b"\x00", firma_doctor="pending",
        dispensaciones_permitidas=datos.dispensaciones_permitidas,
        dispensaciones_realizadas=0, intervalo_dias=datos.intervalo_dias,
        estado="activa", hash_sha3_hex="0" * 64,
    )
    db.add(placeholder)
    db.flush()
    id_receta = placeholder.id
    fecha_creacion = date.today().isoformat()

    # §4.1 — R canónico.
    r_bytes = canonical_receta.build_R(
        id_receta=id_receta, id_doctor=user.id, id_paciente=paciente.id,
        medicamento=datos.medicamento, dosis=datos.dosis, cantidad=datos.cantidad,
        indicaciones=datos.instrucciones, fecha_creacion=fecha_creacion,
        dispensaciones_permitidas=datos.dispensaciones_permitidas,
        intervalo_dias=datos.intervalo_dias, parent_id=None,
    )

    # §4.2 — S_D = ECDSA-SHA3(priv_ec_doctor, R).
    firma_doctor = ecdsa_sign(ec_priv, r_bytes)

    # §4.4 — AAD canónico.
    aad = canonical_receta.build_AAD(
        id_receta=id_receta, id_doctor=user.id, id_paciente=paciente.id,
        fecha_creacion=fecha_creacion,
        dispensaciones_permitidas=datos.dispensaciones_permitidas,
    )

    # §4.3–§4.7 — cifrar una vez y envolver DEK para paciente + cada farmacia.
    env = receta_cifrado.cifrar_y_envolver(
        r_bytes, aad, paciente.pub_rsa_pem,
        [(f.id, f.pub_rsa_pem) for f in farmacias if f.pub_rsa_pem],
    )

    # §4.8 — completar la receta con los bytes cifrados.
    placeholder.ciphertext = env.ciphertext
    placeholder.tag_aes = env.tag
    placeholder.iv_aes = env.iv
    placeholder.aad = aad
    placeholder.c_wrap_pac = env.c_wrap_pac
    placeholder.firma_doctor = firma_doctor
    placeholder.hash_sha3_hex = canonical_receta.sha3_hex(r_bytes)

    # §4.9 — una fila por farmacia autorizada.
    for farm_id, c_wrap_far in env.c_wraps_far:
        db.add(RecetaAccesoFarmacia(
            receta_id=id_receta, farmacia_id=farm_id, c_wrap_far=c_wrap_far,
        ))

    # §4.11 — audit.
    audit_log(
        db, usuario_id=user.id, accion="creacion_receta", id_receta=id_receta,
        metadata={
            "paciente_id": paciente.id,
            "dispensaciones_permitidas": datos.dispensaciones_permitidas,
            "farmacias_autorizadas": len(env.c_wraps_far),
        },
    )
    db.commit()
    db.refresh(placeholder)

    return RecetaOutput(
        id=placeholder.id,
        medico_id=placeholder.medico_id,
        paciente_id=placeholder.paciente_id,
        estado=to_legacy(placeholder.estado),
        hash_sha3=placeholder.hash_sha3_hex,
    )
