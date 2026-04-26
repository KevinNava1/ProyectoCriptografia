"""Reset del schema. Borra TODAS las tablas y las recrea desde cero.

Uso: `python reset_db.py --confirm`
"""
from __future__ import annotations

import sys

from database import init_schema


def main():
    if "--confirm" not in sys.argv:
        print("Esto borrará todas las tablas y datos. Re-ejecuta con --confirm para proceder.")
        sys.exit(1)
    init_schema(reset=True)
    print("✔ Schema recreado desde cero.")


if __name__ == "__main__":
    main()
