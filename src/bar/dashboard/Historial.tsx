import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { dinero, fechaConAnio } from '../lib/formato'
import { Boton, IconoAlerta, claseEntrada } from '../ui'
import type { Movimiento } from './calculos'

const POR_PAGINA = 40

function coincide(m: Movimiento, texto: string): boolean {
  if (!texto) return true
  const t = texto.toLocaleLowerCase('es')
  return [m.categoria, m.descripcion, m.vendedor, m.registrado_por, m.nota_revision, String(m.monto)]
    .filter(Boolean)
    .some((campo) => String(campo).toLocaleLowerCase('es').includes(t))
}

const detalleDe = (m: Movimiento) => [m.vendedor && `Vendió ${m.vendedor}`, m.descripcion].filter(Boolean).join('. ')

function Monto({ m }: { m: Movimiento }) {
  const salida = m.tipo !== 'ingreso'
  return (
    <span className={`cifras font-semibold whitespace-nowrap ${m.anulado ? 'text-muted line-through' : salida ? 'text-salida' : 'text-emerald-700'}`}>
      {salida ? '−' : '+'}
      {dinero(m.monto)}
    </span>
  )
}

function Notas({ m }: { m: Movimiento }) {
  return (
    <>
      {m.anulado && (
        <p className="mt-1 text-sm text-ink-2">
          <span className="font-semibold text-ink">Anulado</span>
          {m.anulado_por && ` por ${m.anulado_por}`}
          {m.motivo_anulacion && `: ${m.motivo_anulacion}`}
        </p>
      )}
      {m.revisar && (
        <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-2">
          <IconoAlerta className="mt-0.5 size-4 text-alerta" />
          <span>
            <span className="font-semibold text-ink">Por revisar.</span> {m.nota_revision}
          </span>
        </p>
      )}
    </>
  )
}

/** Movimientos (ya filtrados por los filtros del panel), con búsqueda. Lista en el celular, tabla en pantallas grandes. */
export function Historial({ movimientos, puedeAnular, alAnular }: { movimientos: Movimiento[]; puedeAnular: boolean; alAnular: (m: Movimiento) => void }) {
  const [texto, setTexto] = useState('')
  const [limite, setLimite] = useState(POR_PAGINA)

  const filtrados = useMemo(
    () => movimientos.filter((m) => coincide(m, texto.trim())).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id),
    [movimientos, texto],
  )
  const visibles = filtrados.slice(0, limite)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block min-w-0 flex-1 basis-64">
          <span className="sr-only">Buscar en el historial</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar categoría, detalle, persona o monto" className={`${claseEntrada} !py-2.5 pl-10 text-sm`} />
        </label>
        <p className="text-sm text-muted" role="status">
          {filtrados.length === 1 ? '1 movimiento' : `${filtrados.length} movimientos`}
        </p>
      </div>

      {/* Celular: lista */}
      <ul className="mt-4 divide-y divide-line border-y border-line sm:hidden">
        {visibles.map((m) => (
          <li key={m.id} className="flex items-start gap-3 py-3.5">
            <div className="min-w-0 flex-1">
              <p className={`font-medium ${m.anulado ? 'text-muted line-through' : ''}`}>{m.categoria}</p>
              {detalleDe(m) && <p className="text-sm text-ink-2">{detalleDe(m)}</p>}
              <p className="mt-0.5 text-xs text-muted">
                {fechaConAnio(m.fecha)}, registró {m.registrado_por}
              </p>
              <Notas m={m} />
              {puedeAnular && !m.anulado && (
                <Boton variante="texto" className="mt-1 text-sm" onClick={() => alAnular(m)}>
                  Anular
                </Boton>
              )}
            </div>
            <Monto m={m} />
          </li>
        ))}
        {filtrados.length === 0 && <li className="py-10 text-center text-ink-2">No hay movimientos con estos filtros.</li>}
      </ul>

      {/* Pantallas grandes: tabla (relative contiene el texto sr-only para que no ensanche la página) */}
      <div className="relative mt-4 hidden overflow-x-auto rounded-2xl border border-line sm:block">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="border-b border-line bg-suave text-left text-ink-2">
              <th scope="col" className="px-4 py-2.5 font-medium">Fecha</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Categoría y detalle</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Registró</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Monto</th>
              {puedeAnular && (
                <th scope="col" className="px-4 py-2.5">
                  <span className="sr-only">Acciones</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visibles.map((m) => (
              <tr key={m.id} className="border-b border-line align-top last:border-b-0">
                <td className="cifras px-4 py-3 whitespace-nowrap text-ink-2">{fechaConAnio(m.fecha)}</td>
                <td className="px-4 py-3">
                  <p className={`font-medium ${m.anulado ? 'text-muted line-through' : ''}`}>{m.categoria}</p>
                  {detalleDe(m) && <p className="text-ink-2">{detalleDe(m)}</p>}
                  <Notas m={m} />
                </td>
                <td className="px-4 py-3 text-ink-2">{m.registrado_por}</td>
                <td className="px-4 py-3 text-right">
                  <Monto m={m} />
                </td>
                {puedeAnular && (
                  <td className="px-4 py-3 text-right">
                    {!m.anulado && (
                      <Boton variante="texto" className="text-sm" onClick={() => alAnular(m)}>
                        Anular
                      </Boton>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-2">
                  No hay movimientos con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtrados.length > limite && (
        <Boton variante="secundario" className="mt-4 w-full sm:w-auto" onClick={() => setLimite((l) => l + POR_PAGINA)}>
          Mostrar {Math.min(POR_PAGINA, filtrados.length - limite)} más
        </Boton>
      )}
    </div>
  )
}
