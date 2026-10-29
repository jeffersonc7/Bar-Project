import { useCallback, useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { LLAVES, guardar, leerGuardado } from '../lib/almacen'
import { useEnLinea } from '../lib/hooks'
import { nuevoId } from '../lib/ids'
import { esProblemaDeClave, mensajeDeClave, obtenerCategorias, obtenerResumen, type Categoria, type Resumen } from '../lib/rpc'
import { baseLocal, type Envio } from '../offline/baseLocal'
import { sincronizar } from '../offline/sincronizar'
import { estimarCaja, paraDepositar } from './caja'
import type { Borrador, ResultadoGuardado, Sesion } from './tipos'

const CADA_MINUTO = 60_000

/** Estado de la caja para registrar: datos del servidor + cola del celular. Sin sesión no envía nada. */
export function useCaja(sesion: Sesion | null) {
  const enLinea = useEnLinea()
  const clave = sesion?.clave ?? null
  const [categorias, setCategorias] = useState<Categoria[]>(() => leerGuardado<Categoria[]>(LLAVES.categorias) ?? [])
  const [resumen, setResumen] = useState<Resumen | null>(() => leerGuardado<Resumen>(LLAVES.resumen))
  const [sincronizando, setSincronizando] = useState(false)
  const [problemaClave, setProblemaClave] = useState<string | null>(null)
  const envios = useLiveQuery(() => baseLocal.envios.orderBy('creado_en').toArray(), [], [] as Envio[])

  const refrescar = useCallback(async () => {
    if (!clave || !navigator.onLine) return
    try {
      const [r, cats] = await Promise.all([obtenerResumen(clave), obtenerCategorias()])
      setCategorias(cats)
      guardar(LLAVES.categorias, cats)
      if (r.ok) {
        setResumen(r)
        guardar(LLAVES.resumen, r)
        setProblemaClave(null)
      } else if (esProblemaDeClave(r.codigo)) {
        setProblemaClave(mensajeDeClave(r))
      }
    } catch {
      // Sin conexión con el servidor: se sigue con lo guardado en el celular.
    }
  }, [clave])

  const enviarPendientes = useCallback(async () => {
    if (!clave || !navigator.onLine) return
    setSincronizando(true)
    try {
      const r = await sincronizar(clave)
      if (r.detenido === 'clave') setProblemaClave(r.mensaje ?? 'La clave del bar no es válida.')
    } catch {
      // Error inesperado de IndexedDB: se reintenta en el próximo ciclo.
    } finally {
      setSincronizando(false)
    }
    await refrescar()
  }, [clave, refrescar])

  // Al abrir y cada vez que vuelve el internet.
  useEffect(() => {
    if (enLinea) void enviarPendientes()
  }, [enLinea, enviarPendientes])

  // Reintento periódico (y para ver lo que registran los demás).
  useEffect(() => {
    const t = window.setInterval(() => {
      if (navigator.onLine) void enviarPendientes()
    }, CADA_MINUTO)
    return () => window.clearInterval(t)
  }, [enviarPendientes])

  const guardarBorrador = useCallback(
    async (b: Borrador): Promise<ResultadoGuardado> => {
      if (!sesion) return { estado: 'error', mensaje: 'Entra con tu nombre y la clave del bar para registrar.' }
      const base = {
        id: nuevoId(),
        registrado_por: sesion.nombre,
        creado_en: new Date().toISOString(),
        estado: 'pendiente' as const,
      }
      const envio: Envio =
        b.clase === 'movimientos'
          ? { ...base, clase: 'movimientos', movimientos: b.movimientos }
          : { ...base, clase: 'cierre', cierre: b.cierre }

      await baseLocal.envios.add(envio)
      if (!navigator.onLine) return { estado: 'pendiente' }

      await enviarPendientes()
      let despues = await baseLocal.envios.get(envio.id)
      // Si justo había otra sincronización en curso, este envío pudo quedar para la siguiente.
      if (despues?.estado === 'pendiente' && navigator.onLine) {
        await enviarPendientes()
        despues = await baseLocal.envios.get(envio.id)
      }
      if (!despues) return { estado: 'enviado' }
      if (despues.estado === 'error') return { estado: 'error', mensaje: despues.error ?? 'El servidor no aceptó el registro.' }
      return { estado: 'pendiente' }
    },
    [sesion, enviarPendientes],
  )

  const descartar = useCallback(async (id: string) => {
    await baseLocal.envios.delete(id)
  }, [])

  const efectivo = estimarCaja(resumen?.efectivo_en_caja ?? null, envios)
  const fondo = resumen?.fondo_caja ?? null

  return {
    enLinea,
    categorias,
    resumen,
    envios,
    pendientes: envios.filter((e) => e.estado === 'pendiente'),
    conError: envios.filter((e) => e.estado === 'error'),
    efectivo,
    fondo,
    paraDepositar: paraDepositar(efectivo, fondo),
    sincronizando,
    problemaClave,
    enviarPendientes,
    guardar: guardarBorrador,
    descartar,
  }
}

export type EstadoCaja = ReturnType<typeof useCaja>
