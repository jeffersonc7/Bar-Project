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
- **Frontend:** por definir (se irá agregando)
- **Moneda:** USD

## Estructura

- `.claude/agents/`, `.claude/skills/`, `.claude/commands/`: arnés de IA (se irá poblando)
- `data/`: datos y migraciones de Supabase
- `src/bar/`: código de la aplicación
- `tests/`: pruebas
- `docs/`: documentación

## Estado

Solo existe la estructura de carpetas. El código, agentes, skills y comandos se agregarán paso a paso.
