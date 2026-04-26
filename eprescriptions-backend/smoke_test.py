"""Smoke test del flujo canónico completo.

Ejecuta: registro × 3 roles (quedan pendientes) → admin aprueba → login × 3
→ crear receta → dispensar × 2 → rechazo 3era → cancelar → verificar firmas
→ nueva versión → RBAC negativos.

Requiere que el admin esté bootstrappeado antes (ADMIN_PASSWORD en el env
del servidor o `python -m scripts.bootstrap_admin` ejecutado una vez).
"""
import os, sys, time, requests, random, string, base64

BASE = "http://127.0.0.1:8000"
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")


def _rand(n=6):
    return "".join(random.choices(string.ascii_lowercase, k=n))


def reg(rol, username):
    r = requests.post(f"{BASE}/usuarios/registro", json={
        "username": username,
        "nombre": username.title(),
        "email": f"{username}@hosp.mx",
        "password": "secreto123",
        "rol": rol,
    })
    assert r.ok, r.text
    return r.json()


def login(username, rol):
    r = requests.post(f"{BASE}/usuarios/login", json={
        "username": username, "password": "secreto123", "rol": rol,
    })
    assert r.ok, r.text
    return r.json()


def headers(token, priv=None):
    h = {"Authorization": f"Bearer {token}"}
    if priv:
        # Las cabeceras HTTP no admiten CR/LF, así que viaja en base64.
        h["X-Priv-Keys"] = base64.b64encode(priv.encode("utf-8")).decode("ascii")
    return h


def main():
    if not ADMIN_PASSWORD:
        print("✘ Falta ADMIN_PASSWORD en el entorno del smoke test.", file=sys.stderr)
        print("   Exporta ADMIN_PASSWORD (y ADMIN_USERNAME si no es 'admin').", file=sys.stderr)
        sys.exit(2)

    tag = _rand(4)
    docu = f"doc_{tag}"
    paci = f"pac_{tag}"
    farm = f"far_{tag}"
    print(f"[0] Login admin")
    a = requests.post(f"{BASE}/usuarios/login", json={
        "username": ADMIN_USERNAME, "password": ADMIN_PASSWORD, "rol": "admin",
    })
    assert a.ok, f"admin no bootstrappeado: {a.text}"
    al = a.json()
    assert al.get("token"), "admin no devolvió JWT"
    adm_headers = {"Authorization": f"Bearer {al['token']}"}

    print(f"[1] Registro roles ({tag}) — quedan en estado=pendiente")
    d = reg("medico", docu)
    p = reg("paciente", paci)
    f = reg("farmaceutico", farm)
    assert "BEGIN" in d["llave_privada"] and "BEGIN" in p["llave_privada"] and "BEGIN" in f["llave_privada"]
    assert d["llave_privada"].count("BEGIN") == 2, "bundle debería traer EC+RSA"
    assert d["estado"] == "pendiente" and p["estado"] == "pendiente" and f["estado"] == "pendiente"

    print("[1b] Login sin aprobación debe fallar (403)")
    r = requests.post(f"{BASE}/usuarios/login", json={
        "username": docu, "password": "secreto123", "rol": "medico",
    })
    assert r.status_code == 403, f"esperado 403, recibido {r.status_code}"

    print("[1c] Admin lista solicitudes pendientes y aprueba las 3")
    r = requests.get(f"{BASE}/admin/solicitudes?estado=pendiente", headers=adm_headers)
    assert r.ok, r.text
    pend = r.json()
    nuestras = [s for s in pend if s["username"] in {docu, paci, farm}]
    assert len(nuestras) == 3, f"esperaba 3 solicitudes, vi {len(nuestras)}"
    for s in nuestras:
        ok = requests.post(f"{BASE}/admin/solicitudes/{s['id']}/aprobar", headers=adm_headers)
        assert ok.ok, ok.text

    print("[2] Login (ahora sí, con certs emitidos)")
    dl = login(docu, "medico")
    pl = login(paci, "paciente")
    fl = login(farm, "farmaceutico")
    for x in (dl, pl, fl):
        assert x.get("token"), "falta JWT"

    print("[3] Crear receta")
    rc = requests.post(
        f"{BASE}/recetas?medico_id={dl['id']}",
        headers=headers(dl["token"]),
        json={
            "paciente_username": paci,
            "medicamento": "Amoxicilina 500mg",
            "dosis": "1 cada 8 hrs",
            "cantidad": 21,
            "instrucciones": "Tomar después de comer",
            "dispensaciones_permitidas": 2,
            "intervalo_dias": None,
            "llave_privada_medico": d["llave_privada"],
        },
    )
    assert rc.ok, rc.text
    receta = rc.json()
    print(f"    receta #{receta['id']} estado={receta['estado']} hash={receta['hash_sha3'][:16]}…")

    print("[4] Paciente consulta (descifra con RSA propia)")
    r = requests.get(f"{BASE}/recetas/paciente/{pl['id']}",
                     headers=headers(pl["token"], p["llave_privada"]))
    assert r.ok, r.text
    lst = r.json()
    assert len(lst) == 1
    assert lst[0]["medicamento"] == "Amoxicilina 500mg", lst[0]
    print(f"    Paciente ve: {lst[0]['medicamento']} · {lst[0]['dosis']}")

    print("[5] Farmacia lista pendientes y dispensa")
    r = requests.get(f"{BASE}/recetas/pendientes",
                     headers=headers(fl["token"], f["llave_privada"]))
    assert r.ok, r.text
    pendientes = r.json()
    assert any(x["id"] == receta["id"] for x in pendientes), "receta debe aparecer en pendientes"

    r = requests.post(
        f"{BASE}/recetas/{receta['id']}/dispensar?farmaceutico_id={fl['id']}",
        headers=headers(fl["token"]),
        json={"llave_privada_farmaceutico": f["llave_privada"]},
    )
    assert r.ok, r.text
    disp = r.json()
    ev1_id = disp["evento_id"]
    print(f"    dispensacion #{disp['numero_dispensacion']} de {disp['dispensaciones_permitidas']} · evento #{ev1_id}")
    assert disp["verificaciones"]["firma_medico_ecdsa_sha3"] == "OK"
    assert disp["ticket_estado"] == "pendiente_paciente"

    print("[5b] Lock: 2da dispensación bloqueada hasta que el paciente firme acuse")
    rblock = requests.post(
        f"{BASE}/recetas/{receta['id']}/dispensar?farmaceutico_id={fl['id']}",
        headers=headers(fl["token"]),
        json={"llave_privada_farmaceutico": f["llave_privada"]},
    )
    assert rblock.status_code == 409, f"expected 409 lock, got {rblock.status_code}: {rblock.text}"
    assert "acuse" in rblock.text.lower()

    print("[5c] Paciente firma acuse #1 → desbloquea")
    rsig = requests.post(
        f"{BASE}/recetas/eventos-dispensacion/{ev1_id}/firmar-paciente",
        headers=headers(pl["token"]),
        json={"llave_privada": p["llave_privada"]},
    )
    assert rsig.ok, rsig.text
    assert rsig.json()["estado"] == "completo"

    print("[6] Dispensación 2/2 → dispensada_completa (ya desbloqueada)")
    r = requests.post(
        f"{BASE}/recetas/{receta['id']}/dispensar?farmaceutico_id={fl['id']}",
        headers=headers(fl["token"]),
        json={"llave_privada_farmaceutico": f["llave_privada"]},
    )
    assert r.ok, r.text
    assert r.json()["estado"] == "dispensada", r.json()
    ev2_id = r.json()["evento_id"]

    # Firmar el segundo acuse para no dejar lock pendiente.
    requests.post(
        f"{BASE}/recetas/eventos-dispensacion/{ev2_id}/firmar-paciente",
        headers=headers(pl["token"]),
        json={"llave_privada": p["llave_privada"]},
    ).raise_for_status()

    print("[7] Tercera dispensación debe ser rechazada (sin disponibilidad)")
    r = requests.post(
        f"{BASE}/recetas/{receta['id']}/dispensar?farmaceutico_id={fl['id']}",
        headers=headers(fl["token"]),
        json={"llave_privada_farmaceutico": f["llave_privada"]},
    )
    assert not r.ok and r.status_code == 400, f"expected 400, got {r.status_code}"

    print("[8] Crear segunda receta y cancelarla")
    rc = requests.post(
        f"{BASE}/recetas?medico_id={dl['id']}",
        headers=headers(dl["token"]),
        json={
            "paciente_username": paci,
            "medicamento": "Ibuprofeno 400mg",
            "dosis": "1 c/12h",
            "cantidad": 10,
            "instrucciones": "",
            "dispensaciones_permitidas": 1,
            "llave_privada_medico": d["llave_privada"],
        },
    )
    assert rc.ok, rc.text
    rec2 = rc.json()
    r = requests.post(f"{BASE}/recetas/{rec2['id']}/cancelar",
                      headers=headers(dl["token"]),
                      json={"motivo": "cambio_de_terapia", "llave_privada_medico": d["llave_privada"]})
    assert r.ok, r.text
    print(f"    receta #{rec2['id']} cancelada")

    print("[9] Verificar firmas (sin priv keys — firma del sello farmacéutico)")
    r = requests.get(f"{BASE}/recetas/{receta['id']}/verificar-firmas")
    assert r.ok, r.text
    v = r.json()
    print(f"    aes_ok={v['cifrado_aes_gcm']} · firma_farm={v['farmaceutico'] and v['farmaceutico']['firma_valida']}")

    print("[10] Nueva versión de receta (reemplazo con parent_id)")
    rc = requests.post(
        f"{BASE}/recetas?medico_id={dl['id']}",
        headers=headers(dl["token"]),
        json={
            "paciente_username": paci,
            "medicamento": "Paracetamol 500mg",
            "dosis": "1 c/8h",
            "cantidad": 15,
            "instrucciones": "",
            "dispensaciones_permitidas": 1,
            "llave_privada_medico": d["llave_privada"],
        },
    )
    assert rc.ok, rc.text
    rec3 = rc.json()
    r = requests.post(
        f"{BASE}/recetas/{rec3['id']}/nueva-version",
        headers=headers(dl["token"]),
        json={
            "paciente_username": paci,
            "medicamento": "Paracetamol 1000mg",   # dosis ajustada
            "dosis": "1 c/12h",
            "cantidad": 10,
            "instrucciones": "ajuste posológico",
            "dispensaciones_permitidas": 1,
            "llave_privada_medico": d["llave_privada"],
            "motivo_sustitucion": "ajuste_dosis",
        },
    )
    assert r.ok, r.text
    rec3_v2 = r.json()
    assert rec3_v2["id"] != rec3["id"], "la nueva versión debe tener id distinto"
    print(f"    receta #{rec3['id']} → sustituida · nueva #{rec3_v2['id']}")

    print("[11] RBAC: paciente intenta crear receta → 403")
    r = requests.post(
        f"{BASE}/recetas?medico_id={pl['id']}",
        headers=headers(pl["token"]),
        json={
            "paciente_username": paci,
            "medicamento": "x", "dosis": "1", "cantidad": 1,
            "dispensaciones_permitidas": 1,
            "llave_privada_medico": p["llave_privada"],
        },
    )
    assert r.status_code == 403, f"esperado 403, recibido {r.status_code}"

    print("[12] RBAC: farmacéutico intenta consultar recetas de paciente → 403")
    r = requests.get(f"{BASE}/recetas/paciente/{pl['id']}",
                     headers=headers(fl["token"], f["llave_privada"]))
    assert r.status_code == 403, f"esperado 403, recibido {r.status_code}"

    print("[12b] Admin SUSPENDE una solicitud (usuario conserva username/email, login=403)")
    sus = f"sus_{tag}"
    reg("paciente", sus)
    solx = requests.get(f"{BASE}/admin/solicitudes?estado=pendiente", headers=adm_headers).json()
    mia = next((s for s in solx if s["username"] == sus), None)
    assert mia, "no apareció la solicitud del usuario sus_*"
    r = requests.post(f"{BASE}/admin/solicitudes/{mia['id']}/suspender",
                      headers=adm_headers,
                      json={"motivo": "documentacion_pendiente"})
    assert r.ok, r.text
    assert r.json()["estado"] == "suspendida"
    # Login responde 403 (cuenta suspendida).
    r = requests.post(f"{BASE}/usuarios/login",
                      json={"username": sus, "password": "secreto123", "rol": "paciente"})
    assert r.status_code == 403, f"esperado 403 tras suspender, recibido {r.status_code}"
    # Username sigue ocupado: re-registro debe fallar 409.
    r = requests.post(f"{BASE}/usuarios/registro", json={
        "username": sus, "nombre": "Reintento", "email": f"{sus}@hosp.mx",
        "password": "secreto123", "rol": "paciente",
    })
    assert r.status_code == 409, f"username debería seguir ocupado, recibido {r.status_code}: {r.text}"

    print("[12bb] Admin REACTIVA al suspendido (suspendida → aprobada, emite certs)")
    sus_sol = requests.get(f"{BASE}/admin/solicitudes?estado=suspendida", headers=adm_headers).json()
    mia_sus = next((s for s in sus_sol if s["username"] == sus), None)
    assert mia_sus, "no apareció la solicitud suspendida"
    r = requests.post(f"{BASE}/admin/solicitudes/{mia_sus['id']}/aprobar", headers=adm_headers)
    assert r.ok, r.text
    assert r.json()["estado"] == "aprobada"
    # Login ya debe funcionar.
    r = requests.post(f"{BASE}/usuarios/login",
                      json={"username": sus, "password": "secreto123", "rol": "paciente"})
    assert r.ok, f"login tras reactivar debería funcionar: {r.status_code} {r.text}"
    assert r.json().get("token")

    print("[12bc] Admin SUSPENDE a un usuario YA APROBADO sin historial (revoca certs)")
    apb = f"apb_{tag}"
    reg("paciente", apb)
    pendientes_apb = requests.get(f"{BASE}/admin/solicitudes?estado=pendiente", headers=adm_headers).json()
    sol_apb = next((s for s in pendientes_apb if s["username"] == apb), None)
    assert sol_apb, "no apareció la solicitud apb_*"
    requests.post(f"{BASE}/admin/solicitudes/{sol_apb['id']}/aprobar", headers=adm_headers).raise_for_status()
    # confirmar que login funciona
    rl = requests.post(f"{BASE}/usuarios/login",
                       json={"username": apb, "password": "secreto123", "rol": "paciente"})
    assert rl.ok, f"login post-aprobar falló: {rl.status_code} {rl.text}"
    # ahora suspender desde aprobada
    r = requests.post(f"{BASE}/admin/solicitudes/{sol_apb['id']}/suspender",
                      headers=adm_headers, json={"motivo": "fin_de_relacion_laboral"})
    assert r.ok, f"suspender desde aprobada falló: {r.status_code} {r.text}"
    assert r.json()["estado"] == "suspendida"
    # login debe fallar (cuenta suspendida + certs revocados)
    rl = requests.post(f"{BASE}/usuarios/login",
                       json={"username": apb, "password": "secreto123", "rol": "paciente"})
    assert rl.status_code == 403, f"esperado 403 tras suspender aprobado, recibido {rl.status_code}"
    # rechazar desde suspendida (sin historial) debe permitir el borrado
    r = requests.post(f"{BASE}/admin/solicitudes/{sol_apb['id']}/rechazar",
                      headers=adm_headers, json={"motivo": "limpieza"})
    assert r.ok, f"rechazar suspendida sin historial falló: {r.status_code} {r.text}"

    print("[12bd] Suspender un médico CON historial → rechazar debe ser bloqueado (409)")
    pendientes_d = requests.get(f"{BASE}/admin/solicitudes?estado=aprobada", headers=adm_headers).json()
    # El médico de los pasos previos (docu) ya tiene recetas firmadas — buscar su solicitud.
    sol_doc = next((s for s in pendientes_d if s["username"] == docu), None)
    assert sol_doc, "no apareció la solicitud aprobada del médico"
    # Suspender debe ser OK (revoca sus certs).
    r = requests.post(f"{BASE}/admin/solicitudes/{sol_doc['id']}/suspender",
                      headers=adm_headers, json={"motivo": "auditoria"})
    assert r.ok, r.text
    # Rechazar (borrar) debe ser BLOQUEADO porque el médico tiene recetas históricas.
    r = requests.post(f"{BASE}/admin/solicitudes/{sol_doc['id']}/rechazar",
                      headers=adm_headers, json={"motivo": "borrar_compulsivo"})
    assert r.status_code == 409, f"esperado 409 (anti-pérdida-evidencia), recibido {r.status_code}: {r.text}"
    # Reactivar al médico para no dejar el sistema raro.
    requests.post(f"{BASE}/admin/solicitudes/{sol_doc['id']}/aprobar", headers=adm_headers).raise_for_status()

    print("[12c] Admin RECHAZA otra solicitud (borra usuario, libera username/email)")
    rej = f"rej_{tag}"
    reg("paciente", rej)
    solx = requests.get(f"{BASE}/admin/solicitudes?estado=pendiente", headers=adm_headers).json()
    mia = next((s for s in solx if s["username"] == rej), None)
    assert mia, "no apareció la solicitud del usuario rej_*"
    r = requests.post(f"{BASE}/admin/solicitudes/{mia['id']}/rechazar",
                      headers=adm_headers,
                      json={"motivo": "datos_invalidos"})
    assert r.ok, r.text
    assert r.json()["estado"] == "rechazada"
    # El username debe quedar libre — otro usuario puede tomarlo.
    r = requests.post(f"{BASE}/usuarios/registro", json={
        "username": rej, "nombre": "Reuse", "email": f"{rej}@hosp.mx",
        "password": "secreto123", "rol": "paciente",
    })
    assert r.ok, f"username debería quedar libre tras rechazo, recibido {r.status_code}: {r.text}"

    print("[13] Rechazo a llave privada ajena (otro usuario)")
    r = requests.post(
        f"{BASE}/recetas?medico_id={dl['id']}",
        headers=headers(dl["token"]),
        json={
            "paciente_username": paci,
            "medicamento": "x", "dosis": "1", "cantidad": 1,
            "dispensaciones_permitidas": 1,
            "llave_privada_medico": f["llave_privada"],   # ← bundle del farmacéutico
        },
    )
    assert r.status_code == 403, f"esperado 403 por llave ajena, recibido {r.status_code}"

    print("\n✔ Todos los pasos pasaron.")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        print(f"\n✘ FALLÓ: {e}", file=sys.stderr)
        sys.exit(1)
