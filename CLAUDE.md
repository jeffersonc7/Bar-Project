# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Sistema web para la gestión de un bar/negocio pequeño (Ecuador, USD).

El flujo principal es:
1. El usuario llena un formulario con datos del negocio (ventas, gastos, inventario, etc.)
2. Esos datos se guardan en Supabase
3. Un dashboard web muestra la información en tiempo real, actualizándose automáticamente al recibir nuevos registros

## Stack

- **Base de datos / Backend:** Supabase (auth, base de datos PostgreSQL, realtime)
- **Frontend:** PWA Vite + React + TypeScript + Tailwind, Dexie (offline), TanStack Query, Recharts (ver `docs/arquitectura-ia.md`)
- **Moneda:** USD

## Estructura

- `.claude/agents/`, `.claude/skills/`, `.claude/commands/`: arnés de IA (se irá poblando)
- `data/`: datos y migraciones de Supabase
- `src/bar/`: código de la aplicación
- `tests/`: pruebas
- `docs/`: documentación

## Arnés de IA

- Especificación funcional (fuente de verdad): `docs/especificacion-formulario.md`
- Arquitectura de agentes y skills: `docs/arquitectura-ia.md`
- Agentes: `director-backend`, `director-frontend` (sonnet); `sql-worker`, `ui-worker`, `qa-worker` (haiku). La sesión principal orquesta y delega con specs cerradas.
- Skill `reglas-bar`: reglas inviolables del dominio; cargar antes de tocar esquema, RPC, formulario o dashboard.

- Skills instaladas (`skills-lock.json`): `supabase`, `supabase-postgres-best-practices`, `frontend-design`. `reglas-bar` prevalece sobre todas.
- Comandos: `/migracion`, `/verificar`, `/estado`.
- Permisos y hook en `.claude/settings.json`: el hook `.claude/hooks/proteger-movimientos.py` bloquea borrados de movimientos; aplicar migraciones y ejecutar SQL pide confirmación; Claude no hace commit ni push.
- Orden de trabajo: migración → RPC + pruebas (`tests/README.md`) → tipos TS → formulario/cola offline → dashboard.
- Decisiones abiertas: ¿Refrigerio una categoría o separado?; ¿quién es admin? Preguntar antes de asumir.

## Estado

Estructura, especificación y arnés definidos. Falta: migración de Supabase, app en `src/bar/`, dashboard.
