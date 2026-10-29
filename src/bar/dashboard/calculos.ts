// Agregaciones del dashboard. Funciones puras (sin Supabase ni navegador): se prueban en tests/.
import { CATEGORIA_VENTA } from '../lib/config'
import { redondear } from '../lib/formato'
import type { TipoCategoria } from '../lib/rpc'

export interface Movimiento {
  id: number
  fecha: string
  categoria_id: number
  categoria: string
  tipo: TipoCategoria
  monto: number
  descripcion: string | null
  vendedor: string | null
  registrado_por: string
  fuente: string
  revisar: boolean
  nota_revision: string | null
  anulado: boolean
  motivo_anulacion: string | null
  anulado_por: string | null
  anulado_en: string | null
  creado_en: string
}

export interface CategoriaBasica {
  id: number
  nombre: string
  tipo: TipoCategoria
}

export interface Caja {
  efectivo_en_caja: number
  fondo_caja: number
  para_transferir: number
}

export interface Cierre {
  id: number
  fecha: string
  contado: number
  esperado: number
  diferencia: number
  nota: string | null
  registrado_por: string
}

export type Periodo = '3m' | '6m' | '12m' | 'todo'

/** Fechas YYYY-MM-DD inclusivas; desde = null es "todo el historial". */
export interface Rango {
  desde: string | null
  hasta: string
}

/* ---------- Fechas ---------- */

/** "2026-03" + n meses */
export function sumarMeses(mes: string, n: number): string {
  const [anio, m] = mes.split('-').map(Number)
  const total = anio * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

export function sumarDias(fecha: string, n: number): string {
  const d = new Date(`${fecha}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Lunes de la semana de una fecha. */
export function lunesDe(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`)
  return sumarDias(fecha, -((d.getUTCDay() + 6) % 7))
}

export function mesesEntre(desde: string, hasta: string): string[] {
  const meses: string[] = []
  for (let m = desde; m <= hasta; m = sumarMeses(m, 1)) meses.push(m)
  return meses
}

/** "Últimos 3 meses" = el mes en curso y los 2 anteriores, completos. */
export function rangoDe(periodo: Periodo, hoy: string): Rango {
  if (periodo === 'todo') return { desde: null, hasta: hoy }
  const meses = periodo === '3m' ? 3 : periodo === '6m' ? 6 : 12
  return { desde: `${sumarMeses(hoy.slice(0, 7), -(meses - 1))}-01`, hasta: hoy }
}

export function enRango(m: { fecha: string }, r: Rango): boolean {
  return (r.desde === null || m.fecha >= r.desde) && m.fecha <= r.hasta
}

export function primeraFecha(movs: { fecha: string }[]): string | null {
  return movs.reduce<string | null>((min, m) => (min === null || m.fecha < min ? m.fecha : min), null)
}

export function ultimaFecha(movs: { fecha: string }[]): string | null {
  return movs.reduce<string | null>((max, m) => (max === null || m.fecha > max ? m.fecha : max), null)
}

/** Meses a mostrar en los gráficos mensuales (incluye meses sin movimiento). */
export function mesesDelRango(r: Rango, movs: Movimiento[]): string[] {
  const hasta = r.hasta.slice(0, 7)
  const desde = (r.desde ?? primeraFecha(movs) ?? r.hasta).slice(0, 7)
  return mesesEntre(desde, hasta)
}

/* ---------- Totales ---------- */

export const esVenta = (m: Movimiento) => m.tipo === 'ingreso' && m.categoria === CATEGORIA_VENTA
const activos = (movs: Movimiento[]) => movs.filter((m) => !m.anulado)
const conSigno = (m: Movimiento) => (m.tipo === 'ingreso' ? m.monto : -m.monto)

export interface Totales {
  ingresos: number
  gastos: number
  transferencias: number
  ventas: number
  /** ingresos − gastos (lo transferido al banco no es gasto: el dinero sigue siendo del bar). */
  resultado: number
}

export function totales(movs: Movimiento[]): Totales {
  let ingresos = 0
  let gastos = 0
  let transferencias = 0
  let ventas = 0
  for (const m of activos(movs)) {
    if (m.tipo === 'ingreso') {
      ingresos += m.monto
      if (esVenta(m)) ventas += m.monto
    } else if (m.tipo === 'gasto') {
      gastos += m.monto
    } else {
      transferencias += m.monto
    }
  }
  return {
    ingresos: redondear(ingresos),
    gastos: redondear(gastos),
    transferencias: redondear(transferencias),
    ventas: redondear(ventas),
    resultado: redondear(ingresos - gastos),
  }
}

/* ---------- Gastos ---------- */

export interface GastoPorCategoria {
  categoria_id: number
  categoria: string
  total: number
  cantidad: number
  /** 0..1 del total de gastos */
  porcentaje: number
}

export function gastosPorCategoria(movs: Movimiento[]): GastoPorCategoria[] {
  const mapa = new Map<number, GastoPorCategoria>()
  let total = 0
  for (const m of activos(movs)) {
    if (m.tipo !== 'gasto') continue
    total += m.monto
    const fila = mapa.get(m.categoria_id) ?? { categoria_id: m.categoria_id, categoria: m.categoria, total: 0, cantidad: 0, porcentaje: 0 }
    fila.total += m.monto
    fila.cantidad += 1
    mapa.set(m.categoria_id, fila)
  }
  return [...mapa.values()]
    .map((f) => ({ ...f, total: redondear(f.total), porcentaje: total ? f.total / total : 0 }))
    .sort((a, b) => b.total - a.total)
}

export type FilaMensual = { mes: string } & Record<string, number | string>

/** Una fila por mes con una columna `c<id>` por categoría de gasto (para barras apiladas). */
export function gastosPorMes(movs: Movimiento[], meses: string[], categorias: CategoriaBasica[]): FilaMensual[] {
  const filas = new Map<string, FilaMensual>(
    meses.map((mes) => [mes, { mes, ...Object.fromEntries(categorias.map((c) => [`c${c.id}`, 0])) }]),
  )
  for (const m of activos(movs)) {
    if (m.tipo !== 'gasto') continue
    const fila = filas.get(m.fecha.slice(0, 7))
    if (!fila) continue
    const llave = `c${m.categoria_id}`
    fila[llave] = redondear(Number(fila[llave] ?? 0) + m.monto)
  }
  return [...filas.values()]
}

export function gastosMasGrandes(movs: Movimiento[], cuantos = 5): Movimiento[] {
  return activos(movs)
    .filter((m) => m.tipo === 'gasto')
    .sort((a, b) => b.monto - a.monto || b.fecha.localeCompare(a.fecha))
    .slice(0, cuantos)
}

/* ---------- Flujo y saldo ---------- */

export interface FlujoMensual {
  mes: string
  ingresos: number
  gastos: number
  transferencias: number
  resultado: number
}

export function flujoPorMes(movs: Movimiento[], meses: string[]): FlujoMensual[] {
  const filas = new Map(meses.map((mes) => [mes, { mes, ingresos: 0, gastos: 0, transferencias: 0, resultado: 0 }]))
  for (const m of activos(movs)) {
    const fila = filas.get(m.fecha.slice(0, 7))
    if (!fila) continue
    if (m.tipo === 'ingreso') fila.ingresos += m.monto
    else if (m.tipo === 'gasto') fila.gastos += m.monto
    else fila.transferencias += m.monto
  }
  return [...filas.values()].map((f) => ({
    mes: f.mes,
    ingresos: redondear(f.ingresos),
    gastos: redondear(f.gastos),
    transferencias: redondear(f.transferencias),
    resultado: redondear(f.ingresos - f.gastos),
  }))
}

export interface PuntoSaldo {
  fecha: string
  saldo: number
}

/** Saldo de caja al final de cada día con movimiento (histórico completo, sin anulados). */
export function saldoDiario(movs: Movimiento[]): PuntoSaldo[] {
  const porDia = new Map<string, number>()
  for (const m of activos(movs)) porDia.set(m.fecha, (porDia.get(m.fecha) ?? 0) + conSigno(m))
  let saldo = 0
  return [...porDia.keys()].sort().map((fecha) => {
    saldo += porDia.get(fecha) ?? 0
    return { fecha, saldo: redondear(saldo) }
  })
}

/** Saldo dentro del rango: arranca con el saldo que traía la caja y se extiende hasta "hasta". */
export function saldoEnRango(movs: Movimiento[], r: Rango): PuntoSaldo[] {
  const todos = saldoDiario(movs)
  if (!todos.length) return []
  const desde = r.desde
  const dentro = todos.filter((p) => (desde === null || p.fecha >= desde) && p.fecha <= r.hasta)
  let puntos = dentro
  if (desde !== null && dentro[0]?.fecha !== desde) {
    const anteriores = todos.filter((p) => p.fecha < desde)
    const inicial = anteriores.length ? anteriores[anteriores.length - 1].saldo : 0
    puntos = [{ fecha: desde, saldo: inicial }, ...dentro]
  }
  const ultimo = puntos[puntos.length - 1]
  if (ultimo && ultimo.fecha < r.hasta) puntos = [...puntos, { fecha: r.hasta, saldo: ultimo.saldo }]
  return puntos
}

/* ---------- Ventas ---------- */

export interface VentaSemanal {
  semana: string
  total: number
}

/** Ventas por semana (lunes), con semanas en cero para que el eje de tiempo sea continuo. */
export function ventasPorSemana(movs: Movimiento[], r: Rango): VentaSemanal[] {
  const ventas = activos(movs).filter(esVenta)
  const inicio = r.desde ?? primeraFecha(ventas)
  if (!inicio) return []
  const porSemana = new Map<string, number>()
  for (const v of ventas) {
    const s = lunesDe(v.fecha)
    porSemana.set(s, (porSemana.get(s) ?? 0) + v.monto)
  }
  const filas: VentaSemanal[] = []
  for (let s = lunesDe(inicio); s <= r.hasta; s = sumarDias(s, 7)) {
    filas.push({ semana: s, total: redondear(porSemana.get(s) ?? 0) })
  }
  return filas
}

export interface VentaPorVendedor {
  vendedor: string
  total: number
  ventas: number
}

export const SIN_VENDEDOR = 'Sin dato'

export function ventasPorVendedor(movs: Movimiento[]): VentaPorVendedor[] {
  const mapa = new Map<string, VentaPorVendedor>()
  for (const v of activos(movs).filter(esVenta)) {
    const nombre = v.vendedor?.trim() || SIN_VENDEDOR
    const fila = mapa.get(nombre) ?? { vendedor: nombre, total: 0, ventas: 0 }
    fila.total += v.monto
    fila.ventas += 1
    mapa.set(nombre, fila)
  }
  return [...mapa.values()].map((f) => ({ ...f, total: redondear(f.total) })).sort((a, b) => b.total - a.total)
}

export interface ResumenVentas {
  total: number
  dias: number
  promedioPorDia: number
  mejorDia: { fecha: string; total: number } | null
}

export function resumenVentas(movs: Movimiento[]): ResumenVentas {
  const porDia = new Map<string, number>()
  for (const v of activos(movs).filter(esVenta)) porDia.set(v.fecha, (porDia.get(v.fecha) ?? 0) + v.monto)
  let total = 0
  let mejorDia: ResumenVentas['mejorDia'] = null
  for (const [fecha, monto] of porDia) {
    total += monto
    if (!mejorDia || monto > mejorDia.total) mejorDia = { fecha, total: redondear(monto) }
  }
  const dias = porDia.size
  return { total: redondear(total), dias, promedioPorDia: dias ? redondear(total / dias) : 0, mejorDia }
}
