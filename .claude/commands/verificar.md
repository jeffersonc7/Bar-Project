---
description: Corre tests, lint, typecheck y build y reporta el resultado sin maquillar
---

Usa el agente `qa-worker` para ejecutar, si existen en `package.json`, estos scripts: `typecheck`, `lint`, `test`, `build`.

- Reporta cada uno como OK o FALLA con el error exacto y archivo/línea.
- Si un script no existe o no se pudo correr, dilo explícitamente.
- No corrijas nada ni hagas commit; solo informa y propón los siguientes pasos.
- Si existen pruebas SQL en `tests/`, indícame cómo correrlas contra Supabase (no las apliques a producción).
