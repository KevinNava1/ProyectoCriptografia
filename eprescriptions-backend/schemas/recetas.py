"""Schemas del dominio de recetas (§4, §5, §6, §8, §9)."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, constr


class RecetaInput(BaseModel):
    paciente_username: constr(strip_whitespace=True, min_length=3, max_length=40)
    medicamento: constr(strip_whitespace=True, min_length=1, max_length=200)
    dosis: constr(strip_whitespace=True, min_length=1, max_length=120)
    cantidad: int = Field(ge=1, le=10_000)
    instrucciones: str = ""
    # `dispensaciones_permitidas` es la única medida: cada dispensación = un refill.
    dispensaciones_permitidas: int = Field(default=1, ge=1, le=30)
    intervalo_dias: Optional[int] = Field(default=None, ge=0, le=365)
    llave_privada_medico: str  # bundle PEM EC + RSA (el EC es el que firma)


class RecetaOutput(BaseModel):
    id: int
    medico_id: int
    paciente_id: int
    estado: str
    hash_sha3: str  # SHA3-256 hex del R canónico (huella, no verificación — ECDSA ya integra el hash)


class RecetaDescifrada(BaseModel):
    id: int
    medico_id: int
    paciente_id: int
    medico_username: Optional[str] = None
    paciente_username: Optional[str] = None
    farmaceutico_id: Optional[int] = None
    farmaceutico_username: Optional[str] = None
    fecha: str
    medicamento: str
    dosis: str
    cantidad: int
    instrucciones: str
    estado: str
    hash_sha3: str
    firma_medico: str
    firma_farmaceutico: Optional[str] = None
    dispensaciones_permitidas: int = 1
    dispensaciones_realizadas: int = 0
    parent_id: Optional[int] = None


class DispensarInput(BaseModel):
    llave_privada_farmaceutico: str  # bundle PEM EC + RSA


class CancelarInput(BaseModel):
    motivo: constr(strip_whitespace=True, min_length=3, max_length=400)
    llave_privada_medico: str


class NuevaVersionInput(RecetaInput):
    motivo_sustitucion: constr(strip_whitespace=True, min_length=3, max_length=400) = "actualizacion_terapeutica"


class FirmarTicketInput(BaseModel):
    """Paciente aporta su priv_ec para firmar el acuse de dispensación."""
    llave_privada: str  # bundle (EC del actor)
