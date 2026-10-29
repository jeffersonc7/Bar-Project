import { describe, expect, it } from 'vitest'
import {
  flujoPorMes,
  gastosPorCategoria,
  gastosPorMes,
  lunesDe,
  mesesEntre,
  rangoDe,
  resumenVentas,
  saldoDiario,
  saldoEnRango,
  totales,
  ventasPorSemana,
  ventasPorVendedor,
  type Movimiento,
} from '../src/bar/dashboard/calculos'
import { estimarCaja, netoPendiente, paraDepositar } from '../src/bar/registrar/caja'
import type { Envio } from '../src/bar/offline/baseLocal'

let siguienteId = 1
function mov(fecha: string, categoria: string, tipo: Movimiento['tipo'], monto: number, extra: Partial<Movimiento> = {}): Movimiento {
  const ids: Record<string, number> = { 'Venta bar': 1, Entrega: 2, 'Compras (factura)': 5, 'Refrigerio (pan, pasteles, colas)': 6, 'Transferencia al banco': 11 }
  return {
    id: siguienteId++,
    fecha,
    categoria_id: ids[categoria] ?? 99,
    categoria,
    tipo,
    monto,
    descripcion: null,
    vendedor: null,
    registrado_por: 'Prueba',
    fuente: 'formulario',
    revisar: false,
    nota_revision: null,
    anulado: false,
    motivo_anulacion: null,
    anulado_por: null,
    anulado_en: null,
    creado_en: `${fecha}T12:00:00Z`,
    ...extra,
  }
}

// Primeras filas reales del cuaderno (febrero 2026).
const cuaderno: Movimiento[] = [
  mov('2026-02-01', 'Entrega', 'ingreso', 45.9),
  mov('2026-02-04', 'Entrega', 'ingreso', 3.52),
  mov('2026-02-04', 'Refrigerio (pan, pasteles, colas)', 'gasto', 8),
  mov('2026-02-14', 'Refrigerio (pan, pasteles, colas)', 'gasto', 7.14),
  mov('2026-02-19', 'Venta bar', 'ingreso', 72.45),
  mov('2026-02-20', 'Compras (factura)', 'gasto', 46.81),
  mov('2026-02-21', 'Refrigerio (pan, pasteles, colas)', 'gasto', 25.5),
  mov('2026-02-21', 'Venta bar', 'ingreso', 92.9, { vendedor: 'Anahí' }),
]

describe('periodos', () => {
  it('últimos 3 meses = mes actual y los 2 anteriores completos', () => {
    expect(rangoDe('3m', '2026-10-27')).toEqual({ desde: '2026-08-01', hasta: '2026-10-27' })
    expect(rangoDe('12m', '2026-02-10')).toEqual({ desde: '2025-03-01', hasta: '2026-02-10' })
    expect(rangoDe('todo', '2026-10-27')).toEqual({ desde: null, hasta: '2026-10-27' })
  })

  it('meses y semanas', () => {
    expect(mesesEntre('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(lunesDe('2026-02-21')).toBe('2026-02-16') // sábado -> lunes
    expect(lunesDe('2026-02-16')).toBe('2026-02-16')
  })
})

describe('totales y gastos', () => {
  it('suma ingresos y gastos; los anulados no cuentan', () => {
    const anulado = mov('2026-02-22', 'Compras (factura)', 'gasto', 100, { anulado: true })
    const t = totales([...cuaderno, anulado])
    expect(t.ingresos).toBe(214.77)
    expect(t.gastos).toBe(87.45)
    expect(t.ventas).toBe(165.35)
    expect(t.resultado).toBe(127.32)
  })

  it('gastos por categoría ordenados con porcentaje', () => {
    const g = gastosPorCategoria(cuaderno)
    expect(g.map((x) => x.categoria)).toEqual(['Compras (factura)', 'Refrigerio (pan, pasteles, colas)'])
    expect(g[1].total).toBe(40.64)
    expect(g[0].porcentaje + g[1].porcentaje).toBeCloseTo(1)
  })

  it('gastos por mes incluye meses vacíos', () => {
    const filas = gastosPorMes(cuaderno, ['2026-01', '2026-02'], [
      { id: 5, nombre: 'Compras (factura)', tipo: 'gasto' },
      { id: 6, nombre: 'Refrigerio (pan, pasteles, colas)', tipo: 'gasto' },
    ])
    expect(filas[0]).toEqual({ mes: '2026-01', c5: 0, c6: 0 })
    expect(filas[1]).toEqual({ mes: '2026-02', c5: 46.81, c6: 40.64 })
  })

  it('flujo mensual: la transferencia al banco no es gasto', () => {
    const conDeposito = [...cuaderno, mov('2026-02-28', 'Transferencia al banco', 'transferencia', 70)]
    const [feb] = flujoPorMes(conDeposito, ['2026-02'])
    expect(feb).toEqual({ mes: '2026-02', ingresos: 214.77, gastos: 87.45, transferencias: 70, resultado: 127.32 })
  })
})

describe('saldo', () => {
  it('coincide con los saldos escritos en el cuaderno', () => {
    const saldos = saldoDiario(cuaderno)
    expect(saldos).toEqual([
      { fecha: '2026-02-01', saldo: 45.9 },
      { fecha: '2026-02-04', saldo: 41.42 },
      { fecha: '2026-02-14', saldo: 34.28 },
      { fecha: '2026-02-19', saldo: 106.73 },
      { fecha: '2026-02-20', saldo: 59.92 },
      { fecha: '2026-02-21', saldo: 127.32 },
    ])
  })

  it('en un rango arranca con el saldo previo y llega hasta el final del rango', () => {
    const puntos = saldoEnRango(cuaderno, { desde: '2026-02-15', hasta: '2026-02-28' })
    expect(puntos[0]).toEqual({ fecha: '2026-02-15', saldo: 34.28 })
    expect(puntos.at(-1)).toEqual({ fecha: '2026-02-28', saldo: 127.32 })
  })
})

describe('ventas', () => {
  it('por semana con semanas vacías en cero', () => {
    const semanas = ventasPorSemana(cuaderno, { desde: '2026-02-01', hasta: '2026-02-28' })
    expect(semanas.map((s) => s.semana)).toEqual(['2026-01-26', '2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23'])
    expect(semanas.find((s) => s.semana === '2026-02-16')?.total).toBe(165.35)
  })

  it('por vendedor, con "Sin dato" para el cuaderno', () => {
    expect(ventasPorVendedor(cuaderno)).toEqual([
      { vendedor: 'Anahí', total: 92.9, ventas: 1 },
      { vendedor: 'Sin dato', total: 72.45, ventas: 1 },
    ])
  })

  it('resumen de ventas', () => {
    expect(resumenVentas(cuaderno)).toEqual({ total: 165.35, dias: 2, promedioPorDia: 82.68, mejorDia: { fecha: '2026-02-21', total: 92.9 } })
  })
})

describe('caja del formulario (con lo pendiente del celular)', () => {
  const envios: Envio[] = [
    {
      id: 'a',
      clase: 'movimientos',
      registrado_por: 'Viviana',
      creado_en: '2026-10-27T15:00:00Z',
      estado: 'pendiente',
      movimientos: [
        { id_cliente: '1', fecha: '2026-10-27', categoria_id: 1, monto: 30, descripcion: null, vendedor: 'Viviana', categoria: 'Venta bar', tipo: 'ingreso' },
        { id_cliente: '2', fecha: '2026-10-27', categoria_id: 5, monto: 12.5, descripcion: null, vendedor: null, categoria: 'Compras (factura)', tipo: 'gasto' },
      ],
    },
    {
      id: 'b',
      clase: 'movimientos',
      registrado_por: 'Viviana',
      creado_en: '2026-10-27T16:00:00Z',
      estado: 'error',
      error: 'rechazado',
      movimientos: [
        { id_cliente: '3', fecha: '2026-10-27', categoria_id: 1, monto: 500, descripcion: null, vendedor: 'Viviana', categoria: 'Venta bar', tipo: 'ingreso' },
      ],
    },
  ]

  it('suma lo pendiente e ignora lo que el servidor rechazó', () => {
    expect(netoPendiente(envios)).toBe(17.5)
    expect(estimarCaja(200, envios)).toBe(217.5)
    expect(estimarCaja(null, envios)).toBeNull()
  })

  it('para transferir = max(0, caja − fondo)', () => {
    expect(paraDepositar(217.5, 150)).toBe(67.5)
    expect(paraDepositar(100, 150)).toBe(0)
  })
})
