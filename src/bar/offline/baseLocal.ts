// Cola local (IndexedDB) de lo registrado en el celular. Cada envío se guarda aquí
// primero y se manda al servidor cuando hay internet; el servidor no duplica gracias a
// id_cliente (movimientos) y al id del cierre.
import Dexie, { type EntityTable } from 'dexie'
import type { MovimientoEnvio, TipoCategoria } from '../lib/rpc'

/** Movimiento + datos solo para mostrarlo en el celular (no viajan al servidor). */
export interface MovimientoLocal extends MovimientoEnvio {
  categoria: string
  tipo: TipoCategoria
}

export interface CierreLocal {
  fecha: string
  contado: number
  nota: string | null
  /** Lo que el celular calculó al registrar; el valor oficial lo calcula el servidor. */
  esperado: number | null
}

interface EnvioBase {
  /** lote_id de los movimientos, o id_cliente del cierre. */
  id: string
  registrado_por: string
  creado_en: string
  estado: 'pendiente' | 'error'
  error?: string
}

export type Envio =
  | (EnvioBase & { clase: 'movimientos'; movimientos: MovimientoLocal[] })
  | (EnvioBase & { clase: 'cierre'; cierre: CierreLocal })

class BaseLocal extends Dexie {
  envios!: EntityTable<Envio, 'id'>

  constructor() {
    super('caja-del-bar')
    this.version(1).stores({ envios: 'id, creado_en, estado' })
  }
}

export const baseLocal = new BaseLocal()
