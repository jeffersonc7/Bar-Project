---
description: Crea una migración de Supabase a partir de la especificación y la revisa antes de aplicarla
argument-hint: [qué cambio o "la migración de docs/especificacion-formulario.md"]
---

Prepara una migración para: $ARGUMENTS

1. Carga las skills `reglas-bar`, `supabase` y `supabase-postgres-best-practices`.
2. Lee `docs/especificacion-formulario.md` (sección "Cambios a la base") y revisa el esquema actual con `list_tables`.
3. Delega a `director-backend` el diseño; que `sql-worker` escriba el archivo en `data/migrations/AAAAMMDDHHMM_descripcion.sql`.
4. Revisa el SQL contra las reglas de `reglas-bar` (monto > 0, saldo calculado, RPC con clave por hash, RLS cerrado para `anon`, nada de borrados).
5. Muéstrame el SQL y espera mi aprobación. NO la apliques sin que yo lo confirme.
6. Si la aplico: corre `get_advisors` (seguridad) y regenera los tipos TS.
7. No hagas commit.
