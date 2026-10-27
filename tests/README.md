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

Los scripts `test`, `lint`, `typecheck` y `build` los corre `/verificar`.
