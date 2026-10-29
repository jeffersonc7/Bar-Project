import { describe, expect, it } from 'vitest'
import { dinero, dineroEje, hoyEnBar } from '../src/bar/lib/formato'
import { leerMonto, validarClaveBar, validarFecha, validarTexto } from '../src/bar/lib/validaciones'

describe('leerMonto', () => {
  it('acepta punto o coma como decimal', () => {
    expect(leerMonto('12.50')).toEqual({ ok: true, valor: 12.5 })
    expect(leerMonto('12,5')).toEqual({ ok: true, valor: 12.5 })
    expect(leerMonto('$ 45.90')).toEqual({ ok: true, valor: 45.9 })
  })

  it('entiende separador de miles cuando hay los dos separadores', () => {
    expect(leerMonto('1,234.50')).toEqual({ ok: true, valor: 1234.5 })
    expect(leerMonto('1.234,50')).toEqual({ ok: true, valor: 1234.5 })
  })

  it('rechaza vacío, cero, negativos, letras y más de 2 decimales', () => {
    expect(leerMonto('').ok).toBe(false)
    expect(leerMonto('0').ok).toBe(false)
    expect(leerMonto('-5').ok).toBe(false)
    expect(leerMonto('abc').ok).toBe(false)
    expect(leerMonto('12.345').ok).toBe(false)
  })

  it('tope de $2,000 con aviso de punto decimal (spec)', () => {
    expect(leerMonto('2000')).toEqual({ ok: true, valor: 2000 })
    const r = leerMonto('2590')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/punto decimal/)
  })

  it('el cierre de caja admite cero y montos mayores', () => {
    expect(leerMonto('0', { permitirCero: true, maximo: 100000 })).toEqual({ ok: true, valor: 0 })
    expect(leerMonto('2500', { permitirCero: true, maximo: 100000 })).toEqual({ ok: true, valor: 2500 })
  })
})

describe('validaciones', () => {
  it('fecha obligatoria y no futura', () => {
    expect(validarFecha('', '2026-10-27')).not.toBeNull()
    expect(validarFecha('2026-10-28', '2026-10-27')).not.toBeNull()
    expect(validarFecha('2026-10-27', '2026-10-27')).toBeNull()
    expect(validarFecha('2026-02-01', '2026-10-27')).toBeNull()
  })

  it('clave del bar de 4 números', () => {
    expect(validarClaveBar('1234')).toBeNull()
    expect(validarClaveBar('123')).not.toBeNull()
    expect(validarClaveBar('12a4')).not.toBeNull()
  })

  it('texto obligatorio solo cuando se pide', () => {
    expect(validarTexto('  ', true, 'falta')).toBe('falta')
    expect(validarTexto('', false, 'falta')).toBeNull()
    expect(validarTexto('x'.repeat(501), false, '')).not.toBeNull()
  })
})

describe('formato', () => {
  it('dinero en USD con punto decimal', () => {
    expect(dinero(1234.5)).toBe('$1,234.50')
    expect(dinero(-8)).toBe('−$8.00')
    expect(dineroEje(1500)).toBe('$1.5K')
    expect(dineroEje(250)).toBe('$250')
  })

  it('hoy en Ecuador (UTC−5)', () => {
    // 2026-10-28 03:00 UTC todavía es 27 de octubre en Guayaquil.
    expect(hoyEnBar(new Date('2026-10-28T03:00:00Z'))).toBe('2026-10-27')
    expect(hoyEnBar(new Date('2026-10-28T06:00:00Z'))).toBe('2026-10-28')
  })
})
