// Filtros de la barra lateral. Funciones puras: se prueban en tests/.
import { fechaConAnio } from '../lib/formato'
import type { TipoCategoria } from '../lib/rpc'
import { rangoDe, sumarDias, type Movimiento, type Periodo, type Rango } from '../dashboard/calculos'

export type PeriodoFiltro = Periodo | 'personalizado'

export interface Filtros {
  periodo: PeriodoFiltro
  /** Solo para "personalizado" (YYYY-MM-DD). */
  desde: string
  hasta: string
  tipos: TipoCategoria[]
  /** Vacío = todas las categorías. */
  categorias: number[]
  /** '' = todas las personas (registró o vendió). */
  persona: string
  soloRevisar: boolean
  verAnulados: boolean
}

export const TODOS_LOS_TIPOS: TipoCategoria[] = ['ingreso', 'gasto', 'transferencia']

export function filtrosIniciales(hoy: string): Filtros {
  return {
    periodo: '3m',
    desde: `${hoy.slice(0, 7)}-01`,
    hasta: hoy,
    tipos: [...TODOS_LOS_TIPOS],
    categorias: [],
    persona: '',
    soloRevisar: false,
    verAnulados: true,
  }
}

export function rangoDeFiltros(f: Filtros, hoy: string): Rango {
  if (f.periodo !== 'personalizado') return rangoDe(f.periodo, hoy)
  const hasta = f.hasta && f.hasta <= hoy ? f.hasta : hoy
  const desde = f.desde && f.desde <= hasta ? f.desde : null
  return { desde, hasta }
}

/** Mismo largo de días, justo antes del rango (para comparar). null si el rango es "todo". */
export function rangoAnterior(r: Rango): Rango | null {
  if (!r.desde) return null
  const dias = Math.round((Date.parse(`${r.hasta}T00:00:00Z`) - Date.parse(`${r.desde}T00:00:00Z`)) / 864e5) + 1
  const hasta = sumarDias(r.desde, -1)
  return { desde: sumarDias(hasta, -(dias - 1)), hasta }
}

const enRango = (fecha: string, r: Rango) => (r.desde === null || fecha >= r.desde) && fecha <= r.hasta

/** Aplica todos los filtros. Los anulados se devuelven si verAnulados (los totales ya los ignoran). */
export function aplicarFiltros(movs: Movimiento[], f: Filtros, r: Rango): Movimiento[] {
  const tipos = new Set(f.tipos)
  const categorias = new Set(f.categorias)
  const persona = f.persona.trim().toLocaleLowerCase('es')
  return movs.filter(
    (m) =>
      enRango(m.fecha, r) &&
      tipos.has(m.tipo) &&
      (categorias.size === 0 || categorias.has(m.categoria_id)) &&
      (!persona || m.registrado_por.toLocaleLowerCase('es') === persona || (m.vendedor ?? '').toLocaleLowerCase('es') === persona) &&
      (!f.soloRevisar || m.revisar) &&
      (f.verAnulados || !m.anulado),
  )
}

/** Personas que aparecen en los datos (registraron o vendieron), sin "Cuaderno". */
export function personasDe(movs: Movimiento[]): string[] {
  const nombres = new Set<string>()
  for (const m of movs) {
    if (m.fuente !== 'cuaderno' && m.registrado_por) nombres.add(m.registrado_por)
    if (m.vendedor) nombres.add(m.vendedor)
  }
  return [...nombres].sort((a, b) => a.localeCompare(b, 'es'))
}

/** Cuántos filtros (sin contar el periodo, que tiene sus propios chips siempre visibles) se alejan de los iniciales. */
export function cuantosFiltros(f: Filtros): number {
  let n = 0
  if (f.tipos.length !== TODOS_LOS_TIPOS.length) n++
  if (f.categorias.length) n++
  if (f.persona) n++
  if (f.soloRevisar) n++
  if (!f.verAnulados) n++
  return n
}

/** Variación porcentual; null si no hay base para comparar. */
export function variacion(actual: number, anterior: number): number | null {
  if (!anterior) return null
  return (actual - anterior) / anterior
}

export function textoRango(r: Rango): string {
  return r.desde ? `Del ${fechaConAnio(r.desde)} al ${fechaConAnio(r.hasta)}` : `Todo el historial, hasta el ${fechaConAnio(r.hasta)}`
}
