import type { CierreLocal, MovimientoLocal } from '../offline/baseLocal'

export interface Sesion {
  nombre: string
  clave: string
}

/** Lo que se muestra en la pantalla de confirmación antes de guardar. */
export type Borrador =
  | { clase: 'movimientos'; titulo: string; movimientos: MovimientoLocal[] }
  | { clase: 'cierre'; titulo: string; cierre: CierreLocal }

export type ResultadoGuardado =
  | { estado: 'enviado' }
  | { estado: 'pendiente' }
  | { estado: 'error'; mensaje: string }
