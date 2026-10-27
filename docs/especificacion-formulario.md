# Especificación del formulario y la base — Bar Project

Describe el formulario acordado (validado con el piloto "Caja del Bar") y los cambios que la base de Supabase necesita para coincidir con él.

## Contexto

- Supabase: proyecto **Bar Project** (`mhvzuhpcguaresgibjei`). Ya existe la migración `esquema_inicial_bar` con: `categorias`, `perfiles`, `movimientos`, `detalle_venta`, vista `v_movimientos`, trigger `crear_perfil`, RLS.
- Todo el dinero del bar es **efectivo**. La única transferencia es cuando se pasa efectivo de la caja a la cuenta bancaria del bar.
- Registran unas 6 personas desde el celular, a veces **sin internet**.

## Reglas del modelo (no romper)

1. Formato largo: **una fila = un movimiento**. Un día puede tener cualquier cantidad de movimientos de cualquier tipo.
2. `monto` siempre > 0. El signo lo define el **tipo de la categoría** (ingreso suma; gasto y transferencia restan).
3. El saldo **no se guarda**: se calcula (vista).
4. Categorías = lista cerrada (menú). La descripción es texto libre opcional.
5. Varios gastos en un solo envío del formulario se guardan como **varias filas**, unidas por un mismo `lote_id`. Nunca una fila con varias categorías.

## Usuarios

- Personas: Efrén, Viviana, Anahí, Saidy, Yaque, y "Otro" (escribe su nombre).
- Acceso: elegir nombre + **clave única del bar de 4 dígitos** (no hay cuenta por persona).
- Guardar en cada movimiento `registrado_por` (texto con el nombre).

## Tipos de movimiento y preguntas

| Tipo | Preguntas | Obligatorio |
|---|---|---|
| Venta | Fecha · ¿Quién vendió? (misma lista de personas + Otro) · Monto · Nota (ej.: ventas en la tarde) | Fecha, vendedor, monto |
| Gasto (uno o varios) | Fecha · por cada gasto: Categoría · Monto · Descripción | Categoría, monto; descripción solo en "Pagos a personas" (a quién) y "Otro gasto" |
| Transferencia al banco | Fecha · Monto · Nota (comprobante) | Fecha, monto; no puede superar el efectivo en caja |
| Otro ingreso | Fecha · Categoría · Monto · ¿De quién o de qué? | Todo |
| Cierre de caja | Efectivo contado (muestra el esperado y la diferencia) | Monto contado |

Sin campo de método de pago.

### Categorías

- **Ingreso:** Venta bar, Entrega, Donación, Otro ingreso
- **Gasto:** Compras (factura), Refrigerio (pan, pasteles, colas), Eventos y celebraciones (agasajos), Materiales (palas, cuadernos, papeles, cartulinas, borradores), Pagos a personas, Otro gasto
- **Transferencia:** Transferencia al banco

### Validaciones

- Fecha no futura. Monto > 0 y ≤ 2000 (aviso de posible punto decimal faltante).
- Pantalla de confirmación antes de guardar.
- Después de guardar, la fecha se mantiene para el siguiente registro.

## Caja

- **Efectivo en caja** = suma de ingresos − gastos − transferencias (histórico completo).
- **Fondo de caja: $150** (configurable). **Para transferir** = max(0, caja − fondo).
- Pantalla muestra los 5 últimos registros.

## Sin internet

- PWA instalable. Los registros se guardan en el celular (IndexedDB) con estado *pendiente* y se envían solos al volver la conexión.
- Cada registro lleva un `id_cliente` (UUID generado en el celular) para que un reenvío no duplique filas.

## Cambios a la base (nueva migración)

1. `categorias`: reemplazar las 9 actuales por la lista de arriba; tipo `transferencia` en lugar de `deposito`.
2. `movimientos`:
   - quitar `metodo_pago`
   - `registrado_por` → `text not null` (nombre), quitar FK a `perfiles`
   - agregar `vendedor text` (solo ventas; obligatorio si la categoría es Venta bar)
   - agregar `lote_id uuid` (agrupa varios gastos de un envío)
   - agregar `id_cliente uuid unique` (evita duplicados al sincronizar)
3. Eliminar `detalle_venta` y `perfiles` (y el trigger `crear_perfil`).
4. Nueva tabla `cierres_caja` (id, fecha, contado, esperado, diferencia, registrado_por, creado_en).
5. Nueva tabla `ajustes` (clave, valor) con `fondo_caja = 150` y la clave del bar **guardada como hash**, nunca en texto plano.
6. Vista `v_caja` con efectivo en caja y monto para transferir.
7. Seguridad: como no hay login por persona, el formulario no escribe directo en las tablas. Usar una **función RPC** (`registrar_movimientos`) que verifique la clave del bar y luego inserte. RLS cerrado para el rol `anon` en lectura y escritura directa.

## Anular registros (acordado)

- Nadie borra movimientos. Un admin los **anula** indicando el motivo.
- Columnas en `movimientos`: `anulado boolean default false`, `motivo_anulacion text`, `anulado_por text`, `anulado_en timestamptz`. Si `anulado = true`, el motivo es obligatorio.
- Los anulados no cuentan para la caja ni para el dashboard, pero siguen visibles en el historial.
- La anulación se hace con una función RPC protegida por una **clave de admin** distinta de la del bar.

## Cierre de caja diario (acordado)

- Se hace **un cierre por día**, al final de la jornada (`unique (fecha)` en `cierres_caja`).
- El formulario avisa si el día anterior quedó sin cierre.
- Si la diferencia no es 0, pedir una nota de explicación antes de guardar.

## Pendiente de decidir

- ¿Refrigerio como una categoría o separado (pan / pasteles / colas)?
- ¿Quién es admin (puede anular)?

Descartado por ahora: foto de la factura.
