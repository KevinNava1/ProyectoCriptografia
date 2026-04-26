"""Conversión de fila `Receta` + contenido descifrado → `RecetaDescifrada`.

Se encarga de resolver usernames (médico, paciente, último farmacéutico) y
mapear el estado canónico al nombre legacy que espera el frontend.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from database import Receta, Usuario
from schemas.recetas import RecetaDescifrada
from services.estados import to_legacy


def hidratar(r: Receta, contenido: dict[str, Any], db: Session) -> RecetaDescifrada:
    medico = db.query(Usuario).filter(Usuario.id == r.medico_id).first()
    paciente = db.query(Usuario).filter(Usuario.id == r.paciente_id).first()
    last_ev = r.eventos[-1] if r.eventos else None
    farm = None
    if last_ev:
        farm = db.query(Usuario).filter(Usuario.id == last_ev.farmaceutico_id).first()

    return RecetaDescifrada(
        id=r.id,
        medico_id=r.medico_id,
        paciente_id=r.paciente_id,
        medico_username=medico.username if medico else None,
        paciente_username=paciente.username if paciente else None,
        farmaceutico_id=farm.id if farm else None,
        farmaceutico_username=farm.username if farm else None,
        fecha=contenido.get("fecha_creacion", contenido.get("fecha", "")),
        medicamento=contenido["medicamento"],
        dosis=contenido["dosis"],
        cantidad=int(contenido.get("cantidad", 1)),
        instrucciones=contenido.get("indicaciones", contenido.get("instrucciones", "")),
        estado=to_legacy(r.estado),
        hash_sha3=r.hash_sha3_hex,
        firma_medico=r.firma_doctor,
        firma_farmaceutico=last_ev.firma_sello if last_ev else None,
        dispensaciones_permitidas=r.dispensaciones_permitidas,
        dispensaciones_realizadas=r.dispensaciones_realizadas,
        parent_id=r.parent_id,
    )
