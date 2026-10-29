// Sesión de quien registra: nombre + clave del bar. "Recordarme" la guarda en el celular
// (localStorage); si no, dura hasta cerrar la pestaña (sessionStorage).
import { LLAVES, borrarGuardado, guardar, leerGuardado } from '../lib/almacen'
import type { Sesion } from '../registrar/tipos'

export type { Sesion }

function leerTemporal(): Sesion | null {
  try {
    const texto = sessionStorage.getItem(LLAVES.sesion)
    return texto ? (JSON.parse(texto) as Sesion) : null
  } catch {
    return null
  }
}

export function leerSesion(): Sesion | null {
  return leerGuardado<Sesion>(LLAVES.sesion) ?? leerTemporal()
}

export function guardarSesion(sesion: Sesion, recordar: boolean): void {
  borrarSesion()
  if (recordar) {
    guardar(LLAVES.sesion, sesion)
    return
  }
  try {
    sessionStorage.setItem(LLAVES.sesion, JSON.stringify(sesion))
  } catch {
    // Sin almacenamiento: la sesión vive solo en memoria.
  }
}

export function borrarSesion(): void {
  borrarGuardado(LLAVES.sesion)
  try {
    sessionStorage.removeItem(LLAVES.sesion)
  } catch {
    // Ignorado a propósito.
  }
}
