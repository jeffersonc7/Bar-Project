// localStorage puede fallar (modo privado, almacenamiento bloqueado): nunca debe romper la app.

export function leerGuardado<T>(llave: string): T | null {
  try {
    const texto = localStorage.getItem(llave)
    return texto ? (JSON.parse(texto) as T) : null
  } catch {
    return null
  }
}

export function guardar(llave: string, valor: unknown): void {
  try {
    localStorage.setItem(llave, JSON.stringify(valor))
  } catch {
    // Sin almacenamiento: la app sigue funcionando en memoria.
  }
}

export function borrarGuardado(llave: string): void {
  try {
    localStorage.removeItem(llave)
  } catch {
    // Ignorado a propósito.
  }
}

export const LLAVES = {
  sesion: 'caja-bar:sesion',
  categorias: 'caja-bar:categorias',
  resumen: 'caja-bar:resumen',
  /** Última copia del panel (público), para verlo sin internet. */
  panel: 'caja-bar:panel',
} as const
