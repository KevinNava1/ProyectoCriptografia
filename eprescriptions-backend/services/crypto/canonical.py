"""JSON canónico — claves ordenadas, sin espacios, UTF-8.

Spec §Parámetros: `json.dumps(obj, sort_keys=True, separators=(',',':')).encode()`.
Cualquier firma/AAD del sistema pasa por aquí para que el receptor pueda
re-serializar el mismo dict y obtener byte-a-byte el mismo mensaje.

Por qué importa: las firmas digitales son sobre BYTES, no sobre objetos. Si yo
firmo `{"a":1,"b":2}` y tú serializas a `{"b":2,"a":1}`, los bytes son
distintos y la verificación falla aunque el contenido lógico sea idéntico.
La canonicalización elimina toda libertad de formato (orden, espacios,
encoding) para que firma y verificación sean determinísticas y portables.
"""
from __future__ import annotations

import json
from typing import Any


def canonical_json(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def canonical_bytes(obj: Any) -> bytes:
    return canonical_json(obj).encode("utf-8")
