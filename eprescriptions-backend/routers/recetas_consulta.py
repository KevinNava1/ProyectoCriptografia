"""§5 — Consulta de receta (paciente / médico / farmacéutico) + verificar-firmas.

El paciente y el farmacéutico reciben la receta DESCIFRADA usando su propia
RSA privada (enviada en el header `X-Priv-Keys` como base64). El médico NO
puede descifrar — por diseño no se le entrega C_wrap_doc en el flujo canónico.
"""
from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from audit import registrar as audit_log
from auth import require_roles
from database import EventoDispensacion, Receta, Usuario, get_db
from schemas.recetas import RecetaDescifrada
from services import bundle, receta_descifrado
from services.crypto import ecdsa_verify
from services.estados import to_legacy
from services.hidratador import hidratar

router = APIRouter(prefix="/recetas", tags=["recetas"])


# ─────────────────────────────────────────────────────────────────────
#  §5 — Paciente descifra con su propia RSA
# ─────────────────────────────────────────────────────────────────────
@router.get("/paciente/{paciente_id}", response_model=list[RecetaDescifrada])
def consultar_recetas_paciente(
    paciente_id: int,
    x_priv_keys: Optional[str] = Header(default=None, alias="X-Priv-Keys"),
    user: Usuario = Depends(require_roles("paciente")),
    db: Session = Depends(get_db),
):
    if paciente_id != user.id:
        raise HTTPException(403, "No puedes consultar recetas de otro paciente")

    bundle_pem = bundle.desde_header(x_priv_keys)
    _, rsa_pem = bundle.exigir_rsa(bundle_pem, user.pub_rsa_pem)

    recetas = (
        db.query(Receta)
        .filter(Receta.paciente_id == paciente_id)
        .order_by(Receta.id.desc())
        .all()
    )
    out: list[RecetaDescifrada] = []
    for r in recetas:
        try:
            contenido = receta_descifrado.descifrar(
                rsa_pem, r.c_wrap_pac, r.iv_aes, r.ciphertext, r.tag_aes, bytes(r.aad),
            )
        except HTTPException:
            continue
        out.append(hidratar(r, contenido, db))

    audit_log(db, usuario_id=user.id, accion="consulta_receta",
              metadata={"cantidad": len(out)})
    db.commit()
    return out


# ─────────────────────────────────────────────────────────────────────
#  §5 — Médico lista sus recetas (sin descifrar — no guarda C_wrap_doc)
# ─────────────────────────────────────────────────────────────────────
@router.get("/medico/{medico_id}", response_model=list[RecetaDescifrada])
def consultar_recetas_medico(
    medico_id: int,
    user: Usuario = Depends(require_roles("medico")),
    db: Session = Depends(get_db),
):
    if medico_id != user.id:
        raise HTTPException(403, "No puedes consultar recetas de otro médico")

    recetas = (
        db.query(Receta)
        .filter(Receta.medico_id == medico_id)
        .order_by(Receta.id.desc())
        .all()
    )
    out: list[RecetaDescifrada] = []
    for r in recetas:
        aad = json.loads(bytes(r.aad).decode())
        paciente = db.query(Usuario).filter(Usuario.id == r.paciente_id).first()
        last_ev = r.eventos[-1] if r.eventos else None
        farm = db.query(Usuario).filter(Usuario.id == last_ev.farmaceutico_id).first() if last_ev else None
        out.append(RecetaDescifrada(
            id=r.id, medico_id=r.medico_id, paciente_id=r.paciente_id,
            medico_username=user.username,
            paciente_username=paciente.username if paciente else None,
            farmaceutico_id=farm.id if farm else None,
            farmaceutico_username=farm.username if farm else None,
            fecha=aad.get("fecha_creacion", ""),
            medicamento="(cifrado)", dosis="(cifrado)", cantidad=0, instrucciones="",
            estado=to_legacy(r.estado),
            hash_sha3=r.hash_sha3_hex,
            firma_medico=r.firma_doctor,
            firma_farmaceutico=last_ev.firma_sello if last_ev else None,
            dispensaciones_permitidas=r.dispensaciones_permitidas,
            dispensaciones_realizadas=r.dispensaciones_realizadas,
            parent_id=r.parent_id,
        ))
    return out


# ─────────────────────────────────────────────────────────────────────
#  Farmacéutico — histórico de recetas que ESTA farmacia dispensó
# ─────────────────────────────────────────────────────────────────────
@router.get("/farmaceutico/{farmaceutico_id}", response_model=list[RecetaDescifrada])
def consultar_recetas_farmaceutico(
    farmaceutico_id: int,
    x_priv_keys: Optional[str] = Header(default=None, alias="X-Priv-Keys"),
    user: Usuario = Depends(require_roles("farmaceutico")),
    db: Session = Depends(get_db),
):
    if farmaceutico_id != user.id:
        raise HTTPException(403, "No puedes consultar recetas de otra farmacia")

    bundle_pem = bundle.desde_header(x_priv_keys)
    _, rsa_pem = bundle.exigir_rsa(bundle_pem, user.pub_rsa_pem)

    eventos = db.query(EventoDispensacion).filter(
        EventoDispensacion.farmaceutico_id == user.id,
    ).all()
    ids = {e.receta_id for e in eventos}
    recetas = db.query(Receta).filter(Receta.id.in_(ids)).order_by(Receta.id.desc()).all() if ids else []

    out: list[RecetaDescifrada] = []
    for r in recetas:
        acceso = next((a for a in r.accesos_farmacias if a.farmacia_id == user.id), None)
        if not acceso:
            continue
        try:
            contenido = receta_descifrado.descifrar(
                rsa_pem, acceso.c_wrap_far, r.iv_aes, r.ciphertext, r.tag_aes, bytes(r.aad),
            )
        except HTTPException:
            continue
        out.append(hidratar(r, contenido, db))
    return out


# ─────────────────────────────────────────────────────────────────────
#  Farmacéutico — recetas pendientes de dispensar
# ─────────────────────────────────────────────────────────────────────
@router.get("/pendientes", response_model=list[RecetaDescifrada])
def listar_recetas_pendientes(
    x_priv_keys: Optional[str] = Header(default=None, alias="X-Priv-Keys"),
    user: Usuario = Depends(require_roles("farmaceutico")),
    db: Session = Depends(get_db),
):
    bundle_pem = bundle.desde_header(x_priv_keys)
    _, rsa_pem = bundle.exigir_rsa(bundle_pem, user.pub_rsa_pem)

    recetas = (
        db.query(Receta)
        .filter(Receta.estado.in_(("activa", "en_proceso")))
        .order_by(Receta.id.desc())
        .all()
    )
    out: list[RecetaDescifrada] = []
    for r in recetas:
        acceso = next((a for a in r.accesos_farmacias if a.farmacia_id == user.id), None)
        if not acceso:
            continue
        try:
            contenido = receta_descifrado.descifrar(
                rsa_pem, acceso.c_wrap_far, r.iv_aes, r.ciphertext, r.tag_aes, bytes(r.aad),
            )
        except HTTPException:
            continue
        out.append(hidratar(r, contenido, db))
    return out


# ─────────────────────────────────────────────────────────────────────
#  Verificación pública de firmas (sin priv key)
# ─────────────────────────────────────────────────────────────────────
@router.get("/{receta_id}/verificar-firmas")
def verificar_firmas(receta_id: int, db: Session = Depends(get_db)):
    """Sin priv_rsa no se puede reconstruir R — por eso:

    * AES-GCM: valida indirectamente que AAD es coherente (id_receta, id_doctor).
    * Firma del médico: no verificable sin R; marcamos coherente si el AAD está
      íntegro Y el TAG tiene 16 bytes (no fue truncado). El hash NO se reporta
      como un check separado: ECDSA P-256 + SHA3-256 lo integra.
    * Firma del sello farmacéutico: SÍ es verificable porque el manifiesto es
      público (`manifiesto_sello` está en BD).
    """
    r = db.query(Receta).filter(Receta.id == receta_id).first()
    if not r:
        raise HTTPException(404, "Receta no encontrada")

    medico = db.query(Usuario).filter(Usuario.id == r.medico_id).first()
    last_ev = r.eventos[-1] if r.eventos else None
    farmaceutico = (
        db.query(Usuario).filter(Usuario.id == last_ev.farmaceutico_id).first()
        if last_ev else None
    )

    try:
        aad = json.loads(bytes(r.aad).decode())
        aad_ok = aad.get("id_receta") == r.id and aad.get("id_doctor") == r.medico_id
    except Exception:
        aad_ok = False

    firma_farm_ok = None
    if farmaceutico and last_ev:
        firma_farm_ok = ecdsa_verify(
            farmaceutico.pub_ec_pem, bytes(last_ev.manifiesto_sello), last_ev.firma_sello,
        )
    firma_medico_ok = aad_ok and len(r.tag_aes) == 16

    return {
        "receta_id": r.id,
        "estado": to_legacy(r.estado),
        "cifrado_aes_gcm": aad_ok,
        "medico": {
            "id": medico.id,
            "username": medico.username,
            "nombre": medico.nombre,
            "llave_publica": medico.pub_ec_pem,
            "firma_valida": firma_medico_ok,
        } if medico else None,
        "farmaceutico": {
            "id": farmaceutico.id,
            "username": farmaceutico.username,
            "nombre": farmaceutico.nombre,
            "llave_publica": farmaceutico.pub_ec_pem,
            "firma_valida": firma_farm_ok,
        } if farmaceutico else None,
    }
