"""Admin — §2 Certificación (aprueba/rechaza solicitudes) y listado.

Sólo accesible con rol=admin (RBAC). La clave privada de la CA vive en `ca/`
y nunca sale del servidor — aquí el admin únicamente dispara la emisión.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, constr
from sqlalchemy.orm import Session

from audit import registrar as audit_log
from auth import require_roles
from database import (
    Cancelacion,
    Certificado,
    EventoDispensacion,
    Receta,
    RecetaAccesoFarmacia,
    SolicitudCertificado,
    Usuario,
    get_db,
)
from services.crypto.ca import emitir_cert

router = APIRouter(prefix="/admin", tags=["admin"])


class SolicitudSalida(BaseModel):
    id: int
    usuario_id: int
    username: str
    nombre: str
    email: str
    rol: str
    estado: str
    motivo_rechazo: Optional[str] = None
    fecha_solicitud: Optional[datetime] = None
    fecha_resolucion: Optional[datetime] = None


class RechazarInput(BaseModel):
    motivo: constr(strip_whitespace=True, min_length=3, max_length=400)


def _join_solicitud(sol: SolicitudCertificado, u: Usuario | None) -> SolicitudSalida:
    """Construye la salida para el admin. Si el usuario ya fue borrado
    (acción Rechazar), tira de los campos snapshot guardados en la solicitud."""
    if u is not None:
        return SolicitudSalida(
            id=sol.id, usuario_id=u.id, username=u.username, nombre=u.nombre,
            email=u.email, rol=u.rol, estado=sol.estado,
            motivo_rechazo=sol.motivo_rechazo,
            fecha_solicitud=sol.fecha_solicitud,
            fecha_resolucion=sol.fecha_resolucion,
        )
    return SolicitudSalida(
        id=sol.id,
        usuario_id=0,  # marca de "ya no existe"
        username=sol.username_snapshot or "(borrado)",
        nombre=sol.nombre_snapshot or "(borrado)",
        email=sol.email_snapshot or "(borrado)",
        rol=sol.rol_snapshot or "?",
        estado=sol.estado,
        motivo_rechazo=sol.motivo_rechazo,
        fecha_solicitud=sol.fecha_solicitud,
        fecha_resolucion=sol.fecha_resolucion,
    )


# ─────────────────────────────────────────────────────────────────────
#  GET /admin/solicitudes?estado=pendiente
# ─────────────────────────────────────────────────────────────────────
@router.get("/solicitudes", response_model=list[SolicitudSalida])
def listar_solicitudes(
    estado: Optional[str] = "pendiente",
    _admin: Usuario = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    # OUTER JOIN: las solicitudes rechazadas tienen usuario_id=NULL (el usuario
    # fue borrado y la FK pasa a NULL por ON DELETE SET NULL); deben seguir
    # apareciendo en el listado tirando de los campos snapshot.
    q = db.query(SolicitudCertificado, Usuario).outerjoin(
        Usuario, Usuario.id == SolicitudCertificado.usuario_id
    )
    if estado and estado != "todas":
        q = q.filter(SolicitudCertificado.estado == estado)
    q = q.order_by(SolicitudCertificado.fecha_solicitud.desc())
    return [_join_solicitud(sol, u) for sol, u in q.all()]


# ─────────────────────────────────────────────────────────────────────
#  POST /admin/solicitudes/{id}/aprobar
#  §2 — emite DOS certs X.509 (EC firma + RSA cifrado) y activa al usuario.
# ─────────────────────────────────────────────────────────────────────
@router.post("/solicitudes/{sol_id}/aprobar", response_model=SolicitudSalida)
def aprobar_solicitud(
    sol_id: int,
    admin: Usuario = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    sol = db.query(SolicitudCertificado).filter(SolicitudCertificado.id == sol_id).first()
    if not sol:
        raise HTTPException(404, "Solicitud no encontrada")
    if sol.estado not in ("pendiente", "suspendida"):
        raise HTTPException(409, f"Solicitud ya {sol.estado}")

    u = db.query(Usuario).filter(Usuario.id == sol.usuario_id).first()
    if not u:
        raise HTTPException(404, "Usuario de la solicitud no existe")

    venia_de_suspension = sol.estado == "suspendida"

    # §2 — emitir certs (ambos casos: nunca tuvo certs antes porque la
    # suspensión ocurrió mientras la solicitud aún estaba pendiente).
    cert_ec_pem, ec_serial, ec_exp = emitir_cert(sol.pub_ec_pem, u.nombre, u.rol, "firma")
    cert_rsa_pem, rsa_serial, rsa_exp = emitir_cert(sol.pub_rsa_pem, u.nombre, u.rol, "cifrado")
    db.add(Certificado(
        usuario_id=u.id, tipo="ec", uso="firma",
        cert_pem=cert_ec_pem, serial_hex=ec_serial, fecha_expiracion=ec_exp,
    ))
    db.add(Certificado(
        usuario_id=u.id, tipo="rsa", uso="cifrado",
        cert_pem=cert_rsa_pem, serial_hex=rsa_serial, fecha_expiracion=rsa_exp,
    ))

    sol.estado = "aprobada"
    sol.motivo_rechazo = None  # limpia el motivo si venía de suspensión
    sol.fecha_resolucion = datetime.now(timezone.utc)
    u.estado = "activo"
    u.activo = True

    audit_log(db, usuario_id=admin.id, accion="aprobacion_solicitud",
              metadata={
                  "usuario_id": u.id, "solicitud_id": sol.id,
                  "reactivacion": venia_de_suspension,
              })
    audit_log(db, usuario_id=u.id, accion="emision_certificado",
              metadata={"tipo": "ec", "serial": ec_serial, "aprobado_por": admin.id})
    audit_log(db, usuario_id=u.id, accion="emision_certificado",
              metadata={"tipo": "rsa", "serial": rsa_serial, "aprobado_por": admin.id})

    db.commit()
    db.refresh(sol)
    return _join_solicitud(sol, u)


# ─────────────────────────────────────────────────────────────────────
#  POST /admin/solicitudes/{id}/suspender
#  Conserva al usuario (username/email reservados), lo marca suspendido y
#  bloquea su login (403). La solicitud queda en estado=suspendida con motivo.
# ─────────────────────────────────────────────────────────────────────
@router.post("/solicitudes/{sol_id}/suspender", response_model=SolicitudSalida)
def suspender_solicitud(
    sol_id: int,
    datos: RechazarInput,
    admin: Usuario = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    sol = db.query(SolicitudCertificado).filter(SolicitudCertificado.id == sol_id).first()
    if not sol:
        raise HTTPException(404, "Solicitud no encontrada")
    if sol.estado not in ("pendiente", "aprobada"):
        raise HTTPException(409, f"Solicitud ya {sol.estado}")

    u = db.query(Usuario).filter(Usuario.id == sol.usuario_id).first()
    if not u:
        raise HTTPException(404, "Usuario de la solicitud no existe")

    venia_de_aprobada = sol.estado == "aprobada"
    seriales_revocados: list[str] = []
    # Si la cuenta estaba activa con certs, hay que revocarlos para que el
    # login deje de aceptarlos. Los certs no se borran — el flag `revocado`
    # mantiene la trazabilidad histórica (recetas firmadas previamente siguen
    # verificables con la pub_key del cert revocado, sólo bloqueamos login).
    if venia_de_aprobada:
        certs_activos = db.query(Certificado).filter(
            Certificado.usuario_id == u.id,
            Certificado.revocado == False,  # noqa: E712
        ).all()
        for c in certs_activos:
            c.revocado = True
            c.motivo_revocacion = f"suspension_admin: {datos.motivo}"
            seriales_revocados.append(c.serial_hex)

    sol.estado = "suspendida"
    sol.motivo_rechazo = datos.motivo
    sol.fecha_resolucion = datetime.now(timezone.utc)
    u.estado = "suspendido"
    u.activo = False

    audit_log(
        db,
        usuario_id=admin.id,
        accion="suspension_solicitud",
        resultado="rechazado",
        metadata={
            "solicitud_id": sol.id,
            "usuario_id": u.id,
            "motivo": datos.motivo,
            "venia_de": "aprobada" if venia_de_aprobada else "pendiente",
            "certs_revocados": seriales_revocados,
        },
    )
    if seriales_revocados:
        for serial in seriales_revocados:
            audit_log(
                db, usuario_id=admin.id, accion="revocacion_certificado",
                metadata={"serial": serial, "motivo": datos.motivo, "usuario_id": u.id},
            )

    db.commit()
    db.refresh(sol)
    return _join_solicitud(sol, u)


# ─────────────────────────────────────────────────────────────────────
#  POST /admin/solicitudes/{id}/rechazar
#  Borra al usuario completamente (cascade sobre certificados / solicitudes)
#  y libera username/email para nuevos registros. La traza queda en audit_log
#  vía ON DELETE SET NULL — el id de usuario queda como NULL pero el snapshot
#  con username/email se conserva en metadata.
# ─────────────────────────────────────────────────────────────────────
@router.post("/solicitudes/{sol_id}/rechazar", response_model=SolicitudSalida)
def rechazar_solicitud(
    sol_id: int,
    datos: RechazarInput,
    admin: Usuario = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    sol = db.query(SolicitudCertificado).filter(SolicitudCertificado.id == sol_id).first()
    if not sol:
        raise HTTPException(404, "Solicitud no encontrada")
    if sol.estado not in ("pendiente", "suspendida", "aprobada"):
        raise HTTPException(409, f"Solicitud ya {sol.estado}")

    u = db.query(Usuario).filter(Usuario.id == sol.usuario_id).first()
    if not u:
        raise HTTPException(404, "Usuario de la solicitud no existe")

    # Anti-pérdida de evidencia: si el usuario ya tiene historial criptográfico
    # (recetas firmadas, dispensaciones, cancelaciones), NO permitir borrado —
    # forzar a suspender. Borrar destruiría evidencia médico-legal y/o rompería FKs.
    if sol.estado in ("aprobada", "suspendida"):
        tiene_historial = bool(
            db.query(Receta.id)
              .filter((Receta.medico_id == u.id) | (Receta.paciente_id == u.id))
              .first()
            or db.query(RecetaAccesoFarmacia.id)
                 .filter(RecetaAccesoFarmacia.farmacia_id == u.id).first()
            or db.query(EventoDispensacion.id)
                 .filter(EventoDispensacion.farmaceutico_id == u.id).first()
            or db.query(Cancelacion.id)
                 .filter(Cancelacion.doctor_id == u.id).first()
        )
        if tiene_historial:
            raise HTTPException(
                409,
                "El usuario tiene historial criptográfico (recetas, dispensaciones o "
                "cancelaciones). No se puede borrar sin destruir evidencia. "
                "Mantén la cuenta suspendida para conservar la trazabilidad.",
            )

    # Snapshot ANTES de borrar para que la solicitud rechazada siga visible
    # en el panel admin (filtro "rechazadas") con username/nombre/email/rol.
    sol.username_snapshot = u.username
    sol.nombre_snapshot = u.nombre
    sol.email_snapshot = u.email
    sol.rol_snapshot = u.rol
    sol.estado = "rechazada"
    sol.motivo_rechazo = datos.motivo
    sol.fecha_resolucion = datetime.now(timezone.utc)

    salida = SolicitudSalida(
        id=sol.id, usuario_id=u.id, username=u.username, nombre=u.nombre,
        email=u.email, rol=u.rol, estado="rechazada",
        motivo_rechazo=datos.motivo,
        fecha_solicitud=sol.fecha_solicitud,
        fecha_resolucion=sol.fecha_resolucion,
    )

    audit_log(
        db,
        usuario_id=admin.id,
        accion="rechazo_solicitud",
        resultado="rechazado",
        metadata={
            "solicitud_id": sol.id,
            "motivo": datos.motivo,
            "estado_previo": sol.estado,
            "usuario_borrado": {
                "id": u.id, "username": u.username, "email": u.email,
                "nombre": u.nombre, "rol": u.rol,
            },
        },
    )

    # ON DELETE SET NULL en solicitudes_certificado.usuario_id deja la fila viva
    # con FK NULL — los campos snapshot ya están escritos arriba.
    db.delete(u)
    db.commit()
    return salida
