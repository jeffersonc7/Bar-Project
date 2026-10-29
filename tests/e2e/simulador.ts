// Simulador de Supabase para las pruebas E2E: responde como las RPC reales (mismos códigos de
// error y reglas principales), guarda los movimientos para que el panel cambie al registrar y
// anota cada llamada para revisarla en las pruebas. Nunca se toca la base real.
import type { Page, Route } from '@playwright/test'

export const SUPABASE = 'https://mhvzuhpcguaresgibjei.supabase.co'

export const CATEGORIAS = [
  [1, 'Venta bar', 'ingreso', false, true],
  [2, 'Entrega', 'ingreso', true, false],
  [3, 'Donación', 'ingreso', true, false],
  [4, 'Otro ingreso', 'ingreso', true, false],
  [5, 'Compras (factura)', 'gasto', false, false],
  [6, 'Refrigerio (pan, pasteles, colas)', 'gasto', false, false],
  [7, 'Eventos y celebraciones (agasajos)', 'gasto', false, false],
  [8, 'Materiales (palas, cuadernos, papeles, cartulinas, borradores)', 'gasto', false, false],
  [9, 'Pagos a personas', 'gasto', true, false],
  [10, 'Otro gasto', 'gasto', true, false],
  [11, 'Transferencia al banco', 'transferencia', false, false],
].map(([id, nombre, tipo, requiere_descripcion, requiere_vendedor]) => ({
  id: id as number,
  nombre: nombre as string,
  tipo: tipo as 'ingreso' | 'gasto' | 'transferencia',
  requiere_descripcion: requiere_descripcion as boolean,
  requiere_vendedor: requiere_vendedor as boolean,
}))

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}

function responder(route: Route, cuerpo: unknown, status = 200) {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
  return route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) })
}

const r2 = (n: number) => Math.round(n * 100) / 100
export const hoyEnBar = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date())
export const haceDias = (n: number) => new Date(Date.parse(`${hoyEnBar()}T00:00:00Z`) - n * 864e5).toISOString().slice(0, 10)

export function movimientoDePrueba(id: number, fecha: string, categoriaId: number, monto: number, extra: Record<string, unknown> = {}) {
  const cat = CATEGORIAS.find((c) => c.id === categoriaId)!
  return {
    id,
    fecha,
    categoria_id: cat.id,
    categoria: cat.nombre,
    tipo: cat.tipo,
    monto,
    monto_firmado: cat.tipo === 'ingreso' ? monto : -monto,
    monto_caja: cat.tipo === 'ingreso' ? monto : -monto,
    descripcion: null as string | null,
    vendedor: null as string | null,
    registrado_por: 'Saidy',
    lote_id: null,
    fuente: 'formulario',
    revisar: false,
    nota_revision: null as string | null,
    anulado: false,
    motivo_anulacion: null as string | null,
    anulado_por: null as string | null,
    anulado_en: null as string | null,
    creado_en: `${fecha}T15:00:00Z`,
    ...extra,
  }
}

/** Datos iniciales: caja de $241.68 (299.99 + 66.68 − 45 − 80 + 0.01 del cuaderno), un gasto anulable, una venta y un dato del cuaderno por revisar. */
export function datosIniciales() {
  return [
    movimientoDePrueba(1, haceDias(20), 2, 299.99, { descripcion: 'Entrega Sra. Narcisa' }),
    movimientoDePrueba(2, haceDias(10), 1, 66.68, { vendedor: 'Anahí' }),
    movimientoDePrueba(3, haceDias(5), 5, 45, { descripcion: 'Factura 123' }),
    movimientoDePrueba(4, haceDias(3), 9, 80, { descripcion: 'Yaque' }),
    movimientoDePrueba(5, '2026-02-01', 2, 0.0, { fuente: 'cuaderno', registrado_por: 'Cuaderno (histórico)', revisar: true, nota_revision: 'Nombre poco legible' }),
  ].map((m) => (m.id === 5 ? { ...m, monto: 0.01, monto_firmado: 0.01, monto_caja: 0.01 } : m))
}

export interface Llamada {
  fn: string
  cuerpo: Record<string, unknown>
}

export async function simularSupabase(
  page: Page,
  opciones: { clave?: string; claveAdmin?: string; movimientos?: ReturnType<typeof movimientoDePrueba>[]; apiCaida?: boolean } = {},
) {
  const estado = {
    clave: opciones.clave ?? '1234',
    claveAdmin: opciones.claveAdmin ?? 'admin-123',
    movimientos: opciones.movimientos ?? datosIniciales(),
    llamadas: [] as Llamada[],
    vistos: new Set<string>(),
    cierres: [] as Record<string, unknown>[],
  }
  const caja = () => r2(estado.movimientos.filter((m) => !m.anulado).reduce((s, m) => s + m.monto_caja, 0))
  const error = (codigo: string, mensaje: string, extra = {}) => ({ ok: false, codigo, mensaje, ...extra })

  // Cualquier llamada no simulada falla: así ninguna prueba toca el Supabase real.
  await page.route(`${SUPABASE}/**`, (route) => responder(route, { message: 'no simulado en la prueba' }, 500))
  await page.routeWebSocket(/supabase\.co/, () => {})

  await page.route(`${SUPABASE}/rest/v1/rpc/*`, async (route) => {
    if (route.request().method() === 'OPTIONS') return responder(route, null)
    if (opciones.apiCaida) {
      return responder(route, { code: 'PGRST002', details: null, hint: null, message: 'Could not query the database for the schema cache. Retrying.' }, 503)
    }
    const fn = new URL(route.request().url()).pathname.split('/').pop() ?? ''
    const cuerpo = (route.request().postDataJSON() ?? {}) as Record<string, unknown>
    estado.llamadas.push({ fn, cuerpo })

    if (fn === 'obtener_categorias') return responder(route, CATEGORIAS)
    if (fn === 'anular_movimiento') {
      if (cuerpo.p_clave_admin !== estado.claveAdmin) return responder(route, error('clave_invalida', 'Clave incorrecta.'))
      const m = estado.movimientos.find((x) => x.id === cuerpo.p_movimiento_id)!
      Object.assign(m, { anulado: true, motivo_anulacion: cuerpo.p_motivo, anulado_por: cuerpo.p_anulado_por, anulado_en: new Date().toISOString(), monto_caja: 0 })
      return responder(route, { ok: true, id: m.id, efectivo_en_caja: caja() })
    }
    if (fn === 'panel_publico') {
      return responder(route, {
        ok: true,
        hoy: hoyEnBar(),
        caja: { efectivo_en_caja: caja(), fondo_caja: 150, para_transferir: Math.max(0, r2(caja() - 150)) },
        categorias: CATEGORIAS.map(({ id, nombre, tipo }) => ({ id, nombre, tipo })),
        movimientos: estado.movimientos,
        cierres: estado.cierres,
      })
    }

    if (cuerpo.p_clave !== estado.clave) return responder(route, error('clave_invalida', 'Clave incorrecta.'))

    if (fn === 'resumen_caja') {
      const ultimos = estado.movimientos
        .filter((m) => m.fuente === 'formulario' && m.registrado_por !== 'Saidy')
        .slice(-5)
        .reverse()
        .map((m) => ({ ...m }))
      return responder(route, {
        ok: true,
        hoy: hoyEnBar(),
        efectivo_en_caja: caja(),
        fondo_caja: 150,
        para_transferir: Math.max(0, r2(caja() - 150)),
        ultimos,
        cierre_pendiente: null,
      })
    }

    if (fn === 'registrar_movimientos') {
      const movimientos = cuerpo.p_movimientos as Record<string, unknown>[]
      let insertados = 0
      for (const m of movimientos) {
        const id = String(m.id_cliente)
        if (estado.vistos.has(id)) continue
        const cat = CATEGORIAS.find((c) => c.id === m.categoria_id)!
        if (cat.tipo === 'transferencia' && Number(m.monto) > caja()) {
          return responder(route, error('transferencia_excede_caja', 'La transferencia supera el efectivo en caja.', { efectivo_en_caja: caja() }))
        }
        estado.vistos.add(id)
        estado.movimientos.push(
          movimientoDePrueba(estado.movimientos.length + 100, String(m.fecha), cat.id, Number(m.monto), {
            descripcion: (m.descripcion as string) ?? null,
            vendedor: (m.vendedor as string) ?? null,
            registrado_por: String(cuerpo.p_registrado_por),
            creado_en: new Date().toISOString(),
          }),
        )
        insertados += 1
      }
      return responder(route, { ok: true, lote_id: cuerpo.p_lote_id, insertados, duplicados: movimientos.length - insertados, efectivo_en_caja: caja() })
    }

    if (fn === 'registrar_cierre_caja') {
      const diferencia = r2(Number(cuerpo.p_contado) - caja())
      if (diferencia !== 0 && !cuerpo.p_nota) {
        return responder(route, error('nota_requerida', 'Hay diferencia: escribe una nota que la explique.', { esperado: caja(), diferencia }))
      }
      estado.cierres.push({ id: estado.cierres.length + 1, fecha: cuerpo.p_fecha, contado: cuerpo.p_contado, esperado: caja(), diferencia, nota: cuerpo.p_nota ?? null, registrado_por: cuerpo.p_registrado_por })
      return responder(route, { ok: true, duplicado: false, fecha: cuerpo.p_fecha, esperado: caja(), diferencia })
    }

    return responder(route, { message: `RPC ${fn} no simulada` }, 404)
  })

  return estado
}
