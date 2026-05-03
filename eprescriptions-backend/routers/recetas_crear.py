"""§4 — Creación de receta: firma ECDSA del médico + cifrado AES-GCM + wrap RSA-OAEP."""
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
from services.crypto.crypto_log import banner_flow, step
from services.estados import to_legacy

router = APIRouter(prefix="/recetas", tags=["recetas"])


@router.post("", response_model=RecetaOutput, status_code=201)
def crear_receta(
    datos: RecetaInput,
    medico_id: int = Query(..., description="ID del médico (debe coincidir con JWT)"),
    user: Usuario = Depends(require_roles("medico")),
    db: Session = Depends(get_db),
):
    banner_flow("§4 CREAR RECETA",
                "Médico firma R con ECDSA y cifra con AES-GCM; DEK envuelta vía RSA-OAEP")

    # Anti-IDOR: el query param tiene que coincidir con el JWT.
    if medico_id != user.id:
        raise HTTPException(403, "medico_id no coincide con la sesión")

    step("§4 CREAR", 0, "validar pertenencia de la llave EC del médico")
    ec_priv = bundle.exigir_ec(datos.llave_privada_medico, user.pub_ec_pem)

    paciente = db.query(Usuario).filter(
        Usuario.username == datos.paciente_username,
        Usuario.rol == "paciente",
    ).first()
    if not paciente or paciente.estado != "activo":
        raise HTTPException(404, f"No existe un paciente activo con username '{datos.paciente_username}'")
    if not paciente.pub_rsa_pem:
        raise HTTPException(400, "El paciente no tiene llave RSA pública registrada")

    farmacias = db.query(Usuario).filter(
        Usuario.rol == "farmaceutico",
        Usuario.estado == "activo",
        Usuario.activo == True,  # noqa: E712
    ).all()
    if not farmacias:
        raise HTTPException(503, "No hay farmacias activas para recibir la receta")

    # Necesitamos el id_receta antes de construir R y AAD, así que insertamos
    # un placeholder y lo completamos después del cifrado.
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
    fecha = date.today().isoformat()

    step("§4 CREAR", 1, "serializar R canónico")
    r_bytes = canonical_receta.build_R(
        id_receta=id_receta, id_doctor=user.id, id_paciente=paciente.id,
        medicamento=datos.medicamento, dosis=datos.dosis, cantidad=datos.cantidad,
        indicaciones=datos.instrucciones, fecha_creacion=fecha,
        dispensaciones_permitidas=datos.dispensaciones_permitidas,
        intervalo_dias=datos.intervalo_dias, parent_id=None,
    )

    step("§4 CREAR", 2, "FIRMAR R con ECDSA P-256 + SHA3-256 → S_D")
    firma_doctor = ecdsa_sign(ec_priv, r_bytes)

    step("§4 CREAR", 3, "construir AAD canónico")
    aad = canonical_receta.build_AAD(
        id_receta=id_receta, id_doctor=user.id, id_paciente=paciente.id,
        fecha_creacion=fecha,
        dispensaciones_permitidas=datos.dispensaciones_permitidas,
    )

    step("§4 CREAR", 4, f"cifrar R + envolver DEK (paciente + {sum(1 for f in farmacias if f.pub_rsa_pem)} farmacia(s))")
    env = receta_cifrado.cifrar_y_envolver(
        r_bytes, aad, paciente.pub_rsa_pem,
        [(f.id, f.pub_rsa_pem) for f in farmacias if f.pub_rsa_pem],
    )

    step("§4 CREAR", 5, "persistir ciphertext + tag + iv + aad + firma + hash")
    placeholder.ciphertext = env.ciphertext
    placeholder.tag_aes    = env.tag
    placeholder.iv_aes     = env.iv
    placeholder.aad        = aad
    placeholder.c_wrap_pac = env.c_wrap_pac
    placeholder.firma_doctor  = firma_doctor
    placeholder.hash_sha3_hex = canonical_receta.sha3_hex(r_bytes)

    for farm_id, c_wrap_far in env.c_wraps_far:
        db.add(RecetaAccesoFarmacia(
            receta_id=id_receta, farmacia_id=farm_id, c_wrap_far=c_wrap_far,
        ))

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
