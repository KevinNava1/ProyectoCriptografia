"""
dispense.py - Farmacéutico verifica y sella la receta
Curva: P-256 (SECP256R1) | Hash: SHA-256
"""
import argparse
import base64
import json
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.backends import default_backend
from cryptography.exceptions import InvalidSignature

def verificar_firma_medico(receta_firmada, archivo_pub_medico):
    with open(archivo_pub_medico, "rb") as f:
        clave_publica = serialization.load_pem_public_key(
            f.read(), backend=default_backend()
        )
    firma_b64  = receta_firmada.pop("firma_medico")
    firma_farm = receta_firmada.pop("firma_farmaceutico", None)

    contenido = json.dumps(receta_firmada, sort_keys=True).encode()
    firma_der = base64.b64decode(firma_b64)

    receta_firmada["firma_medico"] = firma_b64
    if firma_farm:
        receta_firmada["firma_farmaceutico"] = firma_farm

    try:
        clave_publica.verify(firma_der, contenido, ec.ECDSA(hashes.SHA256()))
        print("\n  >>> Firma del médico VÁLIDA <<<")
        return True
    except InvalidSignature:
        print("\n  >>> Firma del médico INVÁLIDA — receta rechazada <<<")
        return False

def sellar_receta(receta_firmada, archivo_priv_farm, farmaceutico, archivo_receta):
    with open(archivo_priv_farm, "rb") as f:
        clave_privada = serialization.load_pem_private_key(
            f.read(), password=None, backend=default_backend()
        )
    receta_firmada["estado"]       = "dispensada"
    receta_firmada["farmaceutico"] = farmaceutico

    contenido = json.dumps(receta_firmada, sort_keys=True).encode()
    firma_der = clave_privada.sign(contenido, ec.ECDSA(hashes.SHA256()))
    receta_firmada["firma_farmaceutico"] = base64.b64encode(firma_der).decode()

    with open(archivo_receta, "w") as f:
        json.dump(receta_firmada, f, indent=2, ensure_ascii=False)
    print(f"  Receta sellada y guardada: {archivo_receta}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--receta",       required=True)
    parser.add_argument("--pub_medico",   required=True)
    parser.add_argument("--priv_farm",    required=True)
    parser.add_argument("--farmaceutico", required=True)
    args = parser.parse_args()

    with open(args.receta) as f:
        receta_firmada = json.load(f)

    if verificar_firma_medico(receta_firmada, args.pub_medico):
        sellar_receta(receta_firmada, args.priv_farm,
                      args.farmaceutico, args.receta)