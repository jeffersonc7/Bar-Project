import { MONTO_MAXIMO } from './config'
import { dinero } from './formato'

export type ResultadoMonto = { ok: true; valor: number } | { ok: false; error: string }

/**
 * Lee un monto escrito a mano en el celular. Acepta "12.50", "12,50", "$ 12.5" y "1,234.50".
 * Reglas de la spec: > 0, máximo 2 decimales, tope de $2,000 (aviso de punto decimal faltante).
 */
export function leerMonto(
  texto: string,
  opciones: { permitirCero?: boolean; maximo?: number } = {},
): ResultadoMonto {
  const { permitirCero = false, maximo = MONTO_MAXIMO } = opciones
  let limpio = texto.replace(/[\s$]/g, '')
  if (!limpio) return { ok: false, error: 'Escribe el monto.' }

  if (limpio.includes(',') && limpio.includes('.')) {
    // Con los dos separadores, el último es el decimal y el otro marca miles.
    const ultimo = Math.max(limpio.lastIndexOf(','), limpio.lastIndexOf('.'))
    limpio = `${limpio.slice(0, ultimo).replace(/[.,]/g, '')}.${limpio.slice(ultimo + 1)}`
  } else {
    limpio = limpio.replace(',', '.')
  }

  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) {
    return { ok: false, error: 'Usa solo números, con hasta 2 decimales (ej.: 12.50).' }
  }

  const valor = Number(limpio)
  if (valor < 0 || (valor === 0 && !permitirCero)) return { ok: false, error: 'El monto debe ser mayor que 0.' }
  if (valor > maximo) {
    return {
      ok: false,
      error:
        maximo === MONTO_MAXIMO
          ? 'El monto no puede pasar de $2,000. ¿Falta el punto decimal?'
          : `El monto no puede pasar de ${dinero(maximo)}.`,
    }
  }
  return { ok: true, valor }
}

/** Fecha obligatoria y nunca futura (hoy = fecha del bar, YYYY-MM-DD). */
export function validarFecha(fecha: string, hoy: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return 'Elige la fecha.'
  if (fecha > hoy) return 'La fecha no puede ser futura.'
  return null
}

export function validarNombre(nombre: string): string | null {
  const limpio = nombre.trim()
  if (!limpio) return 'Escribe el nombre.'
  if (limpio.length > 60) return 'El nombre admite máximo 60 caracteres.'
  return null
}

export function validarClaveBar(clave: string): string | null {
  return /^\d{4}$/.test(clave) ? null : 'La clave del bar tiene 4 números.'
}

export function validarTexto(texto: string, obligatorio: boolean, mensaje: string): string | null {
  const limpio = texto.trim()
  if (obligatorio && !limpio) return mensaje
  if (limpio.length > 500) return 'Máximo 500 caracteres.'
  return null
}
