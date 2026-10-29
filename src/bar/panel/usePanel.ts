import { useQuery } from '@tanstack/react-query'
import { LLAVES, guardar, leerGuardado } from '../lib/almacen'
import { useEnLinea } from '../lib/hooks'
import { obtenerPanel, type Panel } from '../lib/rpc'

const CADA_30_SEGUNDOS = 30_000

interface PanelGuardado {
  datos: Panel
  en: number
}

export async function cargarPanel(): Promise<Panel> {
  const datos = await obtenerPanel()
  guardar(LLAVES.panel, { datos, en: Date.now() } satisfies PanelGuardado)
  return datos
}

/**
 * Datos del dashboard (públicos, sin clave). Se actualizan cada 30 s con internet;
 * sin internet se muestra la última copia guardada en el equipo.
 */
export function usePanel() {
  const enLinea = useEnLinea()
  const copia = leerGuardado<PanelGuardado>(LLAVES.panel) ?? undefined

  return useQuery({
    queryKey: ['panel'],
    queryFn: cargarPanel,
    initialData: copia?.datos,
    initialDataUpdatedAt: copia?.en,
    staleTime: 10_000,
    refetchInterval: enLinea ? CADA_30_SEGUNDOS : false,
    // supabase-js ya reintenta las lecturas; con la Data API apagada no se insiste (hay que mostrar qué hacer).
    retry: (intentos, error) => intentos < 1 && !/schema cache|PGRST002/i.test(error.message),
  })
}
