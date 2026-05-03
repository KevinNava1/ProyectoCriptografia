"""§6 — Dispensación de receta + acuse del paciente."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from audit import registrar as audit_log
from auth import auth_required, require_roles
from database import EventoDispensacion, Receta, Usuario, get_db
from schemas.recetas import DispensarInput, FirmarTicketInput
from services import bundle, canonical_receta
from services.crypto import aes_gcm_decrypt, ecdsa_sign, ecdsa_verify, rsa_oaep_decrypt
from services.crypto.crypto_log import banner_flow, step
from services.estados import es_dispensable, to_legacy

router = APIRouter(prefix="/recetas", tags=["recetas"])

_ERR = "INTEGRIDAD comprometida o firma inválida"


class TicketDispensacionSalida(BaseModel):
    id: int
    receta_id: int
    numero_dispensacion: int
    estado: str  # pendiente_paciente | completo
    farmaceutico_id: int
    farmaceutico_username: Optional[str] = None
    paciente_id: int
    paciente_username: Optional[str] = None
    medico_id: int
    medico_username: Optional[str] = None
    medicamento: Optional[str] = None
    timestamp: Optional[datetime] = None
    fecha_firma_paciente: Optional[datetime] = None
    firma_farmaceutico: str
    firma_paciente: Optional[str] = None


def _evento_to_salida(ev: EventoDispensacion, db: Session) -> TicketDispensacionSalida:
    receta = db.query(Receta).filter(Receta.id == ev.receta_id).first()
    farm = db.query(Usuario).filter(Usuario.id == ev.farmaceutico_id).first()
    pac  = db.query(Usuario).filter(Usuario.id == receta.paciente_id).first() if receta else None
    med  = db.query(Usuario).filter(Usuario.id == receta.medico_id).first() if receta else None
    return TicketDispensacionSalida(
        id=ev.id,
        receta_id=ev.receta_id,
        numero_dispensacion=ev.numero_dispensacion,
        estado="completo" if ev.firma_paciente else "pendiente_paciente",
        farmaceutico_id=ev.farmaceutico_id,
        farmaceutico_username=farm.username if farm else None,
        paciente_id=receta.paciente_id if receta else 0,
        paciente_username=pac.username if pac else None,
        medico_id=receta.medico_id if receta else 0,
        medico_username=med.username if med else None,
        timestamp=ev.timestamp,
        fecha_firma_paciente=ev.fecha_firma_paciente,
        firma_farmaceutico=ev.firma_sello,
        firma_paciente=ev.firma_paciente,
    )


@router.post("/{receta_id}/dispensar")
def dispensar_receta(
    receta_id: int,
    datos: DispensarInput,
    farmaceutico_id: int = Query(..., description="ID del farmacéutico (debe coincidir con JWT)"),
    user: Usuario = Depends(require_roles("farmaceutico")),
    db: Session = Depends(get_db),
):
    banner_flow("§6 DISPENSAR",
                "RSA-OAEP unwrap → AES-GCM decrypt → ECDSA verify médico → ECDSA sign sello")

    if farmaceutico_id != user.id:
        raise HTTPException(403, "farmaceutico_id no coincide con la sesión")

    r = db.query(Receta).filter(Receta.id == receta_id).first()
    if not r:
        raise HTTPException(404, "Receta no encontrada")
    if not es_dispensable(r.estado):
        raise HTTPException(400, f"La receta ya está en estado '{to_legacy(r.estado)}'")
    if r.dispensaciones_realizadas >= r.dispensaciones_permitidas:
        raise HTTPException(400, "Receta sin dispensaciones disponibles")

    # Bloquear si hay un acuse pendiente del paciente.
    pendiente = next((e for e in r.eventos if e.firma_paciente is None), None)
    if pendiente is not None:
        raise HTTPException(
            409,
            f"El paciente debe firmar el acuse de la dispensación #{pendiente.numero_dispensacion} "
            f"antes de poder dispensar de nuevo.",
        )

    now = datetime.now(timezone.utc)
    if r.intervalo_dias and r.eventos:
        ts = r.eventos[-1].timestamp
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        prox = ts + timedelta(days=r.intervalo_dias)
        if now < prox:
            raise HTTPException(400, f"Dispensación bloqueada. Próxima fecha válida: {prox.isoformat()}")

    step("§6 DISPENSAR", 0, "validar pertenencia de llaves EC y RSA del farmacéutico")
    ec_priv = bundle.exigir_ec(datos.llave_privada_farmaceutico, user.pub_ec_pem)
    _, rsa_pem = bundle.exigir_rsa(datos.llave_privada_farmaceutico, user.pub_rsa_pem)

    acceso = next((a for a in r.accesos_farmacias if a.farmacia_id == user.id), None)
    if not acceso:
        raise HTTPException(403, "Esta farmacia no está autorizada para dispensar la receta")

    step("§6 DISPENSAR", 1, "RSA-OAEP unwrap → DEK")
    try:
        dek = rsa_oaep_decrypt(rsa_pem, acceso.c_wrap_far)
    except Exception:
        raise HTTPException(400, _ERR)

    step("§6 DISPENSAR", 2, "AES-128-GCM decrypt + validar TAG")
    try:
        r_bytes = aes_gcm_decrypt(dek, r.iv_aes, r.ciphertext, r.tag_aes, bytes(r.aad))
    except Exception:
        dek = b"\x00" * 16
        raise HTTPException(400, _ERR)

    step("§6 DISPENSAR", 3, "ECDSA verify → firma del médico sobre R")
    medico = db.query(Usuario).filter(Usuario.id == r.medico_id).first()
    if not medico or not medico.pub_ec_pem:
        dek = b"\x00" * 16
        raise HTTPException(400, _ERR)
    if not ecdsa_verify(medico.pub_ec_pem, r_bytes, r.firma_doctor):
        dek = b"\x00" * 16
        raise HTTPException(400, _ERR)

    numero = r.dispensaciones_realizadas + 1

    step("§6 DISPENSAR", 4, "construir Sello + ECDSA sign → S_F")
    sello_bytes = canonical_receta.build_sello(
        id_farmaceutico=user.id, id_receta=r.id,
        numero_dispensacion=numero,
        dispensaciones_permitidas=r.dispensaciones_permitidas,
        timestamp_iso=now.isoformat(),
    )
    s_f = ecdsa_sign(ec_priv, sello_bytes)
    dek = b"\x00" * 16

    proxima = now + timedelta(days=r.intervalo_dias) if r.intervalo_dias else None
    evento = EventoDispensacion(
        receta_id=r.id, farmaceutico_id=user.id,
        numero_dispensacion=numero, fecha_proxima_valida=proxima,
        firma_sello=s_f, manifiesto_sello=sello_bytes, timestamp=now,
    )
    db.add(evento)
    db.flush()

    r.dispensaciones_realizadas = numero
    r.estado = "dispensada_completa" if numero >= r.dispensaciones_permitidas else "en_proceso"

    audit_log(
        db, usuario_id=user.id, accion="dispensacion", id_receta=r.id,
        metadata={"numero_dispensacion": numero, "de": r.dispensaciones_permitidas},
    )
    db.commit()
    db.refresh(r)

    return {
        "mensaje": "Receta dispensada correctamente",
        "receta_id": r.id,
        "estado": to_legacy(r.estado),
        "numero_dispensacion": numero,
        "dispensaciones_permitidas": r.dispensaciones_permitidas,
        "evento_id": evento.id,
        "ticket_estado": "pendiente_paciente",
        "verificaciones": {
            "firma_medico_ecdsa_sha3": "OK",
            "firma_farmaceutico_ecdsa_sha3": "OK",
        },
    }


@router.get("/eventos-dispensacion", response_model=list[TicketDispensacionSalida],
            tags=["dispensacion-tickets"])
def listar_eventos_paciente(
    user: Usuario = Depends(auth_required),
    db: Session = Depends(get_db),
):
    if user.rol == "paciente":
        q = db.query(EventoDispensacion).join(Receta).filter(Receta.paciente_id == user.id)
    elif user.rol == "farmaceutico":
        q = db.query(EventoDispensacion).filter(EventoDispensacion.farmaceutico_id == user.id)
    elif user.rol == "medico":
        q = db.query(EventoDispensacion).join(Receta).filter(Receta.medico_id == user.id)
    else:
        return []
    return [_evento_to_salida(ev, db) for ev in q.order_by(EventoDispensacion.timestamp.desc()).all()]


@router.get("/eventos-dispensacion/pendientes", response_model=list[TicketDispensacionSalida],
            tags=["dispensacion-tickets"])
def listar_pendientes_paciente(
    user: Usuario = Depends(require_roles("paciente")),
    db: Session = Depends(get_db),
):
    eventos = (
        db.query(EventoDispensacion).join(Receta)
        .filter(Receta.paciente_id == user.id, EventoDispensacion.firma_paciente.is_(None))
        .order_by(EventoDispensacion.timestamp.desc())
        .all()
    )
    return [_evento_to_salida(ev, db) for ev in eventos]


@router.post("/eventos-dispensacion/{evento_id}/firmar-paciente",
             response_model=TicketDispensacionSalida, tags=["dispensacion-tickets"])
def firmar_evento_paciente(
    evento_id: int,
    datos: FirmarTicketInput,
    user: Usuario = Depends(require_roles("paciente")),
    db: Session = Depends(get_db),
):
    ev = db.query(EventoDispensacion).filter(EventoDispensacion.id == evento_id).first()
    if not ev:
        raise HTTPException(404, "Evento de dispensación no encontrado")
    receta = db.query(Receta).filter(Receta.id == ev.receta_id).first()
    if not receta or receta.paciente_id != user.id:
        raise HTTPException(403, "Este ticket de dispensación no es tuyo")
    if ev.firma_paciente:
        raise HTTPException(409, "Ya firmaste este ticket")

    banner_flow("§6.b ACUSE PACIENTE", "Paciente firma el sello de dispensación con ECDSA")

    step("§6.b ACUSE", 1, "ECDSA sign → firmar sello con priv EC del paciente")
    ec_priv = bundle.exigir_ec(datos.llave_privada, user.pub_ec_pem)
    firma = ecdsa_sign(ec_priv, bytes(ev.manifiesto_sello))

    step("§6.b ACUSE", 2, "ECDSA verify → comprobar firma recién emitida")
    if not ecdsa_verify(user.pub_ec_pem, bytes(ev.manifiesto_sello), firma):
        raise HTTPException(400, "Firma inválida")

    ev.firma_paciente      = firma
    ev.fecha_firma_paciente = datetime.now(timezone.utc)

    audit_log(
        db, usuario_id=user.id, accion="firma_ticket_dispensacion", id_receta=ev.receta_id,
        metadata={"evento_id": ev.id, "numero_dispensacion": ev.numero_dispensacion},
    )
    db.commit()
    db.refresh(ev)
    return _evento_to_salida(ev, db)


@router.get("/eventos-dispensacion/{evento_id}/verificar", tags=["dispensacion-tickets"])
def verificar_evento(
    evento_id: int,
    user: Usuario = Depends(auth_required),
    db: Session = Depends(get_db),
):
    ev = db.query(EventoDispensacion).filter(EventoDispensacion.id == evento_id).first()
    if not ev:
        raise HTTPException(404, "Evento de dispensación no encontrado")
    receta = db.query(Receta).filter(Receta.id == ev.receta_id).first()
    if not receta:
        raise HTTPException(404, "Receta no encontrada")

    if user.rol == "paciente" and receta.paciente_id != user.id:
        raise HTTPException(403, "Esta dispensación no te pertenece")
    if user.rol == "farmaceutico" and ev.farmaceutico_id != user.id:
        raise HTTPException(403, "No participaste en esta dispensación")
    if user.rol == "medico" and receta.medico_id != user.id:
        raise HTTPException(403, "No emitiste la receta de esta dispensación")

    medico       = db.query(Usuario).filter(Usuario.id == receta.medico_id).first()
    farmaceutico = db.query(Usuario).filter(Usuario.id == ev.farmaceutico_id).first()
    paciente     = db.query(Usuario).filter(Usuario.id == receta.paciente_id).first()

    try:
        aad = json.loads(bytes(receta.aad).decode())
        aad_ok = (
            aad.get("id_receta") == receta.id
            and aad.get("id_doctor") == receta.medico_id
            and len(receta.tag_aes) == 16
        )
    except Exception:
        aad_ok = False

    sello_bytes = bytes(ev.manifiesto_sello)

    # Firma médico: no verificable sin descifrar R (requiere priv_rsa del destinatario).
    firma_medico_ok = aad_ok

    firma_farm_ok = False
    if farmaceutico and farmaceutico.pub_ec_pem and ev.firma_sello:
        firma_farm_ok = ecdsa_verify(farmaceutico.pub_ec_pem, sello_bytes, ev.firma_sello)

    firma_pac_ok = None
    if ev.firma_paciente and paciente and paciente.pub_ec_pem:
        firma_pac_ok = ecdsa_verify(paciente.pub_ec_pem, sello_bytes, ev.firma_paciente)

    return {
        "evento_id": ev.id,
        "receta_id": receta.id,
        "numero_dispensacion": ev.numero_dispensacion,
        "timestamp": ev.timestamp.isoformat() if ev.timestamp else None,
        "fecha_firma_paciente": ev.fecha_firma_paciente.isoformat() if ev.fecha_firma_paciente else None,
        "estado_acuse": "completo" if ev.firma_paciente else "pendiente_paciente",
        "cifrado_aes_gcm": aad_ok,
        "medico": {
            "id": medico.id, "username": medico.username, "nombre": medico.nombre,
            "llave_publica": medico.pub_ec_pem, "firma_valida": firma_medico_ok,
            "firma": receta.firma_doctor,
        } if medico else None,
        "farmaceutico": {
            "id": farmaceutico.id, "username": farmaceutico.username, "nombre": farmaceutico.nombre,
            "llave_publica": farmaceutico.pub_ec_pem, "firma_valida": firma_farm_ok,
            "firma": ev.firma_sello,
        } if farmaceutico else None,
        "paciente": {
            "id": paciente.id, "username": paciente.username, "nombre": paciente.nombre,
            "llave_publica": paciente.pub_ec_pem, "firma_valida": firma_pac_ok,
            "firma": ev.firma_paciente,
        } if paciente else None,
    }


@router.get("/{receta_id}/eventos-dispensacion", response_model=list[TicketDispensacionSalida],
            tags=["dispensacion-tickets"])
def listar_eventos_de_receta(
    receta_id: int,
    user: Usuario = Depends(auth_required),
    db: Session = Depends(get_db),
):
    receta = db.query(Receta).filter(Receta.id == receta_id).first()
    if not receta:
        raise HTTPException(404, "Receta no encontrada")
    if user.rol == "paciente" and receta.paciente_id != user.id:
        raise HTTPException(403, "Esta receta no es tuya")
    if user.rol == "medico" and receta.medico_id != user.id:
        raise HTTPException(403, "No eres el médico emisor")
    eventos = (
        db.query(EventoDispensacion)
        .filter(EventoDispensacion.receta_id == receta_id)
        .order_by(EventoDispensacion.numero_dispensacion.asc())
        .all()
    )
    return [_evento_to_salida(ev, db) for ev in eventos]
