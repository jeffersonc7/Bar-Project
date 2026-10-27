# Arquitectura de IA (arnés) — Bar Project

## Stack recomendado

Una sola app web (PWA) con dos áreas: `/registrar` (formulario, offline) y `/dashboard`.

| Capa | Elección | Por qué |
|---|---|---|
| Backend | **Solo Supabase**: Postgres + RPC + RLS + Realtime | Sin servidor propio; la lógica sensible (clave, validación, anular) vive en funciones SQL. |
| Frontend | **Vite + React + TypeScript** | Ligero, buen soporte PWA. |
| PWA / offline | `vite-plugin-pwa` (Workbox) + **Dexie** (IndexedDB) | Instalable, cola de pendientes con `id_cliente`. |
| Estado / datos | `@supabase/supabase-js` + TanStack Query | Realtime del dashboard y reintentos. |
| UI | Tailwind CSS | Rápido para móvil. |
| Gráficos | Recharts (o ECharts si hace falta más) | Barras, líneas, dona para finanzas. |
| Pruebas | Vitest (unidad), Playwright (e2e/offline), SQL de pruebas para RPC/RLS | |

No se construye un formulario ajeno: el piloto "Caja del Bar" ya validó el diseño y la PWA propia permite offline + RPC con clave.

## Agentes (`.claude/agents/`)

Limitación de Claude Code: un subagente **no puede lanzar otros subagentes**. Por eso el "director" real es la **sesión principal** (que delega); los agentes "director-*" son especialistas de dominio que diseñan, revisan y ejecutan trabajo grande, y los `*-worker` (modelo Haiku) hacen tareas concretas y acotadas.

```
Sesión principal (orquesta, decide, integra)
├── director-backend  (sonnet)  esquema, RPC, RLS, migraciones
│   ├── sql-worker    (haiku)   escribe migraciones/pruebas SQL desde una spec exacta
├── director-frontend (sonnet)  PWA, offline, formulario, dashboard
│   ├── ui-worker     (haiku)   un componente/pantalla concreta
└── qa-worker         (haiku)   corre tests/lint/build y reporta
```

Regla de delegación: la sesión principal le pasa a cada worker una spec cerrada (archivos, firma, criterios). Los workers no toman decisiones de diseño.

## Skills (`.claude/skills/`)

- `reglas-bar` (propia): reglas del dominio, para que ningún agente rompa el modelo.
- Externas recomendadas (instalar con el CLI, no copiar a mano):
  - Supabase: `npx skills add supabase/agent-skills`
  - Dashboard/gráficos: skill `dataviz` y `data:build-dashboard` (ya disponibles en el entorno).
  - Diseño de UI: `frontend-design` si está disponible.

## Manejo del arnés

1. `CLAUDE.md` = contexto corto y estable (stack, estructura, reglas inviolables).
2. `docs/especificacion-formulario.md` = fuente de verdad funcional. Se actualiza **antes** del código.
3. Agentes en `.claude/agents/`, skills en `.claude/skills/<nombre>/SKILL.md`, comandos en `.claude/commands/`.
4. Migraciones en `data/migrations/` (y aplicadas a Supabase); nunca cambios manuales en el panel.
5. Orden de trabajo: migración → RPC + pruebas → tipos TS → formulario/cola offline → dashboard.
6. Secretos (claves del bar/admin, service key) nunca en el repo; solo hash en `ajustes`.

## Dashboard (secciones previstas)

- Resumen: efectivo en caja, para transferir, ventas vs gastos del mes.
- "¿En qué se fue el dinero?": gastos por categoría, últimos 3 meses (barras apiladas por mes + dona del total).
- Tendencia de ventas (día/semana) y por vendedor.
- Transferencias al banco y cierres de caja con diferencias.
- Historial con anulados visibles.
