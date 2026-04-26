"""Capa de persistencia — MySQL + SQLAlchemy 2.x.

Mapea 1:1 la sección §LO QUE NUNCA LLEGA AL SERVIDOR del spec maestro:
en BD SOLO viven públicas, certificados, criptogramas, firmas y audit logs.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    JSON,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    text,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from sqlalchemy.sql import func

load_dotenv()

_URL = (
    f"mysql+pymysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
    f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
    "?charset=utf8mb4"
)

engine = create_engine(_URL, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _utcnow():
    return datetime.now(timezone.utc)


# ═════════════════════════════════════════════════════════════════════
#  USUARIOS
# ═════════════════════════════════════════════════════════════════════
class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(60), unique=True, nullable=False, index=True)
    nombre = Column(String(120), nullable=False)
    email = Column(String(180), unique=True, nullable=False)

    # Argon2id string embebe parámetros + salt, pero guardamos el salt explícito
    # para cumplir literal la spec (`Argon2id(password, salt_pw)`).
    password_hash = Column(String(255), nullable=False)
    salt_pw = Column(LargeBinary(32), nullable=False)

    rol = Column(
        Enum("admin", "medico", "paciente", "farmaceutico", name="rol_enum"),
        nullable=False,
        index=True,
    )
    estado = Column(
        Enum("pendiente", "activo", "suspendido", name="estado_usuario_enum"),
        nullable=False,
        default="pendiente",
    )

    # Llaves públicas. Las privadas JAMÁS se almacenan.
    pub_ec_pem = Column(Text, nullable=True)
    pub_rsa_pem = Column(Text, nullable=True)

    fecha_registro = Column(DateTime(timezone=True), server_default=func.now())
    activo = Column(Boolean, default=True, nullable=False)

    certificados = relationship("Certificado", back_populates="usuario", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_usuarios_rol_estado", "rol", "estado"),)


# ═════════════════════════════════════════════════════════════════════
#  SOLICITUDES DE CERTIFICADO (flujo de registro)
# ═════════════════════════════════════════════════════════════════════
class SolicitudCertificado(Base):
    __tablename__ = "solicitudes_certificado"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # SET NULL al rechazar/borrar — la solicitud queda como traza histórica
    # con `estado=rechazada` y los campos snapshot rellenados.
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True, index=True)
    pub_ec_pem = Column(Text, nullable=False)
    pub_rsa_pem = Column(Text, nullable=False)
    estado = Column(
        Enum("pendiente", "aprobada", "suspendida", "rechazada", name="estado_solicitud_enum"),
        nullable=False,
        default="pendiente",
    )
    motivo_rechazo = Column(Text, nullable=True)
    fecha_solicitud = Column(DateTime(timezone=True), server_default=func.now())
    fecha_resolucion = Column(DateTime(timezone=True), nullable=True)
    # Snapshot que se rellena cuando el usuario es borrado (acción Rechazar) —
    # permite seguir viendo la solicitud rechazada en el panel admin con
    # username/nombre/email/rol intactos aunque la fila en `usuarios` ya no exista.
    username_snapshot = Column(String(60), nullable=True)
    nombre_snapshot = Column(String(120), nullable=True)
    email_snapshot = Column(String(180), nullable=True)
    rol_snapshot = Column(String(20), nullable=True)


# ═════════════════════════════════════════════════════════════════════
#  CERTIFICADOS X.509
# ═════════════════════════════════════════════════════════════════════
class Certificado(Base):
    __tablename__ = "certificados"

    id = Column(Integer, primary_key=True, autoincrement=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False, index=True)
    tipo = Column(Enum("ec", "rsa", name="cert_tipo_enum"), nullable=False)
    uso = Column(Enum("firma", "cifrado", name="cert_uso_enum"), nullable=False)
    cert_pem = Column(Text, nullable=False)
    serial_hex = Column(String(64), nullable=False, unique=True)
    fecha_emision = Column(DateTime(timezone=True), server_default=func.now())
    fecha_expiracion = Column(DateTime(timezone=True), nullable=False)
    revocado = Column(Boolean, default=False, nullable=False)
    motivo_revocacion = Column(Text, nullable=True)

    usuario = relationship("Usuario", back_populates="certificados")

    __table_args__ = (
        Index("ix_cert_usuario_tipo_activo", "usuario_id", "tipo", "revocado"),
    )


# ═════════════════════════════════════════════════════════════════════
#  RECETAS (criptograma + estado)
# ═════════════════════════════════════════════════════════════════════
class Receta(Base):
    __tablename__ = "recetas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    medico_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    paciente_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)

    # AES-256-GCM
    ciphertext = Column(LargeBinary, nullable=False)
    tag_aes = Column(LargeBinary(16), nullable=False)
    iv_aes = Column(LargeBinary(12), nullable=False)
    aad = Column(LargeBinary, nullable=False)  # JSON canónico, bytes

    # Envoltura de la DEK para el paciente (RSA-OAEP-SHA256)
    c_wrap_pac = Column(LargeBinary, nullable=False)

    # Firma del doctor sobre el JSON canónico R (ECDSA P-256 + SHA3-256)
    firma_doctor = Column(Text, nullable=False)

    # Reglas clínicas
    dispensaciones_permitidas = Column(Integer, nullable=False, default=1)
    dispensaciones_realizadas = Column(Integer, nullable=False, default=0)
    intervalo_dias = Column(Integer, nullable=True)

    estado = Column(
        Enum(
            "activa", "en_proceso", "dispensada_completa",
            "cancelada", "sustituida",
            name="estado_receta_enum",
        ),
        nullable=False,
        default="activa",
        index=True,
    )

    parent_id = Column(Integer, ForeignKey("recetas.id"), nullable=True, index=True)

    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    motivo_cancelacion = Column(Text, nullable=True)
    fecha_cancelacion = Column(DateTime(timezone=True), nullable=True)

    # Huella SHA3-256 hex del R canónico — solo identificador; la verificación
    # criptográfica vive dentro de la firma ECDSA (que ya integra SHA3-256).
    hash_sha3_hex = Column(String(64), nullable=False)

    accesos_farmacias = relationship(
        "RecetaAccesoFarmacia",
        back_populates="receta",
        cascade="all, delete-orphan",
    )
    eventos = relationship(
        "EventoDispensacion",
        back_populates="receta",
        cascade="all, delete-orphan",
        order_by="EventoDispensacion.numero_dispensacion",
    )
    cancelacion = relationship(
        "Cancelacion",
        back_populates="receta",
        uselist=False,
        cascade="all, delete-orphan",
    )


class RecetaAccesoFarmacia(Base):
    __tablename__ = "receta_acceso_farmacias"

    id = Column(Integer, primary_key=True, autoincrement=True)
    receta_id = Column(Integer, ForeignKey("recetas.id", ondelete="CASCADE"), nullable=False, index=True)
    farmacia_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    c_wrap_far = Column(LargeBinary, nullable=False)

    receta = relationship("Receta", back_populates="accesos_farmacias")

    __table_args__ = (UniqueConstraint("receta_id", "farmacia_id", name="uq_rec_farm"),)


class EventoDispensacion(Base):
    """§6 — Cada dispensación es a la vez el "ticket" del refill correspondiente.

    El farmacéutico firma `manifiesto_sello` en el momento de dispensar
    (`firma_sello`). Esa misma carga la firma luego el paciente
    (`firma_paciente`) para acuse no-repudiable. La receta avanza a
    `en_proceso`/`dispensada_completa` independientemente de la firma del
    paciente; ésta es solo evidencia adicional.
    """
    __tablename__ = "eventos_dispensacion"

    id = Column(Integer, primary_key=True, autoincrement=True)
    receta_id = Column(Integer, ForeignKey("recetas.id", ondelete="CASCADE"), nullable=False, index=True)
    farmaceutico_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    numero_dispensacion = Column(Integer, nullable=False)
    fecha_proxima_valida = Column(DateTime(timezone=True), nullable=True)
    firma_sello = Column(Text, nullable=False)  # S_F (firma farmacéutico, automática al dispensar)
    manifiesto_sello = Column(LargeBinary, nullable=False)  # JSON canónico del Sello
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    # Firma del paciente sobre el mismo `manifiesto_sello` — opcional, asíncrona.
    firma_paciente = Column(Text, nullable=True)
    fecha_firma_paciente = Column(DateTime(timezone=True), nullable=True)

    receta = relationship("Receta", back_populates="eventos")

    __table_args__ = (
        UniqueConstraint("receta_id", "numero_dispensacion", name="uq_receta_num_disp"),
    )


class Cancelacion(Base):
    __tablename__ = "cancelaciones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    receta_id = Column(Integer, ForeignKey("recetas.id", ondelete="CASCADE"), nullable=False, unique=True)
    doctor_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    manifiesto = Column(LargeBinary, nullable=False)  # M_cancel (JSON canónico)
    firma_cancel = Column(Text, nullable=False)       # S_cancel
    timestamp_cancel = Column(DateTime(timezone=True), server_default=func.now())
    motivo = Column(Text, nullable=False)

    receta = relationship("Receta", back_populates="cancelacion")


# ═════════════════════════════════════════════════════════════════════
#  AUDIT LOG
# ═════════════════════════════════════════════════════════════════════
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # SET NULL: cuando un usuario rechazado se borra para liberar username/email,
    # el audit conserva la traza histórica pero queda huérfano de FK.
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True, index=True)
    accion = Column(String(48), nullable=False, index=True)
    id_receta = Column(Integer, ForeignKey("recetas.id", ondelete="SET NULL"), nullable=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    resultado = Column(Enum("ok", "rechazado", name="audit_resultado_enum"), nullable=False, default="ok")
    meta = Column("metadata", JSON, nullable=True)  # columna "metadata" en BD (palabra reservada en SA)


# ═════════════════════════════════════════════════════════════════════
#  Helpers de bootstrap
# ═════════════════════════════════════════════════════════════════════
def drop_legacy_tables():
    """Limpia restos del esquema previo antes del create_all inicial."""
    tablas = (
        "audit_logs",
        "tickets_refill",
        "cancelaciones",
        "eventos_dispensacion",
        "receta_acceso_farmacias",
        "recetas",
        "certificados",
        "solicitudes_certificado",
        "usuarios",
    )
    with engine.begin() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))
        for t in tablas:
            conn.execute(text(f"DROP TABLE IF EXISTS {t}"))
        conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))


def init_schema(reset: bool = False):
    if reset:
        drop_legacy_tables()
    Base.metadata.create_all(bind=engine)
