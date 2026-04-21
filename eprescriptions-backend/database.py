"""
database.py - MySQL + modelos SQLAlchemy
"""
import os
from dotenv import load_dotenv
from sqlalchemy import (create_engine, Column, Integer, String, Text, DateTime,
                        Boolean, Enum, ForeignKey, LargeBinary, text)
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.sql import func

load_dotenv()

URL = (f"mysql+pymysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
       f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}")

engine = create_engine(URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

# ── Modelos ──────────────────────────────────────────
class Usuario(Base):
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True)
    username = Column(String(60), unique=True, nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    rol = Column(Enum("medico", "paciente", "farmaceutico"), nullable=False)
    llave_publica = Column(Text, nullable=True)
    fecha_registro = Column(DateTime, server_default=func.now())
    activo = Column(Boolean, default=True)

class Receta(Base):
    __tablename__ = "recetas"
    id = Column(Integer, primary_key=True)
    medico_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    paciente_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    farmaceutico_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    fecha_emision = Column(DateTime, server_default=func.now())
    fecha_dispensacion = Column(DateTime, nullable=True)
    estado = Column(Enum("emitida", "dispensada", "revocada"), default="emitida")
    nonce = Column(LargeBinary(12), nullable=False)
    ciphertext = Column(LargeBinary, nullable=False)
    auth_tag = Column(LargeBinary(16), nullable=False)
    hash_sha256 = Column(String(64), nullable=False)
    firma_medico = Column(Text, nullable=False)
    firma_farmaceutico = Column(Text, nullable=True)


def ensure_schema():
    """Best-effort migration for deployments that predate the username column."""
    with engine.begin() as conn:
        try:
            cols = conn.execute(text(
                "SELECT COLUMN_NAME FROM information_schema.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios'"
            )).scalars().all()
        except Exception:
            cols = []
        if cols and "username" not in cols:
            conn.execute(text(
                "ALTER TABLE usuarios ADD COLUMN username VARCHAR(60) NULL UNIQUE AFTER id"
            ))
            conn.execute(text(
                "UPDATE usuarios SET username = CONCAT('user_', id) WHERE username IS NULL"
            ))
            conn.execute(text("ALTER TABLE usuarios MODIFY username VARCHAR(60) NOT NULL"))
