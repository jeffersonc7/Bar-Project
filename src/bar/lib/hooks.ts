import { useSyncExternalStore } from 'react'

function suscribirConexion(avisar: () => void) {
  window.addEventListener('online', avisar)
  window.addEventListener('offline', avisar)
  return () => {
    window.removeEventListener('online', avisar)
    window.removeEventListener('offline', avisar)
  }
}

/** true si el navegador cree que hay internet. */
export function useEnLinea(): boolean {
  return useSyncExternalStore(suscribirConexion, () => navigator.onLine, () => true)
}

function consultaMedia(consulta: string) {
  return {
    suscribir(avisar: () => void) {
      const media = window.matchMedia(consulta)
      media.addEventListener('change', avisar)
      return () => media.removeEventListener('change', avisar)
    },
    leer: () => window.matchMedia(consulta).matches,
  }
}

const oscuro = consultaMedia('(prefers-color-scheme: dark)')
const menosMovimiento = consultaMedia('(prefers-reduced-motion: reduce)')

export function useModoOscuro(): boolean {
  return useSyncExternalStore(oscuro.suscribir, oscuro.leer, () => false)
}

export function useMenosMovimiento(): boolean {
  return useSyncExternalStore(menosMovimiento.suscribir, menosMovimiento.leer, () => false)
}
