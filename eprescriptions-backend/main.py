"""
main.py - API FastAPI completa
"""
import re
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field, constr
from sqlalchemy.orm import Session
import bcrypt
from typing import Literal, Optional, List
from datetime import date, datetime

from cryptography.hazmat.primitives import serialization
from cryptography.exceptions import InvalidKey, InvalidTag

from database import engine, Base, get_db, Usuario, Receta, ensure_schema
from keygen import generar_par_llaves
from prescribe import firmar, calcular_hash, cifrar
from dispense import verificar, descifrar

Base.metadata.create_all(bind=engine)
ensure_schema()

app = FastAPI(title="Secure e-prescriptions API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.-]{3,40}$")


# ── Helpers de seguridad ────────────────────────────
def _public_from_private(priv_pem: str) -> str:
    """Deriva la llave pública PEM a partir de la llave privada PEM."""
    try:
        priv = serialization.load_pem_private_key(priv_pem.encode(), password=None)
    except (ValueError, InvalidKey, TypeError):
        raise HTTPException(400, "Llave privada con formato PEM inválido")
    return priv.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode().strip()


def _assert_key_pertenece(priv_pem: str, usuario: Usuario):
    """Verifica que la llave privada corresponde al usuario (pub_from_priv == pub_BD)."""
    if not usuario.llave_publica:
        raise HTTPException(403, "Este usuario no tiene llave pública registrada")
    derivada = _public_from_private(priv_pem)
    guardada = usuario.llave_publica.strip()
    if derivada != guardada:
        raise HTTPException(403, "La llave privada no pertenece a este usuario")


def _usuario_publico(u: Usuario, priv_pem: Optional[str] = None) -> "UsuarioOutput":
    return UsuarioOutput(
        id=u.id, username=u.username, nombre=u.nombre, email=u.email,
        rol=u.rol, llave_privada=priv_pem, llave_publica=u.llave_publica,
    )


# ── Schemas Pydantic ─────────────────────────────────
class UsuarioInput(BaseModel):
    username: constr(strip_whitespace=True, min_length=3, max_length=40)
    nombre:   constr(strip_whitespace=True, min_length=2, max_length=100)
    email:    EmailStr
    password: constr(min_length=6, max_length=120)
    rol: Literal["medico", "paciente", "farmaceutico"]

class UsuarioOutput(BaseModel):
    id: int
    username: str
    nombre: str
    email: EmailStr
    rol: str
    llave_privada: Optional[str] = None
    llave_publica: Optional[str] = None

class LoginInput(BaseModel):
    username: constr(strip_whitespace=True, min_length=3, max_length=40)
    password: constr(min_length=1)
    rol: Literal["medico", "paciente", "farmaceutico"]

class RecetaInput(BaseModel):
    paciente_username: constr(strip_whitespace=True, min_length=3, max_length=40)
    medicamento:       constr(strip_whitespace=True, min_length=1, max_length=200)
    dosis:             constr(strip_whitespace=True, min_length=1, max_length=120)
    cantidad:          int = Field(ge=1, le=10_000)
    instrucciones:     str = ""
    llave_privada_medico: str

class RecetaOutput(BaseModel):
    id:          int
    medico_id:   int
    paciente_id: int
    estado:      str
    hash_sha256: str

class RecetaDescifrada(BaseModel):
    id:              int
    medico_id:       int
    paciente_id:     int
    medico_username: Optional[str] = None
    paciente_username: Optional[str] = None
    farmaceutico_id: Optional[int] = None
    farmaceutico_username: Optional[str] = None
    fecha:           str
    medicamento:     str
    dosis:           str
    cantidad:        int
    instrucciones:   str
    estado:          str
    hash_sha256:     str
    firma_medico:    str
    firma_farmaceutico: Optional[str] = None

class DispensarInput(BaseModel):
    llave_privada_farmaceutico: str


# ── Endpoints ────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "ok", "api": "Secure e-prescriptions"}


@app.post("/usuarios/registro", response_model=UsuarioOutput, status_code=201)
def registrar(datos: UsuarioInput, db: Session = Depends(get_db)):
    if not USERNAME_RE.match(datos.username):
        raise HTTPException(400, "El username solo admite letras, números, '.', '_' y '-' (3-40 caracteres)")

    if db.query(Usuario).filter(Usuario.username == datos.username).first():
        raise HTTPException(409, "Ese nombre de usuario ya está en uso")
    if db.query(Usuario).filter(Usuario.email == datos.email).first():
        raise HTTPException(409, "El email ya está registrado")

    priv_pem, pub_pem = (None, None)
    if datos.rol in ("medico", "farmaceutico"):
        priv_pem, pub_pem = generar_par_llaves()

    nuevo = Usuario(
        username=datos.username,
        nombre=datos.nombre,
        email=datos.email,
        password_hash=bcrypt.hashpw(datos.password.encode(), bcrypt.gensalt()).decode(),
        rol=datos.rol,
        llave_publica=pub_pem,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return _usuario_publico(nuevo, priv_pem=priv_pem)


@app.post("/usuarios/login", response_model=UsuarioOutput)
def login(datos: LoginInput, db: Session = Depends(get_db)):
    """Login con username + password + rol. Valida credenciales y rol."""
    u = db.query(Usuario).filter(Usuario.username == datos.username).first()
    if not u or not bcrypt.checkpw(datos.password.encode(), u.password_hash.encode()):
        raise HTTPException(401, "Usuario o contraseña incorrectos")
    if u.rol != datos.rol:
        raise HTTPException(
            403,
            f"Este usuario no tiene rol '{datos.rol}'. Su rol real es '{u.rol}'."
        )
    if not u.activo:
        raise HTTPException(403, "Cuenta desactivada")
    return _usuario_publico(u)


@app.get("/usuarios/{username}", response_model=UsuarioOutput)
def obtener_usuario(username: str, db: Session = Depends(get_db)):
    u = db.query(Usuario).filter(Usuario.username == username).first()
    if not u:
        raise HTTPException(404, "Usuario no encontrado")
    return _usuario_publico(u)


# ── Recetas ───────────────────────────────────────────
def _hidratar(r: Receta, db: Session) -> RecetaDescifrada:
    datos = descifrar(r.nonce, r.ciphertext, r.auth_tag)
    medico = db.query(Usuario).filter(Usuario.id == r.medico_id).first()
    paciente = db.query(Usuario).filter(Usuario.id == r.paciente_id).first()
    farmaceutico = db.query(Usuario).filter(Usuario.id == r.farmaceutico_id).first() if r.farmaceutico_id else None
    return RecetaDescifrada(
        id=r.id, medico_id=r.medico_id, paciente_id=r.paciente_id,
        medico_username=medico.username if medico else None,
        paciente_username=paciente.username if paciente else None,
        farmaceutico_id=r.farmaceutico_id,
        farmaceutico_username=farmaceutico.username if farmaceutico else None,
        fecha=datos["fecha"], medicamento=datos["medicamento"],
        dosis=datos["dosis"], cantidad=datos["cantidad"],
        instrucciones=datos.get("instrucciones", ""),
        estado=r.estado,
        hash_sha256=r.hash_sha256,
        firma_medico=r.firma_medico,
        firma_farmaceutico=r.firma_farmaceutico,
    )


@app.post("/recetas", response_model=RecetaOutput, status_code=201)
def crear_receta(
    medico_id: int,
    datos: RecetaInput,
    db: Session = Depends(get_db)
):
    medico = db.query(Usuario).filter(Usuario.id == medico_id).first()
    if not medico or medico.rol != "medico":
        raise HTTPException(403, "Solo los médicos pueden emitir recetas")

    # La llave privada debe pertenecer al médico autenticado
    _assert_key_pertenece(datos.llave_privada_medico, medico)

    paciente = db.query(Usuario).filter(
        Usuario.username == datos.paciente_username,
        Usuario.rol == "paciente",
    ).first()
    if not paciente:
        raise HTTPException(404, f"No existe un paciente con username '{datos.paciente_username}'")

    receta_dict = {
        "medico_id":     medico_id,
        "paciente_id":   paciente.id,
        "fecha":         str(date.today()),
        "medicamento":   datos.medicamento,
        "dosis":         datos.dosis,
        "cantidad":      datos.cantidad,
        "instrucciones": datos.instrucciones,
        "estado":        "emitida",
    }

    firma_b64 = firmar(receta_dict, datos.llave_privada_medico)
    hash_sha = calcular_hash(receta_dict)
    nonce, ciphertext, auth_tag = cifrar(receta_dict)

    nueva = Receta(
        medico_id=medico_id, paciente_id=paciente.id,
        nonce=nonce, ciphertext=ciphertext, auth_tag=auth_tag,
        hash_sha256=hash_sha, firma_medico=firma_b64,
    )
    db.add(nueva)
    db.commit()
    db.refresh(nueva)

    return RecetaOutput(
        id=nueva.id, medico_id=nueva.medico_id,
        paciente_id=nueva.paciente_id, estado=nueva.estado,
        hash_sha256=nueva.hash_sha256,
    )


@app.get("/recetas/paciente/{paciente_id}", response_model=List[RecetaDescifrada])
def consultar_recetas_paciente(paciente_id: int, db: Session = Depends(get_db)):
    paciente = db.query(Usuario).filter(Usuario.id == paciente_id).first()
    if not paciente or paciente.rol != "paciente":
        raise HTTPException(404, "Paciente no encontrado")
    recetas = db.query(Receta).filter(Receta.paciente_id == paciente_id).order_by(Receta.id.desc()).all()
    return [_hidratar(r, db) for r in recetas]


@app.get("/recetas/medico/{medico_id}", response_model=List[RecetaDescifrada])
def consultar_recetas_medico(medico_id: int, db: Session = Depends(get_db)):
    medico = db.query(Usuario).filter(Usuario.id == medico_id).first()
    if not medico or medico.rol != "medico":
        raise HTTPException(404, "Médico no encontrado")
    recetas = db.query(Receta).filter(Receta.medico_id == medico_id).order_by(Receta.id.desc()).all()
    return [_hidratar(r, db) for r in recetas]


@app.get("/recetas/farmaceutico/{farmaceutico_id}", response_model=List[RecetaDescifrada])
def consultar_recetas_farmaceutico(farmaceutico_id: int, db: Session = Depends(get_db)):
    farm = db.query(Usuario).filter(Usuario.id == farmaceutico_id).first()
    if not farm or farm.rol != "farmaceutico":
        raise HTTPException(404, "Farmacéutico no encontrado")
    recetas = db.query(Receta).filter(Receta.farmaceutico_id == farmaceutico_id).order_by(Receta.id.desc()).all()
    return [_hidratar(r, db) for r in recetas]


@app.get("/recetas/pendientes", response_model=List[RecetaDescifrada])
def listar_recetas_pendientes(db: Session = Depends(get_db)):
    recetas = db.query(Receta).filter(Receta.estado == "emitida").order_by(Receta.id.desc()).all()
    return [_hidratar(r, db) for r in recetas]


@app.get("/recetas/{receta_id}/verificar-firmas")
def verificar_firmas(receta_id: int, db: Session = Depends(get_db)):
    """
    Re-verifica criptográficamente la(s) firma(s) ECDSA de una receta
    usando las LLAVES PÚBLICAS del médico (y del farmacéutico, si ya fue
    dispensada). Diseñado para que el paciente pueda confirmar la cadena
    de autoría sin necesidad de llaves privadas.
    """
    receta = db.query(Receta).filter(Receta.id == receta_id).first()
    if not receta:
        raise HTTPException(404, "Receta no encontrada")

    print("─" * 72, flush=True)
    print(
        f"[VERIFICAR] Paciente solicitó verificación criptográfica "
        f"de la receta #{receta.id}",
        flush=True,
    )

    # ── 1) AES-256-GCM: el auth_tag se valida durante el descifrado.
    #    Si fue alterado el ciphertext, el nonce o el tag, InvalidTag.
    aes_ok = True
    contenido = None
    try:
        contenido = descifrar(receta.nonce, receta.ciphertext, receta.auth_tag)
        print(
            "[VERIFICAR] AES-256-GCM OK — el auth tag de 128 bits coincide, "
            "el ciphertext no fue alterado y el nonce es auténtico.",
            flush=True,
        )
    except (InvalidTag, Exception) as exc:
        aes_ok = False
        print(f"[VERIFICAR] AES-256-GCM FAIL — {type(exc).__name__}", flush=True)

    # Si el descifrado falló no podemos continuar con hash/firmas.
    if not aes_ok or contenido is None:
        print("─" * 72, flush=True)
        return {
            "receta_id": receta.id,
            "estado": receta.estado,
            "cifrado_aes_gcm": False,
            "integridad_sha256": False,
            "medico": None,
            "farmaceutico": None,
        }

    # ── 2) SHA-256 sobre el dict que firmó el médico (estado=emitida, sin
    #    farmaceutico_id). El hash_sha256 de BD fue calculado sobre ese dict.
    contenido_emitida = {**contenido, "estado": "emitida"}
    contenido_emitida.pop("farmaceutico_id", None)
    hash_ok = calcular_hash(contenido_emitida) == receta.hash_sha256

    medico = db.query(Usuario).filter(Usuario.id == receta.medico_id).first()
    farmaceutico = (
        db.query(Usuario).filter(Usuario.id == receta.farmaceutico_id).first()
        if receta.farmaceutico_id else None
    )

    # ── 3) Firma ECDSA del médico (P-256 + SHA-256)
    print(
        f"[VERIFICAR] Llave pública del MÉDICO @{medico.username} "
        "(valida la firma de emisión):",
        flush=True,
    )
    print(medico.llave_publica.strip(), flush=True)
    firma_medico_ok = verificar(
        contenido_emitida, receta.firma_medico, medico.llave_publica
    )

    # ── 4) Firma ECDSA del farmacéutico (si ya dispensó)
    firma_farm_ok = None
    if farmaceutico and receta.firma_farmaceutico:
        print(
            f"[VERIFICAR] Llave pública del FARMACÉUTICO @{farmaceutico.username} "
            "(valida la firma de dispensación):",
            flush=True,
        )
        print(farmaceutico.llave_publica.strip(), flush=True)
        firma_farm_ok = verificar(
            contenido, receta.firma_farmaceutico, farmaceutico.llave_publica
        )

    print(
        f"[VERIFICAR] aes_gcm={'OK' if aes_ok else 'FAIL'} · "
        f"sha256={'OK' if hash_ok else 'FAIL'} · "
        f"firma_medico={'OK' if firma_medico_ok else 'FAIL'}"
        + (f" · firma_farmaceutico={'OK' if firma_farm_ok else 'FAIL'}"
           if firma_farm_ok is not None else ""),
        flush=True,
    )
    print("─" * 72, flush=True)

    return {
        "receta_id": receta.id,
        "estado": receta.estado,
        "cifrado_aes_gcm": aes_ok,
        "integridad_sha256": hash_ok,
        "medico": {
            "id": medico.id,
            "username": medico.username,
            "nombre": medico.nombre,
            "llave_publica": medico.llave_publica,
            "firma_valida": firma_medico_ok,
        },
        "farmaceutico": (
            {
                "id": farmaceutico.id,
                "username": farmaceutico.username,
                "nombre": farmaceutico.nombre,
                "llave_publica": farmaceutico.llave_publica,
                "firma_valida": firma_farm_ok,
            } if farmaceutico else None
        ),
    }


@app.post("/recetas/{receta_id}/dispensar")
def dispensar_receta(
    receta_id: int,
    farmaceutico_id: int,
    datos: DispensarInput,
    db: Session = Depends(get_db)
):
    receta = db.query(Receta).filter(Receta.id == receta_id).first()
    if not receta:
        raise HTTPException(404, "Receta no encontrada")
    if receta.estado != "emitida":
        raise HTTPException(400, f"La receta ya está en estado '{receta.estado}'")

    farmaceutico = db.query(Usuario).filter(Usuario.id == farmaceutico_id).first()
    if not farmaceutico or farmaceutico.rol != "farmaceutico":
        raise HTTPException(403, "Solo los farmacéuticos pueden dispensar")

    # La llave privada debe pertenecer al farmacéutico autenticado
    _assert_key_pertenece(datos.llave_privada_farmaceutico, farmaceutico)

    try:
        contenido = descifrar(receta.nonce, receta.ciphertext, receta.auth_tag)
    except Exception:
        raise HTTPException(400, "INTEGRIDAD COMPROMETIDA — fallo en descifrado AES-GCM")

    hash_recalculado = calcular_hash(contenido)
    if hash_recalculado != receta.hash_sha256:
        raise HTTPException(400, "INTEGRIDAD COMPROMETIDA — hash SHA-256 no coincide")

    medico = db.query(Usuario).filter(Usuario.id == receta.medico_id).first()

    print("─" * 72, flush=True)
    print(
        f"[DISPENSAR] Farmacéutico @{farmaceutico.username} (id={farmaceutico_id}) "
        f"solicitó la LLAVE PÚBLICA del médico @{medico.username} (id={medico.id})",
        flush=True,
    )
    print(
        "[DISPENSAR] Motivo: verificar la firma ECDSA (P-256 + SHA-256) "
        "que el médico generó al emitir la receta #{0}.".format(receta.id),
        flush=True,
    )
    print("[DISPENSAR] Llave pública del médico (PEM):", flush=True)
    print(medico.llave_publica.strip(), flush=True)
    print("─" * 72, flush=True)

    if not verificar(contenido, receta.firma_medico, medico.llave_publica):
        raise HTTPException(400, "FIRMA INVÁLIDA — la receta no fue emitida por un médico autorizado")

    print(
        f"[DISPENSAR] ✔ Firma ECDSA del médico @{medico.username} VERIFICADA "
        f"para la receta #{receta.id}",
        flush=True,
    )

    contenido["estado"] = "dispensada"
    contenido["farmaceutico_id"] = farmaceutico_id
    firma_farm = firmar(contenido, datos.llave_privada_farmaceutico)

    nonce_nuevo, ct_nuevo, tag_nuevo = cifrar(contenido)

    receta.estado             = "dispensada"
    receta.farmaceutico_id    = farmaceutico_id
    receta.fecha_dispensacion = datetime.now()
    receta.firma_farmaceutico = firma_farm
    receta.nonce              = nonce_nuevo
    receta.ciphertext         = ct_nuevo
    receta.auth_tag           = tag_nuevo
    db.commit()

    return {
        "mensaje": "Receta dispensada correctamente",
        "receta_id": receta.id,
        "estado": "dispensada",
        "verificaciones": {
            "integridad_sha256": "OK",
            "firma_medico_ecdsa": "OK",
            "firma_farmaceutico": "agregada"
        }
    }
