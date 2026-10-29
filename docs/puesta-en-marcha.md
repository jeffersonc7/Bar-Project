# Puesta en marcha — Caja del Bar

## Cómo funciona

- Al abrir la app se ve directo el **panel de caja** (saldo, gastos, ventas, banco, cierres, historial) y se pueden usar los **filtros** sin entrar. Decisión del 27-oct-2026: quien tenga el link ve las finanzas del bar.
- **Registrar** (venta, gastos, otro ingreso, transferencia al banco, cierre) pide **nombre + clave del bar** (la misma para todos). "Recordarme" deja la sesión en ese equipo.
- **Anular** solo aparece con sesión iniciada y además pide la **clave de administración**.
- Pensado primero para el celular: filtros en una hoja inferior y periodo a un toque; en pantallas grandes los filtros van en la barra lateral.

## 1. Data API de Supabase — hecho ✓

Activada el 27-oct-2026 con `public` como schema expuesto. `npm run probar:api` lo comprueba.

## 2. Registro público de cuentas — hecho ✓

Desactivado (Authentication > Sign In / Providers > "Allow new users to sign up"). La app no usa cuentas de correo.

## 3. Fijar las claves (pendiente)

Las claves se guardan solo como hash bcrypt. El script pide la clave sin mostrarla y te da el SQL listo:

```bash
npm run clave            # clave del bar: 4 números
npm run clave -- admin   # clave de administración: mínimo 6 caracteres
```

Pega cada `update ...` que imprime en **Supabase > SQL Editor** y ejecútalo. Hasta hacerlo, al tocar Registrar sale "La clave todavía no está configurada" (el panel se ve igual).

Seguridad: 5 intentos fallidos seguidos bloquean esa clave 15 minutos para todos (ver el panel no se bloquea).

## 4. Abrir la app

Los comandos `npm run ...` usan Node 22 solos (script `scripts/con-node22.sh`): no importa qué Node tenga activa la terminal. Si falta, instálalo con `nvm install 22`.

```bash
npm install
npm run dev        # http://localhost:5173
```

Al abrir, si los últimos 3 meses no tienen movimientos (tu cuaderno termina en mayo), el panel arranca en "Todo" en vez de mostrar $0.00.

No hace falta `.env`: la URL del proyecto y la clave **publicable** (pública por diseño) están en `src/bar/lib/supabase.ts`. Para apuntar a otro proyecto, crea un `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Nunca pongas la `service_role` / secret key en el frontend.

`npm run dev:red` la abre en la red local para probar desde un celular, pero sin HTTPS el celular no instala la app ni la deja funcionar sin internet.

## 5. Publicarla (para usarla en los celulares)

La PWA necesita HTTPS. `npm run build` deja todo en `dist/`; cualquier hosting estático sirve (Vercel, Netlify, Cloudflare Pages).

En cada celular: abrir la dirección, entrar una vez **con internet** y usar "Agregar a pantalla de inicio". Desde ahí se puede registrar aunque no haya internet; lo registrado se envía solo al volver la conexión, y el panel muestra la última copia guardada.

## Pruebas (bots)

| Comando | Qué prueba |
|---|---|
| `npm run typecheck` | Tipos de TypeScript |
| `npm test` | Vitest: validaciones, cálculos, filtros, render de pantallas |
| `npm run test:e2e` | Playwright en celular y escritorio: panel y filtros sin login, registrar con clave (venta, gastos, banco, cierre), sin internet, anular con sesión, cerrar sesión, Data API caída. Supabase simulado (no toca la base). Primera vez: `npm run e2e:preparar` |
| `npm run probar:api` | La API publicada como la ve el celular: panel público responde, tablas cerradas al público, registro de cuentas cerrado |
| `tests/sql/rpc_pruebas.sql` | 31 pruebas de las RPC (incluida `panel_publico` y el bloqueo de ambas claves) y la seguridad en la base real, dentro de una transacción que se revierte sola |

En Claude Code: `/verificar` lanza los bots `tester-frontend` y `tester-backend` en paralelo.

## Qué hay en Supabase

- Migraciones: `esquema_inicial_bar`, `cambios_formulario`, `dashboard_lectura` (políticas para login por correo; la app ya no las usa), `panel_caja` (reemplazada) y `panel_publico` (datos del panel sin clave). Copias en `data/migrations/`.
- Histórico del cuaderno: 61 movimientos (`fuente = 'cuaderno'`, 1-feb a 29-may-2026), caja final $0.00. Las filas dudosas tienen `revisar` y su nota (filtro "Solo por revisar").
- El registro 12 del cuaderno ("Rectificar venta de 21-02", −$12.50) era un ajuste; se cargó como *Otro gasto* para que el saldo cuadre.
