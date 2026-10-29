import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { rangoDe } from '../dashboard/calculos'
import { coloresGrafico } from '../dashboard/colores'
import { horaCorta, hoyEnBar } from '../lib/formato'
import { useMenosMovimiento } from '../lib/hooks'
import { explicarErrorServidor } from '../lib/rpc'
import { netoPendiente } from '../registrar/caja'
import { useCaja } from '../registrar/useCaja'
import { Aviso, Boton, Dialogo } from '../ui'
import { PantallaAcceso, useAcceso } from './Acceso'
import { Encabezado, type EstadoEnvio } from './Encabezado'
import { cuantosFiltros, filtrosIniciales, personasDe, type Filtros } from './filtros'
import { PanelFiltros } from './PanelFiltros'
import { RegistroPanel } from './RegistroPanel'
import { borrarSesion, guardarSesion, leerSesion, type Sesion } from './sesion'
import { usePanel } from './usePanel'

// Los gráficos se descargan aparte para que la primera pantalla abra rápido en el celular.
const Contenido = lazy(() => import('../dashboard/Contenido'))

const SECCIONES = [
  { id: 'resumen', texto: 'Resumen' },
  { id: 'gastos', texto: 'En qué se gastó' },
  { id: 'ventas', texto: 'Ventas' },
  { id: 'banco', texto: 'Banco y cierres' },
  { id: 'historial', texto: 'Historial' },
]

const colores = coloresGrafico(false)

/** La app: el dashboard se ve sin entrar; registrar (y anular) pide nombre + clave del bar. */
export function Panel() {
  const cliente = useQueryClient()
  const hoy = hoyEnBar()
  const menosMovimiento = useMenosMovimiento()

  const [sesion, setSesion] = useState<Sesion | null>(leerSesion)
  const [filtros, setFiltros] = useState<Filtros>(() => filtrosIniciales(hoy))
  const [verFiltros, setVerFiltros] = useState(false)
  const [verAcceso, setVerAcceso] = useState(false)
  const [registrando, setRegistrando] = useState(false)
  const [seccion, setSeccion] = useState('resumen')

  const panel = usePanel()
  const caja = useCaja(sesion)
  const datos = panel.data

  // Primera vez que llegan los datos: si en los últimos 3 meses no hay nada (p. ej. el cuaderno
  // histórico termina en mayo), abrir en "Todo" para no mostrar un panel vacío con $0.00.
  const ajusteInicial = useRef(false)
  useEffect(() => {
    if (!datos || ajusteInicial.current) return
    ajusteInicial.current = true
    const r = rangoDe('3m', hoy)
    const hayRecientes = datos.movimientos.some((m) => !m.anulado && (r.desde === null || m.fecha >= r.desde) && m.fecha <= r.hasta)
    if (!hayRecientes && datos.movimientos.length > 0) setFiltros((f) => (f.periodo === '3m' ? { ...f, periodo: 'todo' } : f))
  }, [datos, hoy])

  const acceso = useAcceso((s, recordar) => {
    guardarSesion(s, recordar)
    setSesion(s)
    setVerAcceso(false)
    setRegistrando(true)
  })

  const salir = useCallback(() => {
    borrarSesion()
    setRegistrando(false)
    setSesion(null)
  }, [])

  // Si la clave cambió (el servidor la rechaza al registrar), se pide entrar de nuevo.
  useEffect(() => {
    if (caja.problemaClave) salir()
  }, [caja.problemaClave, salir])

  // Resalta en la barra lateral la sección que se está viendo.
  useEffect(() => {
    if (!datos) return
    const observador = new IntersectionObserver(
      (entradas) => {
        const visible = entradas.find((e) => e.isIntersecting)
        if (visible) setSeccion(visible.target.id)
      },
      { rootMargin: '-20% 0px -70% 0px' },
    )
    for (const s of SECCIONES) {
      const el = document.getElementById(s.id)
      if (el) observador.observe(el)
    }
    return () => observador.disconnect()
  }, [datos])

  const personas = useMemo(() => (datos ? personasDe(datos.movimientos) : []), [datos])
  const porRevisar = datos ? datos.movimientos.filter((m) => m.revisar && !m.anulado).length : 0
  const actualizado = panel.dataUpdatedAt ? new Date(panel.dataUpdatedAt) : null
  const recargar = () => void cliente.invalidateQueries({ queryKey: ['panel'] })
  const activos = cuantosFiltros(filtros)

  const estado: EstadoEnvio = {
    enLinea: caja.enLinea,
    pendientes: caja.pendientes.length,
    sincronizando: caja.sincronizando,
    actualizado,
    enviar: () => void caja.enviarPendientes().then(recargar),
  }

  const limpiar = () => setFiltros((f) => ({ ...filtrosIniciales(hoy), periodo: f.periodo, desde: f.desde, hasta: f.hasta }))
  const irA = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: menosMovimiento ? 'auto' : 'smooth', block: 'start' })
  const registrar = () => (sesion ? setRegistrando(true) : setVerAcceso(true))

  const filtrosCompletos = (
    <PanelFiltros filtros={filtros} alCambiar={setFiltros} categorias={datos?.categorias ?? []} personas={personas} porRevisar={porRevisar} colores={colores} hoy={hoy} />
  )

  let cuerpo
  if (!datos) {
    cuerpo = panel.isError ? (
      <div className="max-w-xl space-y-4 py-10">
        <Aviso tono="error">No se pudieron cargar los datos. {explicarErrorServidor(panel.error.message)}</Aviso>
        <Boton onClick={recargar}>Intentar de nuevo</Boton>
      </div>
    ) : (
      <p className="py-24 text-center text-ink-2" role="status">
        Cargando la caja…
      </p>
    )
  } else {
    cuerpo = (
      <>
        {(!caja.enLinea || panel.isError) && (
          <div className="mb-6 space-y-3">
            {!caja.enLinea && (
              <Aviso tono="info">
                Sin internet: ves los datos de las {actualizado ? horaCorta(actualizado) : 'última vez'}.{sesion ? ' Puedes seguir registrando; se enviará al volver la conexión.' : ''}
              </Aviso>
            )}
            {panel.isError && caja.enLinea && <Aviso tono="error">No se pudieron actualizar los datos. {explicarErrorServidor(panel.error.message)}</Aviso>}
          </div>
        )}
        <Suspense
          fallback={
            <p className="py-24 text-center text-ink-2" role="status">
              Cargando la caja…
            </p>
          }
        >
          <Contenido
            panel={datos}
            filtros={filtros}
            hoy={hoy}
            colores={colores}
            netoPendiente={netoPendiente(caja.envios)}
            pendientes={caja.pendientes.length}
            puedeAnular={Boolean(sesion)}
            alVerTodo={() => setFiltros({ ...filtrosIniciales(hoy), periodo: 'todo' })}
            alAnulado={recargar}
          />
        </Suspense>
      </>
    )
  }

  return (
    <div className="min-h-dvh bg-white">
      <Encabezado
        sesion={sesion}
        estado={estado}
        filtros={filtros}
        alCambiarFiltros={setFiltros}
        filtrosActivos={activos}
        alAbrirFiltros={() => setVerFiltros(true)}
        alRegistrar={registrar}
        alSalir={salir}
      />

      <div className="mx-auto flex max-w-[1400px]">
        <aside aria-label="Filtros" className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-72 shrink-0 overflow-y-auto border-r border-line px-6 py-8 lg:block">
          <nav aria-label="Secciones" className="mb-8 space-y-0.5">
            {SECCIONES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => irA(s.id)}
                aria-current={seccion === s.id ? 'true' : undefined}
                className={`flex min-h-9 w-full items-center rounded-lg px-3 text-sm transition-colors duration-200 ${
                  seccion === s.id ? 'bg-emerald-50 font-semibold text-emerald-900' : 'text-ink-2 hover:bg-emerald-50 hover:text-emerald-900'
                }`}
              >
                {s.texto}
              </button>
            ))}
          </nav>
          <div className="mb-5 flex items-center justify-between">
            <p className="font-serif text-xl">Filtros</p>
            {activos > 0 && (
              <button type="button" onClick={limpiar} className="min-h-9 text-sm font-medium underline decoration-stone-300 underline-offset-4">
                Limpiar
              </button>
            )}
          </div>
          {filtrosCompletos}
        </aside>

        <main className="min-w-0 flex-1 px-4 pt-6 pb-20 sm:px-6 lg:px-10 lg:pt-10">{cuerpo}</main>
      </div>

      <Dialogo
        abierto={verFiltros}
        titulo="Filtros"
        alCerrar={() => setVerFiltros(false)}
        pie={
          <div className="flex gap-3">
            <Boton variante="secundario" className="flex-1" onClick={limpiar}>
              Limpiar
            </Boton>
            <Boton className="flex-1" onClick={() => setVerFiltros(false)}>
              Ver resultados
            </Boton>
          </div>
        }
      >
        {filtrosCompletos}
      </Dialogo>

      {verAcceso && <PantallaAcceso acceso={acceso} alCerrar={() => setVerAcceso(false)} />}
      {sesion && <RegistroPanel abierto={registrando} alCerrar={() => setRegistrando(false)} sesion={sesion} caja={caja} alGuardado={recargar} />}
    </div>
  )
}
