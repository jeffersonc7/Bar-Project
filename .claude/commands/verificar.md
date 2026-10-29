---
description: Lanza los bots de pruebas (frontend y backend) y reporta el resultado sin maquillar
---

Lanza en paralelo los dos bots de pruebas y espera sus reportes:

- `tester-frontend`: typecheck, Vitest, build y E2E de Playwright (celular y escritorio, Supabase simulado).
- `tester-backend`: suite SQL `tests/sql/rpc_pruebas.sql` (se revierte sola), `npm run probar:api` y advisors de Supabase.

Luego resume en una tabla: área, comando, OK/FALLA, detalle. Para cada fallo, el mensaje exacto y el archivo/línea o la prueba afectada.

- No corrijas nada ni hagas commit; solo informa y propone los siguientes pasos.
- Si un bot no pudo correr un paso, dilo explícitamente.
