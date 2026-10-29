import type { ReactNode } from 'react'
import { dinero, fechaLarga, redondear } from '../lib/formato'
import { Boton, Dialogo } from '../ui'
import type { Borrador } from './tipos'

function Fila({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-ink-2">{titulo}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  )
}

function Contenido({ borrador }: { borrador: Borrador }) {
  if (borrador.clase === 'cierre') {
    const { fecha, contado, esperado, nota } = borrador.cierre
    const diferencia = esperado !== null ? redondear(contado - esperado) : null
    return (
      <dl className="divide-y divide-line border-y border-line">
        <Fila titulo="Fecha">{fechaLarga(fecha)}</Fila>
        <Fila titulo="Efectivo contado">
          <span className="cifras">{dinero(contado)}</span>
        </Fila>
        <Fila titulo="El sistema espera">{esperado !== null ? <span className="cifras">{dinero(esperado)}</span> : 'Se calcula al guardar'}</Fila>
        {diferencia !== null && (
          <Fila titulo="Diferencia">
            {diferencia === 0 ? 'Cuadra' : `${diferencia > 0 ? 'Sobran' : 'Faltan'} ${dinero(Math.abs(diferencia))}`}
          </Fila>
        )}
        {nota && <Fila titulo="Nota">{nota}</Fila>}
      </dl>
    )
  }

  const movimientos = borrador.movimientos
  const total = redondear(movimientos.reduce((s, m) => s + m.monto, 0))
  return (
    <>
      <p className="text-ink-2">{fechaLarga(movimientos[0].fecha)}</p>
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {movimientos.map((m) => {
          const detalle = [m.vendedor && `Vendió ${m.vendedor}`, m.descripcion].filter(Boolean).join('. ')
          return (
            <li key={m.id_cliente} className="flex items-baseline justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="font-semibold">{m.categoria}</p>
                {detalle && <p className="text-sm text-ink-2">{detalle}</p>}
              </div>
              <p className={`cifras shrink-0 text-lg font-semibold ${m.tipo === 'ingreso' ? '' : 'text-salida'}`}>
                {m.tipo === 'ingreso' ? '+' : '−'}
                {dinero(m.monto)}
              </p>
            </li>
          )
        })}
      </ul>
      {movimientos.length > 1 && (
        <p className="mt-3 flex justify-between font-semibold">
          <span>Total</span>
          <span className="cifras">{dinero(total)}</span>
        </p>
      )}
    </>
  )
}

export function Confirmacion({
  borrador,
  nombre,
  guardando,
  alGuardar,
  alVolver,
}: {
  borrador: Borrador | null
  nombre: string
  guardando: boolean
  alGuardar: () => void
  alVolver: () => void
}) {
  return (
    <Dialogo abierto={borrador !== null} titulo={borrador?.titulo ?? ''} alCerrar={alVolver}>
      {borrador && (
        <>
          <Contenido borrador={borrador} />
          <p className="mt-4 text-sm text-ink-2">Registra: {nombre}</p>
          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Boton variante="secundario" onClick={alVolver} disabled={guardando}>
              Volver a editar
            </Boton>
            <Boton onClick={alGuardar} disabled={guardando} autoFocus>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Boton>
          </div>
        </>
      )}
    </Dialogo>
  )
}
