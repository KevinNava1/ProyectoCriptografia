"""Constructores JSON canónicos del dominio receta.

Estas funciones son PURAS y deterministas: los mismos inputs producen los
mismos bytes. Son la fuente de verdad de QUÉ se firma y QUÉ se autentica por
AAD. Cualquier cambio aquí rompe firmas existentes y es incompatible sin un
bump del campo `version`.

Sigue literalmente la especificación:
- §4.1 → R            (cuerpo firmado + cifrado de la receta)
- §4.4 → AAD          (metadatos autenticados por AES-GCM)
- §6.7 → Sello        (manifiesto firmado por el farmacéutico)
- §8.2 → M_cancel     (manifiesto firmado por el doctor al cancelar)
"""
from __future__ import annotations

import hashlib
from typing import Optional

from services.crypto import canonical_bytes


def build_R(
    *,
    id_receta: int,
    id_doctor: int,
    id_paciente: int,
    medicamento: str,
    dosis: str,
    cantidad: int,
    indicaciones: str,
    fecha_creacion: str,
    dispensaciones_permitidas: int,
    intervalo_dias: Optional[int],
    parent_id: Optional[int],
) -> bytes:
    """Spec §4.1 — cuerpo que el doctor firma y que luego va dentro de AES-GCM."""
    return canonical_bytes({
        "id_receta": id_receta,
        "id_doctor": id_doctor,
        "id_paciente": id_paciente,
        "medicamento": medicamento,
        "dosis": dosis,
        "cantidad": cantidad,
        "indicaciones": indicaciones,
        "fecha_creacion": fecha_creacion,
        "dispensaciones_permitidas": dispensaciones_permitidas,
        "intervalo_dias": intervalo_dias,
        "parent_id": parent_id,
    })


def build_AAD(
    *,
    id_receta: int,
    id_doctor: int,
    id_paciente: int,
    fecha_creacion: str,
    dispensaciones_permitidas: int,
) -> bytes:
    """Spec §4.4 — datos autenticados (NO cifrados) que el TAG de GCM protege."""
    return canonical_bytes({
        "id_receta": id_receta,
        "id_doctor": id_doctor,
        "id_paciente": id_paciente,
        "fecha_creacion": fecha_creacion,
        "dispensaciones_permitidas": dispensaciones_permitidas,
        "version": "1",
    })


def build_sello(
    *,
    id_farmaceutico: int,
    id_receta: int,
    numero_dispensacion: int,
    dispensaciones_permitidas: int,
    timestamp_iso: str,
) -> bytes:
    """Spec §6.7 — manifiesto que el farmacéutico firma con ECDSA al dispensar."""
    return canonical_bytes({
        "id_farmaceutico": id_farmaceutico,
        "id_receta": id_receta,
        "numero_dispensacion": numero_dispensacion,
        "dispensaciones_permitidas": dispensaciones_permitidas,
        "timestamp": timestamp_iso,
        "estado": "dispensed",
    })


def build_M_cancel(
    *,
    id_receta: int,
    id_doctor: int,
    motivo: str,
    timestamp_iso: str,
    dispensaciones_realizadas_al_cancelar: int,
) -> bytes:
    """Spec §8.2 — manifiesto de cancelación firmado por el doctor."""
    return canonical_bytes({
        "id_receta": id_receta,
        "id_doctor": id_doctor,
        "motivo": motivo,
        "timestamp_cancel": timestamp_iso,
        "dispensaciones_realizadas_al_cancelar": dispensaciones_realizadas_al_cancelar,
        "version": "1",
    })


def build_ticket_refill(
    *,
    id_receta_original: int,
    id_receta_nueva: int,
    refill_number: int,
    medicamento: str,
    cantidad: int,
    id_paciente: int,
    id_farmaceutico: int,
    id_doctor: int,
    timestamp_iso: str,
) -> bytes:
    """Spec §7.3 — manifiesto que paciente y farmacéutico firman al refill.

    Las DOS firmas (firma_pac y firma_farm) se producen sobre exactamente este
    mismo blob canónico, así que verificar cada una independientemente con la
    pública correspondiente es suficiente y no hay riesgo de mismatch.
    """
    return canonical_bytes({
        "id_receta_original": id_receta_original,
        "id_receta_nueva": id_receta_nueva,
        "refill_number": refill_number,
        "medicamento": medicamento,
        "cantidad": cantidad,
        "id_paciente": id_paciente,
        "id_farmaceutico": id_farmaceutico,
        "id_doctor": id_doctor,
        "timestamp": timestamp_iso,
    })


def sha3_hex(data: bytes) -> str:
    """SHA3-256 hex — huella del R canónico persistida en BD."""
    return hashlib.sha3_256(data).hexdigest()
