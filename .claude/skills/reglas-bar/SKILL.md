---
name: reglas-bar
description: Reglas inviolables del dominio del Bar Project (modelo de movimientos, caja, anulación, offline, seguridad). Cárgalo antes de tocar esquema, RPC, formulario o dashboard.
---

Fuente completa: `docs/especificacion-formulario.md`. Resumen de lo que no se rompe:

1. Una fila = un movimiento. Varios gastos de un envío = varias filas con el mismo `lote_id`.
2. `monto` > 0 siempre; el signo lo da el tipo de categoría (ingreso suma; gasto y transferencia restan). Máximo 2000.
3. El saldo no se guarda: se calcula (`v_caja`). Anulados no cuentan para caja ni dashboard, pero se ven en el historial.
4. Categorías son lista cerrada; la descripción es texto libre.
5. Nadie borra movimientos: se anulan por RPC con clave de admin y motivo obligatorio.
6. El cliente no escribe en tablas: solo RPC que verifica la clave del bar (hash en `ajustes`). `anon` sin acceso directo a tablas. Leer el panel es público (`panel_publico`, decisión del usuario 27-oct-2026); registrar y anular piden clave.
7. Offline: IndexedDB + `id_cliente` UUID único para que un reenvío no duplique.
8. Un cierre de caja por día (`unique (fecha)`); si hay diferencia, nota obligatoria.
9. Moneda USD; todo es efectivo; sin método de pago.
10. Decidido: Refrigerio es una sola categoría; hay una sola clave de admin (hash en `ajustes`).
