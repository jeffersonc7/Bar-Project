#!/usr/bin/env python3
"""Hook PreToolUse: protege la regla "nadie borra movimientos, se anulan".

Bloquea (exit 2) SQL que borre o destruya movimientos, cierres de caja o ajustes.
Lee el JSON del hook por stdin y revisa todo el contenido de tool_input.
"""
import json
import re
import sys

PATRONES = [
    r"delete\s+from\s+(?:public\.)?(?:movimientos|cierres_caja|ajustes)\b",
    r"truncate\s+(?:table\s+)?(?:public\.)?(?:movimientos|cierres_caja|ajustes)\b",
    r"drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?(?:movimientos|cierres_caja|ajustes)\b",
]


def main() -> int:
    try:
        datos = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0

    texto = json.dumps(datos.get("tool_input", {}), ensure_ascii=False).lower()
    for patron in PATRONES:
        if re.search(patron, texto):
            print(
                "Bloqueado: en este proyecto nadie borra movimientos, cierres ni ajustes; "
                "los movimientos se anulan por RPC (ver skill reglas-bar). "
                "Si de verdad hace falta, hazlo tú manualmente fuera de Claude.",
                file=sys.stderr,
            )
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
