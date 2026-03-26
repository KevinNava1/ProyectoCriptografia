"""
prescribe.py - Médico crea y firma una receta
Curva: P-256 (SECP256R1) | Hash: SHA-256
"""
import argparse
import base64
import json
import os
from datetime import date
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.backends import default_backend

def crear_receta(medico, paciente, medicamento, dosis, cantidad, instrucciones):
    return {
        "medico":        medico,
        "paciente":      paciente,
        "fecha":         str(date.today()),
        "medicamento":   medicamento,
        "dosis":         dosis,
        "cantidad":      cantidad,
        "instrucciones": instrucciones,
        "estado":        "emitida"
    }

def firmar_receta(receta, archivo_priv):
    with open(archivo_priv, "rb") as f:
        clave_privada = serialization.load_pem_private_key(
            f.read(), password=None, backend=default_backend()
        )
    contenido = json.dumps(receta, sort_keys=True).encode()
    firma_der = clave_privada.sign(contenido, ec.ECDSA(hashes.SHA256()))
    receta_firmada = receta.copy()
    receta_firmada["firma_medico"] = base64.b64encode(firma_der).decode()
    return receta_firmada

def guardar(receta_firmada, directorio="prescriptions"):
    os.makedirs(directorio, exist_ok=True)
    nombre = f"{directorio}/{receta_firmada['paciente']}_{receta_firmada['fecha']}.json"
    with open(nombre, "w") as f:
        json.dump(receta_firmada, f, indent=2, ensure_ascii=False)
    print(f"\n  Receta guardada: {nombre}")
    print(f"  Firma (Base64):  {receta_firmada['firma_medico'][:60]}...")
    return nombre

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--medico",        required=True)
    parser.add_argument("--paciente",      required=True)
    parser.add_argument("--medicamento",   required=True)
    parser.add_argument("--dosis",         required=True)
    parser.add_argument("--cantidad",      required=True)
    parser.add_argument("--instrucciones", required=True)
    parser.add_argument("--privkey",       required=True)
    args = parser.parse_args()

    receta = crear_receta(
        args.medico, args.paciente, args.medicamento,
        args.dosis, args.cantidad, args.instrucciones
    )
    receta_firmada = firmar_receta(receta, args.privkey)
    guardar(receta_firmada)