"""Máquina de estados canónica de una receta (spec §7).

Estados canónicos: activa → en_proceso → dispensada_completa
                   activa/en_proceso → cancelada
                   activa → sustituida

`to_legacy` traduce a los nombres que usa el frontend existente
(emitida / dispensada / revocada) sin tocar la UI.
"""


def to_legacy(estado: str) -> str:
    if estado in ("activa", "en_proceso"):
        return "emitida"
    if estado == "dispensada_completa":
        return "dispensada"
    if estado in ("cancelada", "sustituida"):
        return "revocada"
    return estado


DISPENSABLE = ("activa", "en_proceso")
CANCELABLE = ("activa", "en_proceso")


def es_dispensable(estado: str) -> bool:
    return estado in DISPENSABLE


def es_cancelable(estado: str) -> bool:
    return estado in CANCELABLE
