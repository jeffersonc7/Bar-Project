import { dinero, dineroConSigno } from '../lib/formato'
import {
  enviarCierre,
  enviarMovimientos,
  ErrorDeConexion,
  esProblemaDeClave,
  type CierreOk,
  type RegistroOk,
  type RespuestaError,
} from '../lib/rpc'
import { baseLocal, type Envio } from './baseLocal'

export interface ResultadoSincronizacion {
  enviados: number
  /** null = se procesó toda la cola. */
  detenido: null | 'conexion' | 'clave'
  mensaje?: string
}

let enCurso: Promise<ResultadoSincronizacion> | null = null

/** Envía la cola en orden. Una sola sincronización a la vez (las llamadas concurrentes esperan la misma). */
export function sincronizar(clave: string): Promise<ResultadoSincronizacion> {
  if (!enCurso) {
    enCurso = procesar(clave).finally(() => {
      enCurso = null
    })
  }
  return enCurso
}

async function procesar(clave: string): Promise<ResultadoSincronizacion> {
  if (!navigator.onLine) return { enviados: 0, detenido: 'conexion' }

  const pendientes = await baseLocal.envios.where('estado').equals('pendiente').sortBy('creado_en')
  let enviados = 0

  for (const envio of pendientes) {
    let respuesta: RegistroOk | CierreOk | RespuestaError
    try {
      respuesta = await enviar(clave, envio)
    } catch (error) {
      if (error instanceof ErrorDeConexion) return { enviados, detenido: 'conexion' }
      throw error
    }

    if (respuesta.ok) {
      await baseLocal.envios.delete(envio.id)
      enviados += 1
      continue
    }
    // Con la clave mal no tiene sentido seguir: se conserva todo para reenviar con la clave nueva.
    if (esProblemaDeClave(respuesta.codigo)) {
      return { enviados, detenido: 'clave', mensaje: respuesta.mensaje }
    }
    // El servidor rechazó este envío (validación): se marca para que la persona lo revise.
    await baseLocal.envios.update(envio.id, { estado: 'error', error: explicar(respuesta) })
  }

  return { enviados, detenido: null }
}

function enviar(clave: string, envio: Envio) {
  if (envio.clase === 'movimientos') {
    const movimientos = envio.movimientos.map(({ id_cliente, fecha, categoria_id, monto, descripcion, vendedor }) => ({
      id_cliente,
      fecha,
      categoria_id,
      monto,
      descripcion,
      vendedor,
    }))
    return enviarMovimientos(clave, envio.registrado_por, movimientos, envio.id)
  }
  return enviarCierre(clave, envio.registrado_por, envio.cierre, envio.id)
}

function explicar(r: RespuestaError): string {
  if (r.codigo === 'nota_requerida' && r.esperado !== undefined && r.diferencia !== undefined) {
    return `${r.mensaje} El sistema esperaba ${dinero(Number(r.esperado))} (diferencia ${dineroConSigno(Number(r.diferencia))}).`
  }
  if (r.codigo === 'transferencia_excede_caja' && r.efectivo_en_caja !== undefined) {
    return `${r.mensaje} En caja hay ${dinero(Number(r.efectivo_en_caja))}.`
  }
  return r.mensaje
}
