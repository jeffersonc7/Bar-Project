import { Clock, LogOut, Plus, SlidersHorizontal, WifiOff } from 'lucide-react'
import { horaCorta } from '../lib/formato'
import { Boton } from '../ui'
import type { Filtros } from './filtros'
import { ChipsPeriodo } from './PanelFiltros'
import type { Sesion } from './sesion'

export interface EstadoEnvio {
  enLinea: boolean
  pendientes: number
  sincronizando: boolean
  actualizado: Date | null
  enviar: () => void
}

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

/** Barra superior: marca, estado y "Registrar" (pide entrar si no hay sesión). En el celular, debajo, el periodo y "Filtros". */
export function Encabezado({
  sesion,
  estado,
  filtros,
  alCambiarFiltros,
  filtrosActivos,
  alAbrirFiltros,
  alRegistrar,
  alSalir,
}: {
  sesion: Sesion | null
  estado: EstadoEnvio
  filtros: Filtros
  alCambiarFiltros: (f: Filtros) => void
  filtrosActivos: number
  alAbrirFiltros: () => void
  alRegistrar: () => void
  alSalir: () => void
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-10">
        <p className="font-serif text-[1.4rem] leading-none tracking-tight">Caja del Bar</p>

        <p className="hidden items-center gap-1.5 text-sm text-muted md:flex" role="status">
          {!estado.enLinea ? (
            <>
              <WifiOff className="size-4" aria-hidden="true" /> Sin internet
            </>
          ) : (
            estado.actualizado && <>Actualizado {horaCorta(estado.actualizado)}</>
          )}
        </p>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {sesion && estado.pendientes > 0 && (
            <button
              type="button"
              onClick={estado.enviar}
              disabled={estado.sincronizando}
              title="Enviar lo que está guardado en este equipo"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-amber-50 px-3 text-sm font-medium text-alerta"
            >
              <Clock className="size-4" aria-hidden="true" />
              {estado.sincronizando ? 'Enviando…' : `${estado.pendientes} por enviar`}
            </button>
          )}
          {sesion && (
            <>
              <span className="flex items-center gap-2" title={`Registrando como ${sesion.nombre}`}>
                <span className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-900" aria-hidden="true">
                  {iniciales(sesion.nombre)}
                </span>
                <span className="hidden text-sm font-medium sm:inline">{sesion.nombre}</span>
              </span>
              <button
                type="button"
                onClick={alSalir}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                className="flex size-9 items-center justify-center rounded-full text-ink-2 transition-colors duration-200 hover:bg-suave hover:text-ink"
              >
                <LogOut className="size-[18px]" aria-hidden="true" />
              </button>
            </>
          )}
          <Boton onClick={alRegistrar} className="!min-h-10 !rounded-full px-4 text-sm">
            <Plus className="size-4" aria-hidden="true" /> Registrar
          </Boton>
        </div>
      </div>

      {/* Celular: periodo a un toque y el resto de filtros en una hoja. */}
      <div className="sin-barra flex items-center gap-1.5 overflow-x-auto px-4 pb-3 sm:px-6 lg:hidden">
        <button
          type="button"
          onClick={alAbrirFiltros}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 text-sm font-medium text-emerald-900 transition-colors duration-200 hover:bg-emerald-100"
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" /> Filtros
          {filtrosActivos > 0 && <span className="flex size-5 items-center justify-center rounded-full bg-emerald-700 text-[11px] text-white">{filtrosActivos}</span>}
        </button>
        <span className="h-5 w-px shrink-0 bg-line" aria-hidden="true" />
        <ChipsPeriodo filtros={filtros} alCambiar={alCambiarFiltros} />
      </div>
    </header>
  )
}
