"""Conversión de fila `Receta` + contenido descifrado → `RecetaDescifrada`.

Resuelve usernames (médico, paciente, último farmacéutico) para que el frontend
no tenga que pegarse N requests adicionales por cada listado, y mapea el estado
canónico al nombre legacy que espera la UI (emitida/dispensada/revocada).

Tolerante a aliases del JSON descifrado: el spec evolucionó y hay recetas
viejas con `fecha`/`instrucciones` y nuevas con `fecha_creacion`/`indicaciones`.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from database import Receta, Usuario
from schemas.recetas import RecetaDescifrada
from services.estados import to_legacy


def hidratar(
    r: Receta,
    contenido: dict[str, Any],
    db: Session,
    firma_medico_ok: bool | None = None,
    farmaceutico_propio_id: int | None = None,
) -> RecetaDescifrada:
    medico = db.query(Usuario).filter(Usuario.id == r.medico_id).first()
    paciente = db.query(Usuario).filter(Usuario.id == r.paciente_id).first()
    # `eventos` viene ordenado por numero_dispensacion (ver relationship en
    # database.py), así que el último es la dispensación más reciente.
    last_ev = r.eventos[-1] if r.eventos else None
    farm = None
    if last_ev:
        farm = db.query(Usuario).filter(Usuario.id == last_ev.farmaceutico_id).first()

    # Gate cripto: si el endpoint VERIFICÓ la firma y el resultado fue False,
    # NO devolvemos los campos sensibles del contenido descifrado. Defensa
    # primaria — quien llame al API directo (curl, fork del front) tampoco
    # ve nada útil de una receta manipulada. Solo metadatos del AAD pasan.
    # firma_medico_ok=None significa "endpoint no podía verificar" (p.ej.
    # médico que no descifra), no "verificación falló" — ese caso pasa.
    cripto_ok = firma_medico_ok is not False
    if cripto_ok:
        medicamento = contenido["medicamento"]
        dosis = contenido["dosis"]
        cantidad = int(contenido.get("cantidad", 1))
        instrucciones = contenido.get(
            "indicaciones", contenido.get("instrucciones", "")
        )
        fecha = contenido.get("fecha_creacion", contenido.get("fecha", ""))
        motivo_no_verificada = None
    else:
        medicamento = "(no verificada)"
        dosis = "(no verificada)"
        cantidad = 0
        instrucciones = ""
        fecha = contenido.get("fecha_creacion", contenido.get("fecha", ""))
        motivo_no_verificada = (
            "La firma digital ECDSA P-256 + SHA3-256 del médico emisor no "
            "coincide con el contenido descifrado de esta receta. Esto indica "
            "que el documento pudo haber sido alterado posteriormente a su "
            "emisión. Por motivos de seguridad, absténgase de utilizar esta "
            "prescripción y contacte a su médico tratante o al equipo de "
            "soporte de SecureRx."
        )

    # ISO de la última dispensación — el front del farma lo usa para que sus
    # charts/calendar muestren la fecha de la ACCIÓN, no la de creación.
    ultima_dispensacion = (
        last_ev.timestamp.isoformat() if last_ev and last_ev.timestamp else None
    )
    # Lista de fechas en que el paciente firmó acuse para esta receta. El
    # front del paciente expande esto para que el heatmap pinte un punto
    # por cada acuse firmado (una receta puede tener varios).
    firmas_paciente = [
        e.fecha_firma_paciente.isoformat()
        for e in r.eventos
        if e.fecha_firma_paciente
    ]
    # Farmacias autorizadas — solo metadata (id, username) para que la UI
    # del paciente muestre a dónde puede dispensar. El envoltorio cripto
    # de la DEK ya quedó atado a la pub RSA de cada farmacia.
    farmacias_autorizadas = []
    for acc in r.accesos_farmacias:
        f = db.query(Usuario).filter(Usuario.id == acc.farmacia_id).first()
        if f:
            farmacias_autorizadas.append({"id": f.id, "username": f.username, "nombre": f.nombre})

    # Dispensaciones hechas SOLO por el farma que está consultando. Si una
    # receta tiene eventos de varios farmas, aquí solo entran los del farma
    # actual — el frontend expande estos para graficar 1 punto por cada
    # acción que él hizo.
    dispensaciones_propias = (
        [
            e.timestamp.isoformat()
            for e in r.eventos
            if e.timestamp and e.farmaceutico_id == farmaceutico_propio_id
        ]
        if farmaceutico_propio_id is not None
        else []
    )

    return RecetaDescifrada(
        id=r.id,
        medico_id=r.medico_id,
        paciente_id=r.paciente_id,
        medico_username=medico.username if medico else None,
        paciente_username=paciente.username if paciente else None,
        farmaceutico_id=farm.id if farm else None,
        farmaceutico_username=farm.username if farm else None,
        fecha=fecha,
        medicamento=medicamento,
        dosis=dosis,
        cantidad=cantidad,
        instrucciones=instrucciones,
        estado=to_legacy(r.estado),
        hash_sha3=r.hash_sha3_hex,
        firma_medico=r.firma_doctor,
        firma_medico_ok=firma_medico_ok,
        firma_farmaceutico=last_ev.firma_sello if last_ev else None,
        cripto_ok=cripto_ok,
        motivo_no_verificada=motivo_no_verificada,
        dispensaciones_permitidas=r.dispensaciones_permitidas,
        dispensaciones_realizadas=r.dispensaciones_realizadas,
        parent_id=r.parent_id,
        ultima_dispensacion=ultima_dispensacion,
        firmas_paciente=firmas_paciente,
        dispensaciones_propias=dispensaciones_propias,
        farmacias_autorizadas=farmacias_autorizadas,
    )
