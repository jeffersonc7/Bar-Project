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
- Decisiones tomadas: Refrigerio es una sola categoría; hay una sola clave de admin (hash en `ajustes`). Ver `docs/especificacion-formulario.md`.

## Comandos

- `npm run dev` (app en http://localhost:5173), `npm run build`, `npm run typecheck`, `npm test`
- `npm run test:e2e` (Playwright, Supabase simulado en `tests/e2e/simulador.ts`; primera vez `npm run e2e:preparar`), `npm run probar:api` (API real como anon, solo lectura)
- Suite SQL de RPC: `tests/sql/rpc_pruebas.sql` (se revierte sola; correr con execute_sql)
- Bots de pruebas: agentes `tester-frontend` y `tester-backend` (haiku); `/verificar` los lanza en paralelo
- `npm run clave` / `npm run clave -- admin`: genera el SQL con el hash de la clave del bar / de administración
- Node 22 (nvm). En shells no interactivos: `source ~/.nvm/nvm.sh && nvm use 22`.
- Puesta en marcha (cómo funciona, claves, despliegue, pruebas): `docs/puesta-en-marcha.md`

## App (`src/bar/`)

- Una sola pantalla (`panel/Panel.tsx`), pensada primero para el celular. El dashboard es **público**: la RPC `panel_publico` trae todo sin clave (`panel/usePanel.ts`, refresco cada 30 s, copia local sin internet). Decisión del usuario (27-oct-2026).
- **Registrar** pide nombre + clave del bar (`panel/Acceso.tsx` → pantalla `components/ui/sign-in-page.tsx`, estilo de la referencia del usuario). Luego abre el cajón `panel/RegistroPanel.tsx` con los formularios de `registrar/` y la cola sin internet (`offline/`, Dexie, `id_cliente`). **Anular** solo con sesión + clave de admin.
- Filtros: `panel/PanelFiltros.tsx` (barra lateral en escritorio, hoja inferior en el celular; chips de periodo en el encabezado), lógica pura en `panel/filtros.ts`.
- `dashboard/Contenido.tsx` (carga diferida): cifra de caja, indicadores con comparación al periodo anterior, "Para tener en cuenta", gráficos Recharts, historial (lista en el celular, tabla en escritorio).
- Tipos de la base: `lib/database.types.ts` (regenerar tras cada migración).
- Diseño: tema blanco sobrio, interfaz en blanco y negro y color solo en los datos; títulos en serif Newsreader, interfaz y cifras en IBM Plex Sans; íconos lucide-react; tokens en `estilos.css`. Sin degradados ni dorado (el usuario los rechazó por verse "de IA"). Componentes externos en `components/ui/` con alias `@/` (skill `integrar-componente-ui`). Ojo con Tailwind v4: `hidden` no le gana a `inline-flex` del mismo elemento (usar `max-lg:hidden`); los `<fieldset>` necesitan `min-w-0`; nada de `sticky` dentro de zonas que se desplazan en diálogos (usar la prop `pie` de `Dialogo`).

## Estado

Migraciones aplicadas (`cambios_formulario`, `dashboard_lectura`, `panel_caja`→`panel_publico`), histórico del cuaderno cargado (61 filas, caja $0.00), dashboard público + registrar con clave, con suites de pruebas. Data API activa y registro público de cuentas cerrado. Falta: fijar las claves (`npm run clave`) y publicar con HTTPS (ver `docs/puesta-en-marcha.md`).
