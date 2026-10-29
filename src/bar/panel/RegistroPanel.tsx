import { useState } from 'react'
import { ClipboardCheck, HandCoins, Landmark, Receipt, Wallet, X, type LucideIcon } from 'lucide-react'
import { dinero, fechaCorta, fechaLarga, hoyEnBar, redondear } from '../lib/formato'
import type { Envio } from '../offline/baseLocal'
import { Confirmacion } from '../registrar/Confirmacion'
import { FormBanco, FormCierre, FormGastos, FormOtroIngreso, FormVenta, type PropsFormulario } from '../registrar/formularios'
import { ListaRegistros } from '../registrar/ListaRegistros'
import type { Borrador } from '../registrar/tipos'
import type { EstadoCaja } from '../registrar/useCaja'
import { Aviso, Boton, Cajon } from '../ui'
import type { Sesion } from './sesion'

type Pestana = 'venta' | 'gasto' | 'ingreso' | 'banco' | 'cierre'

const PESTANAS: { id: Pestana; texto: string; titulo: string; Icono: LucideIcon }[] = [
  { id: 'venta', texto: 'Venta', titulo: 'Registrar una venta', Icono: Receipt },
  { id: 'gasto', texto: 'Gastos', titulo: 'Registrar gastos', Icono: Wallet },
  { id: 'ingreso', texto: 'Ingreso', titulo: 'Registrar otro ingreso', Icono: HandCoins },
  { id: 'banco', texto: 'Banco', titulo: 'Transferencia al banco', Icono: Landmark },
  { id: 'cierre', texto: 'Cierre', titulo: 'Cierre de caja del día', Icono: ClipboardCheck },
]

type AvisoGuardado = { tono: 'ok' | 'info' | 'error'; texto: string }

function describirEnvio(e: Envio): string {
  if (e.clase === 'cierre') return `Cierre de caja del ${fechaLarga(e.cierre.fecha)}`
  const total = redondear(e.movimientos.reduce((s, m) => s + m.monto, 0))
  const nombres = [...new Set(e.movimientos.map((m) => m.categoria))].join(', ')
  return `${nombres} por ${dinero(total)}, ${fechaCorta(e.movimientos[0].fecha)}`
}

/** Cajón "Registrar": las cinco formas de registrar, con confirmación y cola sin internet. */
export function RegistroPanel({
  abierto,
  alCerrar,
  sesion,
  caja,
  alGuardado,
}: {
  abierto: boolean
  alCerrar: () => void
  sesion: Sesion
  caja: EstadoCaja
  alGuardado: () => void
}) {
  const hoy = hoyEnBar()
  const [pestana, setPestana] = useState<Pestana>('venta')
  const [fecha, setFecha] = useState(hoy)
  const [borrador, setBorrador] = useState<Borrador | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<AvisoGuardado | null>(null)
  const [version, setVersion] = useState(0)

  const actual = PESTANAS.find((t) => t.id === pestana) ?? PESTANAS[0]
  const cierrePendiente = caja.resumen?.cierre_pendiente ?? null

  async function guardarBorrador() {
    if (!borrador) return
    setGuardando(true)
    try {
      const r = await caja.guardar(borrador)
      setBorrador(null)
      setVersion((v) => v + 1) // limpia el formulario; la fecha se mantiene (spec)
      setAviso(
        r.estado === 'enviado'
          ? { tono: 'ok', texto: 'Guardado. Ya está en el sistema.' }
          : r.estado === 'pendiente'
            ? { tono: 'info', texto: 'Guardado en el celular. Se enviará solo cuando vuelva el internet.' }
            : { tono: 'error', texto: `El sistema no lo aceptó: ${r.mensaje}` },
      )
      if (r.estado === 'enviado') alGuardado()
    } catch {
      setAviso({ tono: 'error', texto: 'No se pudo guardar en el celular. Intenta de nuevo.' })
      setBorrador(null)
    } finally {
      setGuardando(false)
    }
  }

  function cambiarPestana(id: Pestana) {
    setPestana(id)
    setAviso(null)
  }

  const props: PropsFormulario = {
    fecha,
    alCambiarFecha: setFecha,
    hoy,
    categorias: caja.categorias,
    alRevisar: (b) => {
      setAviso(null)
      setBorrador(b)
    },
  }

  return (
    <Cajon abierto={abierto} etiqueta="Registrar" alCerrar={() => !guardando && alCerrar()} className="bg-white text-ink">
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-3 border-b border-line px-5 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-2xl leading-tight">Registrar</h2>
            <p className="truncate text-sm text-ink-2">Como {sesion.nombre}</p>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar registrar"
            className="flex size-10 items-center justify-center rounded-full text-ink-2 transition-colors duration-200 hover:bg-suave hover:text-ink"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-emerald-800 p-4 text-white">
              <dt className="text-xs text-emerald-100">Efectivo en caja</dt>
              <dd className="cifras mt-1 text-xl font-semibold">{caja.efectivo !== null ? dinero(caja.efectivo) : '—'}</dd>
            </div>
            <div className="rounded-2xl bg-amber-100 p-4 text-amber-950">
              <dt className="text-xs text-amber-900">Recomendado transferir</dt>
              <dd className="cifras mt-1 text-xl font-semibold">{caja.paraDepositar !== null ? dinero(caja.paraDepositar) : '—'}</dd>
            </div>
          </dl>

          {caja.problemaClave && <Aviso tono="error">{caja.problemaClave} Lo que está por enviar no se pierde.</Aviso>}
          {cierrePendiente && pestana !== 'cierre' && (
            <Aviso
              tono="alerta"
              accion={
                <Boton
                  variante="texto"
                  onClick={() => {
                    cambiarPestana('cierre')
                    setFecha(cierrePendiente)
                  }}
                >
                  Hacer ese cierre
                </Boton>
              }
            >
              El {fechaLarga(cierrePendiente)} quedó sin cierre de caja.
            </Aviso>
          )}

          <nav aria-label="Qué vas a registrar" className="grid grid-cols-5 gap-1 rounded-2xl bg-suave p-1">
            {PESTANAS.map(({ id, texto, Icono }) => (
              <button
                key={id}
                type="button"
                aria-pressed={pestana === id}
                onClick={() => cambiarPestana(id)}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-1 text-xs font-medium transition-colors duration-200 ${
                  pestana === id ? 'bg-accion text-on-accion shadow-sm' : 'text-ink-2 hover:text-ink'
                }`}
              >
                <Icono className="size-5" aria-hidden="true" />
                {texto}
              </button>
            ))}
          </nav>

          <section aria-labelledby="titulo-formulario" className="rounded-2xl border border-line p-5">
            <h3 id="titulo-formulario" className="font-serif text-xl">
              {actual.titulo}
            </h3>
            {aviso && (
              <div className="mt-4">
                <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>
              </div>
            )}
            <div className="mt-5" key={`${pestana}-${version}`}>
              {pestana === 'venta' && <FormVenta {...props} nombre={sesion.nombre} />}
              {pestana === 'gasto' && <FormGastos {...props} />}
              {pestana === 'ingreso' && <FormOtroIngreso {...props} />}
              {pestana === 'banco' && <FormBanco {...props} caja={caja.efectivo} sugerido={caja.paraDepositar} />}
              {pestana === 'cierre' && <FormCierre {...props} caja={caja.efectivo} />}
            </div>
          </section>

          {caja.conError.length > 0 && (
            <section aria-labelledby="titulo-errores" className="space-y-3">
              <h3 id="titulo-errores" className="font-semibold">
                No se pudieron guardar
              </h3>
              {caja.conError.map((e) => (
                <Aviso
                  key={e.id}
                  tono="error"
                  accion={
                    <Boton variante="texto" onClick={() => void caja.descartar(e.id)}>
                      Descartar
                    </Boton>
                  }
                >
                  <p className="font-semibold">{describirEnvio(e)}</p>
                  <p className="text-sm">{e.error}</p>
                  <p className="mt-1 text-sm text-ink-2">Corrige los datos y vuelve a registrarlo; luego descarta este aviso.</p>
                </Aviso>
              ))}
            </section>
          )}

          <section aria-labelledby="titulo-ultimos">
            <h3 id="titulo-ultimos" className="mb-3 font-semibold">
              Últimos registros
            </h3>
            <ListaRegistros envios={caja.envios} ultimos={caja.resumen?.ultimos ?? []} />
          </section>
        </div>
      </div>

      <Confirmacion
        borrador={borrador}
        nombre={sesion.nombre}
        guardando={guardando}
        alGuardar={() => void guardarBorrador()}
        alVolver={() => {
          if (!guardando) setBorrador(null)
        }}
      />
    </Cajon>
  )
}
