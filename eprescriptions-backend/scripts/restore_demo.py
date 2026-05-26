"""Reversor del tampering de `tamper_demo.py`.

Lee `tamper_backup.json` y restaura cada campo modificado a su valor original.
Si el backup está corrupto o falta, falla limpio sin tocar nada.

Uso (desde eprescriptions-backend/):
    ./venv/bin/python -m scripts.restore_demo
    ./venv/bin/python -m scripts.restore_demo --keep   # no borra el backup tras restaurar
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import socket
import subprocess
import sys

import pymysql
from dotenv import load_dotenv

_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND = os.path.dirname(_HERE)
BACKUP_PATH = os.path.join(_HERE, "tamper_backup.json")


def _resolve_db_host(env_host: str, port: int) -> str:
    """Mismo criterio que tamper_demo: prioriza la BD del contenedor docker."""
    try:
        out = subprocess.check_output(
            [
                "docker",
                "inspect",
                "eprescriptions-backend-db-1",
                "--format",
                "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}",
            ],
            text=True,
            timeout=3,
            stderr=subprocess.DEVNULL,
        ).strip()
        if out:
            try:
                with socket.create_connection((out, port), timeout=2):
                    return out
            except OSError:
                pass
    except (subprocess.SubprocessError, FileNotFoundError):
        pass
    return env_host


def _connect():
    load_dotenv(os.path.join(_BACKEND, ".env"), override=True)
    host = _resolve_db_host(os.getenv("DB_HOST", "localhost"), int(os.getenv("DB_PORT", "3306")))
    return pymysql.connect(
        host=host,
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
        charset="utf8mb4",
        autocommit=False,
    )


# Campos cuyos valores se guardaron como base64 (BLOB → texto). Al restaurar
# hay que decodificar antes de escribir.
_B64_FIELDS = {"ciphertext_b64": "ciphertext", "c_wrap_far_b64": "c_wrap_far"}


def _restore_entry(cur, entry: dict) -> None:
    table = entry["table"]
    where = entry["where"]
    originals = entry["originals"]

    sets = []
    values = []
    for k, v in originals.items():
        if k in _B64_FIELDS:
            real_col = _B64_FIELDS[k]
            sets.append(f"{real_col}=%s")
            values.append(base64.b64decode(v) if v is not None else None)
        else:
            sets.append(f"{k}=%s")
            values.append(v)

    where_clause = " AND ".join(f"{k}=%s" for k in where)
    values.extend(where.values())

    sql = f"UPDATE {table} SET {', '.join(sets)} WHERE {where_clause}"
    cur.execute(sql, values)
    affected = cur.rowcount
    where_str = ", ".join(f"{k}={v}" for k, v in where.items())
    print(f"  [{table} {where_str}] restaurado ({affected} fila)")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--keep", action="store_true", help="No borrar el backup tras restaurar"
    )
    args = ap.parse_args()

    if not os.path.exists(BACKUP_PATH):
        print(f"✘ No existe backup en {BACKUP_PATH}.", file=sys.stderr)
        return 1

    with open(BACKUP_PATH, "r", encoding="utf-8") as f:
        payload = json.load(f)
    entries = payload.get("entries", [])
    if not entries:
        print("✘ Backup sin entradas.", file=sys.stderr)
        return 1

    conn = _connect()
    print(f"→ Conectado a {conn.host}:{conn.port}/{conn.db.decode() if isinstance(conn.db, bytes) else conn.db}")
    print(f"→ Restaurando {len(entries)} entrada(s) (target receta_id={payload.get('target_receta_id')})")
    print()

    try:
        with conn.cursor() as cur:
            for entry in entries:
                _restore_entry(cur, entry)
        conn.commit()
        print("\n✔ Restore completado.")
        if not args.keep:
            os.remove(BACKUP_PATH)
            print(f"  Backup eliminado: {BACKUP_PATH}")
        else:
            print(f"  Backup conservado: {BACKUP_PATH}")
    except Exception as e:
        conn.rollback()
        print(f"✘ Error: {e}", file=sys.stderr)
        return 2
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
