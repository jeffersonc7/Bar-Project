// Cálculos de la pantalla de registro (sin dependencias de navegador: se prueban en tests/).
import { redondear } from '../lib/formato'
import type { Envio } from '../offline/baseLocal'

/** Efecto en la caja de lo que está en el celular por enviar (los envíos con error no cuentan). */
export function netoPendiente(envios: Envio[]): number {
  let neto = 0
  for (const envio of envios) {
    if (envio.estado !== 'pendiente' || envio.clase !== 'movimientos') continue
    for (const m of envio.movimientos) neto += m.tipo === 'ingreso' ? m.monto : -m.monto
  }
  return redondear(neto)
}

/** Efectivo en caja según el servidor más lo pendiente del celular. */
export function estimarCaja(efectivoServidor: number | null, envios: Envio[]): number | null {
  if (efectivoServidor === null) return null
  return redondear(efectivoServidor + netoPendiente(envios))
}

/** Spec: para transferir = max(0, caja − fondo). */
export function paraDepositar(caja: number | null, fondo: number | null): number | null {
  if (caja === null || fondo === null) return null
  return Math.max(0, redondear(caja - fondo))
}
