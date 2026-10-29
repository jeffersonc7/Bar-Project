// Llamadas a las RPC de Supabase. El formulario nunca escribe directo en las tablas.
import type { Caja, CategoriaBasica, Cierre, Movimiento } from '../dashboard/calculos'
import type { Json } from './database.types'
import { supabase } from './supabase'

export type TipoCategoria = 'ingreso' | 'gasto' | 'transferencia'

export interface Categoria {
  id: number
  nombre: string
  tipo: TipoCategoria
  requiere_descripcion: boolean
  requiere_vendedor: boolean
}

export interface RespuestaError {
  ok: false
  codigo: string
  mensaje: string
  esperado?: number
  diferencia?: number
  efectivo_en_caja?: number
}

export interface UltimoRegistro {
  id: number
  fecha: string
  categoria: string
  tipo: TipoCategoria
  monto: number
  descripcion: string | null
  vendedor: string | null
  registrado_por: string
  creado_en: string
}

export interface Resumen {
  ok: true
  hoy: string
  efectivo_en_caja: number
  fondo_caja: number
  para_transferir: number
  ultimos: UltimoRegistro[]
  cierre_pendiente: string | null
}

export interface RegistroOk {
  ok: true
  lote_id: string
  insertados: number
  duplicados: number
  efectivo_en_caja: number
}

export interface CierreOk {
  ok: true
  duplicado: boolean
  fecha: string
  esperado: number
  diferencia: number
}

export interface AnulacionOk {
  ok: true
  id: number
  efectivo_en_caja: number
}

/** Lo que viaja al servidor por cada movimiento (registrar_movimientos.p_movimientos). */
export interface MovimientoEnvio {
  id_cliente: string
  fecha: string
  categoria_id: number
  monto: number
  descripcion: string | null
  vendedor: string | null
}

/** Sin internet o servidor caído: el envío se reintenta más tarde. */
export class ErrorDeConexion extends Error {}

/** Traduce errores técnicos del servidor a un mensaje que diga qué hacer. */
export function explicarErrorServidor(mensaje: string): string {
  if (/schema cache|PGRST002/i.test(mensaje)) {
    return 'El servidor de datos no está activo: en Supabase falta activar la Data API (ver docs/puesta-en-marcha.md, paso 1).'
  }
  if (/failed to fetch|network|load failed/i.test(mensaje)) {
    return 'No se pudo conectar con el servidor. Revisa el internet e intenta de nuevo.'
  }
  return `El servidor respondió con un error: ${mensaje}`
}

const CODIGOS_DE_CLAVE = new Set(['clave_invalida', 'clave_no_configurada', 'bloqueado'])

export function esProblemaDeClave(codigo: string): boolean {
  return CODIGOS_DE_CLAVE.has(codigo)
}

export function mensajeDeClave(respuesta: RespuestaError): string {
  switch (respuesta.codigo) {
    case 'clave_invalida':
      return 'Clave incorrecta. Después de 5 intentos fallidos se bloquea por 15 minutos.'
    case 'bloqueado':
      return 'Hubo demasiados intentos con clave incorrecta. Espera 15 minutos e intenta de nuevo.'
    case 'clave_no_configurada':
      return 'La clave todavía no está configurada. Pide al administrador que la configure.'
    default:
      return respuesta.mensaje
  }
}

function respuesta<T>(data: unknown, error: { message: string } | null): T | RespuestaError {
  if (error) throw new ErrorDeConexion(error.message)
  if (data === null || typeof data !== 'object') throw new ErrorDeConexion('El servidor respondió vacío.')
  return data as T | RespuestaError
}

export interface Panel {
  ok: true
  hoy: string
  caja: Caja
  categorias: CategoriaBasica[]
  movimientos: Movimiento[]
  cierres: Cierre[]
}

/** Todo lo que necesita el dashboard. Público (sin clave): decisión del usuario, ver panel_publico. */
export async function obtenerPanel(): Promise<Panel> {
  const { data, error } = await supabase.rpc('panel_publico')
  if (error) throw new ErrorDeConexion(error.message)
  const r = data as unknown as Panel
  return {
    ...r,
    caja: {
      efectivo_en_caja: Number(r.caja.efectivo_en_caja),
      fondo_caja: Number(r.caja.fondo_caja),
      para_transferir: Number(r.caja.para_transferir),
    },
    movimientos: (r.movimientos ?? []).map((m) => ({ ...m, monto: Number(m.monto) })),
    cierres: (r.cierres ?? []).map((c) => ({
      ...c,
      contado: Number(c.contado),
      esperado: Number(c.esperado),
      diferencia: Number(c.diferencia ?? Number(c.contado) - Number(c.esperado)),
    })),
  }
}

export async function obtenerCategorias(): Promise<Categoria[]> {
  const { data, error } = await supabase.rpc('obtener_categorias')
  if (error) throw new ErrorDeConexion(error.message)
  return Array.isArray(data) ? (data as unknown as Categoria[]) : []
}

export async function obtenerResumen(clave: string): Promise<Resumen | RespuestaError> {
  const { data, error } = await supabase.rpc('resumen_caja', { p_clave: clave })
  const r = respuesta<Resumen>(data, error)
  if (!r.ok) return r
  return {
    ...r,
    efectivo_en_caja: Number(r.efectivo_en_caja),
    fondo_caja: Number(r.fondo_caja),
    para_transferir: Number(r.para_transferir),
    ultimos: (r.ultimos ?? []).map((u) => ({ ...u, monto: Number(u.monto) })),
  }
}

export async function enviarMovimientos(
  clave: string,
  registradoPor: string,
  movimientos: MovimientoEnvio[],
  loteId: string,
): Promise<RegistroOk | RespuestaError> {
  const { data, error } = await supabase.rpc('registrar_movimientos', {
    p_clave: clave,
    p_registrado_por: registradoPor,
    p_movimientos: movimientos as unknown as Json,
    p_lote_id: loteId,
  })
  return respuesta<RegistroOk>(data, error)
}

export async function enviarCierre(
  clave: string,
  registradoPor: string,
  cierre: { fecha: string; contado: number; nota: string | null },
  idCliente: string,
): Promise<CierreOk | RespuestaError> {
  const { data, error } = await supabase.rpc('registrar_cierre_caja', {
    p_clave: clave,
    p_registrado_por: registradoPor,
    p_fecha: cierre.fecha,
    p_contado: cierre.contado,
    p_nota: cierre.nota ?? undefined,
    p_id_cliente: idCliente,
  })
  return respuesta<CierreOk>(data, error)
}

export async function anularMovimiento(
  claveAdmin: string,
  movimientoId: number,
  motivo: string,
  anuladoPor: string,
): Promise<AnulacionOk | RespuestaError> {
  const { data, error } = await supabase.rpc('anular_movimiento', {
    p_clave_admin: claveAdmin,
    p_movimiento_id: movimientoId,
    p_motivo: motivo,
    p_anulado_por: anuladoPor,
  })
  return respuesta<AnulacionOk>(data, error)
}
