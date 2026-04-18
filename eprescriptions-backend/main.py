"""
main.py - API FastAPI completa
"""
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
import bcrypt
from typing import Literal, Optional, List
from datetime import date

from database import engine, Base, get_db, Usuario, Receta
from keygen import generar_par_llaves
from prescribe import firmar, calcular_hash, cifrar
from dispense import verificar, descifrar
from datetime import date, datetime

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Secure e-prescriptions API")

# ── Schemas Pydantic ─────────────────────────────────
class UsuarioInput(BaseModel):
    nombre: str
    email: EmailStr
    password: str
    rol: Literal["medico", "paciente", "farmaceutico"]

class UsuarioOutput(BaseModel):
    id: int
    nombre: str
    email: EmailStr
    rol: str
    llave_privada: Optional[str] = None

class RecetaInput(BaseModel):
    paciente_id:   int
    medicamento:   str
    dosis:         str
    cantidad:      int
    instrucciones: str
    llave_privada_medico: str    # el médico la envía al firmar

class RecetaOutput(BaseModel):
    id:          int
    medico_id:   int
    paciente_id: int
    estado:      str
    hash_sha256: str

class RecetaDescifrada(BaseModel):
    id:            int
    medico_id:     int
    paciente_id:   int
    fecha:         str
    medicamento:   str
    dosis:         str
    cantidad:      int
    instrucciones: str
    estado:        str
    hash_sha256:   str
    firma_medico:  str

class DispensarInput(BaseModel):
    farmaceutico_id: int
    llave_privada_farmaceutico: str

# ── Endpoints ────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "ok", "api": "Secure e-prescriptions"}

@app.post("/usuarios/registro", response_model=UsuarioOutput, status_code=201)
def registrar(datos: UsuarioInput, db: Session = Depends(get_db)):
    if db.query(Usuario).filter(Usuario.email == datos.email).first():
        raise HTTPException(409, "El email ya está registrado")

    priv_pem, pub_pem = (None, None)
    if datos.rol in ("medico", "farmaceutico"):
        priv_pem, pub_pem = generar_par_llaves()

    nuevo = Usuario(
        nombre=datos.nombre,
        email=datos.email,
        password_hash=bcrypt.hashpw(datos.password.encode(), bcrypt.gensalt()).decode(),
        rol=datos.rol,
        llave_publica=pub_pem,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)

    return UsuarioOutput(
        id=nuevo.id, nombre=nuevo.nombre, email=nuevo.email,
        rol=nuevo.rol, llave_privada=priv_pem
    )

@app.post("/recetas", response_model=RecetaOutput, status_code=201)
def crear_receta(
    medico_id: int,
    datos: RecetaInput,
    db: Session = Depends(get_db)
):
    # 1. Verificar que el médico existe y es médico
    medico = db.query(Usuario).filter(Usuario.id == medico_id).first()
    if not medico or medico.rol != "medico":
        raise HTTPException(403, "Solo los médicos pueden emitir recetas")

    # 2. Verificar que el paciente existe
    paciente = db.query(Usuario).filter(Usuario.id == datos.paciente_id).first()
    if not paciente or paciente.rol != "paciente":
        raise HTTPException(404, "Paciente no encontrado")

    # 3. Construir la receta
    receta_dict = {
        "medico_id":     medico_id,
        "paciente_id":   datos.paciente_id,
        "fecha":         str(date.today()),
        "medicamento":   datos.medicamento,
        "dosis":         datos.dosis,
        "cantidad":      datos.cantidad,
        "instrucciones": datos.instrucciones,
        "estado":        "emitida",
    }

    # 4. Firmar con ECDSA (llave privada del médico)
    firma_b64 = firmar(receta_dict, datos.llave_privada_medico)

    # 5. Calcular hash SHA-256 de integridad
    hash_sha = calcular_hash(receta_dict)

    # 6. Cifrar con AES-256-GCM
    nonce, ciphertext, auth_tag = cifrar(receta_dict)

    # 7. Guardar en BD
    nueva = Receta(
        medico_id    = medico_id,
        paciente_id  = datos.paciente_id,
        nonce        = nonce,
        ciphertext   = ciphertext,
        auth_tag     = auth_tag,
        hash_sha256  = hash_sha,
        firma_medico = firma_b64,
    )
    db.add(nueva)
    db.commit()
    db.refresh(nueva)

    return RecetaOutput(
        id=nueva.id, medico_id=nueva.medico_id,
        paciente_id=nueva.paciente_id, estado=nueva.estado,
        hash_sha256=nueva.hash_sha256,
    )

from typing import List

@app.get("/recetas/paciente/{paciente_id}", response_model=List[RecetaDescifrada])
def consultar_recetas_paciente(paciente_id: int, db: Session = Depends(get_db)):
    # Verificar que el paciente existe
    paciente = db.query(Usuario).filter(Usuario.id == paciente_id).first()
    if not paciente or paciente.rol != "paciente":
        raise HTTPException(404, "Paciente no encontrado")

    # Traer todas sus recetas
    recetas = db.query(Receta).filter(Receta.paciente_id == paciente_id).all()

    resultado = []
    for r in recetas:
        # Descifrar cada receta
        datos = descifrar(r.nonce, r.ciphertext, r.auth_tag)

        resultado.append(RecetaDescifrada(
            id            = r.id,
            medico_id     = r.medico_id,
            paciente_id   = r.paciente_id,
            fecha         = datos["fecha"],
            medicamento   = datos["medicamento"],
            dosis         = datos["dosis"],
            cantidad      = datos["cantidad"],
            instrucciones = datos["instrucciones"],
            estado        = r.estado,
            hash_sha256   = r.hash_sha256,
            firma_medico  = r.firma_medico,
        ))
    return resultado

@app.post("/recetas/{receta_id}/dispensar")
def dispensar_receta(
    receta_id: int,
    datos: DispensarInput,
    db: Session = Depends(get_db)
):
    # 1. Buscar la receta
    receta = db.query(Receta).filter(Receta.id == receta_id).first()
    if not receta:
        raise HTTPException(404, "Receta no encontrada")
    if receta.estado != "emitida":
        raise HTTPException(400, f"La receta ya está en estado '{receta.estado}'")

    # 2. Verificar farmacéutico
    farmaceutico = db.query(Usuario).filter(Usuario.id == datos.farmaceutico_id).first()
    if not farmaceutico or farmaceutico.rol != "farmaceutico":
        raise HTTPException(403, "Solo los farmacéuticos pueden dispensar")

    # 3. Descifrar la receta con AES-256-GCM
    try:
        contenido = descifrar(receta.nonce, receta.ciphertext, receta.auth_tag)
    except Exception:
        raise HTTPException(400, "INTEGRIDAD COMPROMETIDA — fallo en descifrado AES-GCM")

    # 4. Verificar integridad con SHA-256
    hash_recalculado = calcular_hash(contenido)
    if hash_recalculado != receta.hash_sha256:
        raise HTTPException(400, "INTEGRIDAD COMPROMETIDA — hash SHA-256 no coincide")

    # 5. Verificar firma ECDSA del médico
    medico = db.query(Usuario).filter(Usuario.id == receta.medico_id).first()
    if not verificar(contenido, receta.firma_medico, medico.llave_publica):
        raise HTTPException(400, "FIRMA INVÁLIDA — la receta no fue emitida por un médico autorizado")

    # 6. Todo correcto → sellar con firma del farmacéutico
    contenido["estado"] = "dispensada"
    contenido["farmaceutico_id"] = datos.farmaceutico_id
    firma_farm = firmar(contenido, datos.llave_privada_farmaceutico)

    # 7. Re-cifrar la receta actualizada
    nonce_nuevo, ct_nuevo, tag_nuevo = cifrar(contenido)

    # 8. Actualizar en BD
    receta.estado             = "dispensada"
    receta.farmaceutico_id    = datos.farmaceutico_id
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

@app.get("/recetas/pendientes", response_model=List[RecetaDescifrada])
def listar_recetas_pendientes(db: Session = Depends(get_db)):
    recetas = db.query(Receta).filter(Receta.estado == "emitida").all()
    resultado = []
    for r in recetas:
        datos = descifrar(r.nonce, r.ciphertext, r.auth_tag)
        resultado.append(RecetaDescifrada(
            id=r.id, medico_id=r.medico_id, paciente_id=r.paciente_id,
            fecha=datos["fecha"], medicamento=datos["medicamento"],
            dosis=datos["dosis"], cantidad=datos["cantidad"],
            instrucciones=datos["instrucciones"], estado=r.estado,
            hash_sha256=r.hash_sha256, firma_medico=r.firma_medico,
        ))
    return resultado