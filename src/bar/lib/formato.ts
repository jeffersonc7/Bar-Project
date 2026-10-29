import { ZONA_HORARIA } from './config'

const numero = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** A centavos, mitad hacia arriba. El 1e-9 corrige casos como 82.675 * 100 = 8267.499999… */
export function redondear(valor: number): number {
  const signo = valor < 0 ? -1 : 1
  const r = (signo * Math.round(Math.abs(valor) * 100 + 1e-9)) / 100
  return r === 0 ? 0 : r
}

/** $1,234.50 (con signo menos tipográfico si es negativo). */
export function dinero(valor: number): string {
  const signo = valor < 0 ? '−' : ''
  return `${signo}$${numero.format(Math.abs(valor))}`
}

/** Igual que dinero() pero con + explícito para resultados positivos. */
export function dineroConSigno(valor: number): string {
  return valor > 0 ? `+${dinero(valor)}` : dinero(valor)
}

/** Etiquetas de eje: $0, $250, $1.2K. */
export function dineroEje(valor: number): string {
  const abs = Math.abs(valor)
  const signo = valor < 0 ? '−' : ''
  if (abs >= 1000) return `${signo}$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1).replace(/\.0$/, '')}K`
  return `${signo}$${Math.round(abs)}`
}

/** Fecha de hoy en el bar (Ecuador), formato YYYY-MM-DD. */
export function hoyEnBar(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora)
}

function aFecha(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`)
}

const fmtDia = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const fmtDiaAnio = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const fmtMes = new Intl.DateTimeFormat('es-EC', { month: 'short', timeZone: 'UTC' })
const fmtMesAnio = new Intl.DateTimeFormat('es-EC', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const fmtDiaSemana = new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

const sinPunto = (texto: string) => texto.replace(/\./g, '')

/** "29 may" */
export function fechaCorta(iso: string): string {
  return sinPunto(fmtDia.format(aFecha(iso)))
}

/** "29 may 2026" */
export function fechaConAnio(iso: string): string {
  return sinPunto(fmtDiaAnio.format(aFecha(iso)))
}

/** "viernes, 29 de mayo" */
export function fechaLarga(iso: string): string {
  return fmtDiaSemana.format(aFecha(iso))
}

/** "2026-03" -> "mar" */
export function mesCorto(mes: string): string {
  return sinPunto(fmtMes.format(aFecha(`${mes}-01`)))
}

/** "2026-03" -> "marzo de 2026" */
export function mesLargo(mes: string): string {
  return fmtMesAnio.format(aFecha(`${mes}-01`))
}

/** Hora local corta, para "Actualizado 14:05". */
export function horaCorta(fecha: Date): string {
  return new Intl.DateTimeFormat('es-EC', { hour: '2-digit', minute: '2-digit', timeZone: ZONA_HORARIA }).format(fecha)
}
