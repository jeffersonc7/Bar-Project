import { describe, expect, it } from 'vitest'
import type { Movimiento } from '../src/bar/dashboard/calculos'
import { aplicarFiltros, cuantosFiltros, filtrosIniciales, personasDe, rangoAnterior, rangoDeFiltros, variacion } from '../src/bar/panel/filtros'

const base = { descripcion: null, vendedor: null, registrado_por: 'Saidy', fuente: 'formulario', revisar: false, nota_revision: null, anulado: false, motivo_anulacion: null, anulado_por: null, anulado_en: null, creado_en: '' }
const movs: Movimiento[] = [
  { ...base, id: 1, fecha: '2026-10-01', categoria_id: 1, categoria: 'Venta bar', tipo: 'ingreso', monto: 50, vendedor: 'Anahí' },
  { ...base, id: 2, fecha: '2026-10-02', categoria_id: 5, categoria: 'Compras (factura)', tipo: 'gasto', monto: 20 },
  { ...base, id: 3, fecha: '2026-10-03', categoria_id: 11, categoria: 'Transferencia al banco', tipo: 'transferencia', monto: 100 },
  { ...base, id: 4, fecha: '2026-07-15', categoria_id: 6, categoria: 'Refrigerio (pan, pasteles, colas)', tipo: 'gasto', monto: 8, revisar: true },
  { ...base, id: 5, fecha: '2026-10-04', categoria_id: 5, categoria: 'Compras (factura)', tipo: 'gasto', monto: 99, anulado: true },
  { ...base, id: 6, fecha: '2026-02-01', categoria_id: 2, categoria: 'Entrega', tipo: 'ingreso', monto: 45.9, registrado_por: 'Cuaderno (histórico)', fuente: 'cuaderno' },
]
const hoy = '2026-10-27'
const ids = (lista: Movimiento[]) => lista.map((m) => m.id)

describe('filtros de la barra lateral', () => {
  it('por defecto: últimos 3 meses, todos los tipos, con anulados', () => {
    const f = filtrosIniciales(hoy)
    expect(ids(aplicarFiltros(movs, f, rangoDeFiltros(f, hoy)))).toEqual([1, 2, 3, 5])
    expect(cuantosFiltros(f)).toBe(0)
  })

  it('tipo, categoría, persona, revisar y anulados', () => {
    const f = filtrosIniciales(hoy)
    const todo = { ...f, periodo: 'todo' as const }
    const r = rangoDeFiltros(todo, hoy)
    expect(ids(aplicarFiltros(movs, { ...todo, tipos: ['gasto'] }, r))).toEqual([2, 4, 5])
    expect(ids(aplicarFiltros(movs, { ...todo, categorias: [5] }, r))).toEqual([2, 5])
    expect(ids(aplicarFiltros(movs, { ...todo, persona: 'anahí' }, r))).toEqual([1]) // vendió (sin importar mayúsculas)
    expect(ids(aplicarFiltros(movs, { ...todo, soloRevisar: true }, r))).toEqual([4])
    expect(ids(aplicarFiltros(movs, { ...todo, verAnulados: false }, r))).not.toContain(5)
    expect(cuantosFiltros({ ...todo, tipos: ['gasto'], persona: 'Anahí' })).toBe(2) // el periodo no cuenta
  })

  it('fechas elegidas a mano (y nunca futuras)', () => {
    const f = { ...filtrosIniciales(hoy), periodo: 'personalizado' as const, desde: '2026-10-02', hasta: '2026-12-31' }
    const r = rangoDeFiltros(f, hoy)
    expect(r).toEqual({ desde: '2026-10-02', hasta: hoy })
    expect(ids(aplicarFiltros(movs, f, r))).toEqual([2, 3, 5])
  })

  it('periodo anterior del mismo largo y variación', () => {
    expect(rangoAnterior({ desde: '2026-10-01', hasta: '2026-10-31' })).toEqual({ desde: '2026-08-31', hasta: '2026-09-30' })
    expect(rangoAnterior({ desde: null, hasta: hoy })).toBeNull()
    expect(variacion(150, 100)).toBeCloseTo(0.5)
    expect(variacion(10, 0)).toBeNull()
  })

  it('personas para el filtro: quien registró o vendió, sin el cuaderno', () => {
    expect(personasDe(movs)).toEqual(['Anahí', 'Saidy'])
  })
})
