# Pruebas

Casos mínimos que deben existir antes de dar por buena la parte de datos (ver `docs/especificacion-formulario.md`).

## RPC y base (SQL)
- `registrar_movimientos` rechaza una clave del bar incorrecta.
- Reenviar el mismo `id_cliente` no duplica filas.
- Varios gastos de un envío quedan con el mismo `lote_id`.
- `monto` ≤ 0 o > 2000 se rechaza; una venta sin `vendedor` se rechaza.
- Una transferencia mayor que el efectivo en caja se rechaza.
- `anon` no puede leer ni escribir directo en las tablas (RLS cerrado).
- La anulación exige la clave de admin y un motivo; los anulados no cuentan en `v_caja`.
- Un solo cierre de caja por fecha; con diferencia ≠ 0 se exige nota.

## Frontend
- Unidad (Vitest): validaciones del formulario y cálculo de caja/diferencia.
- E2E (Playwright): registrar sin conexión, volver a tener conexión y comprobar que se sincroniza una sola vez.

Los scripts `test`, `typecheck` y `build` los corre `/verificar` (no hay `lint` todavía).

## Lo que ya existe

- `validaciones.test.ts`: montos (coma/punto, tope $2,000), fechas, clave, formato de dinero y fecha de Ecuador.
- `calculos.test.ts`: periodos, totales sin anulados, gastos por categoría y mes, saldo contra el cuaderno real, ventas, caja con lo pendiente del celular.
- `pantallas.test.tsx`: renderiza formularios, confirmación, últimos registros y dashboard sin navegador.

- `filtros.test.ts`: filtros de la barra lateral (periodo, fechas, tipo, categoría, persona, revisar, anulados) y comparación con el periodo anterior.
- `e2e/panel.spec.ts` (Playwright, celular y escritorio; Supabase simulado en `e2e/simulador.ts`): panel y filtros sin login, registrar pide clave (buena/mala), venta / gastos en lote / banco / cierre, sin internet, anular solo con sesión y clave de admin, cerrar sesión, Data API caída, sin desborde horizontal.
- `sql/rpc_pruebas.sql`: 31 pruebas de RPC (incluida `panel_publico` y el bloqueo de ambas claves), triggers, permisos y RLS contra la base real, dentro de una transacción que siempre se revierte.
- `../scripts/probar-api.mjs` (`npm run probar:api`): la API publicada vista como anon.

Los bots `tester-frontend` y `tester-backend` (`.claude/agents/`) corren todo esto; `/verificar` los lanza juntos.
