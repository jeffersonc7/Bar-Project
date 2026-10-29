import type { ReactNode } from 'react'
import type { CategoriaBasica } from '../dashboard/calculos'
import { colorDeCategoria, type ColoresGrafico } from '../dashboard/colores'
import type { TipoCategoria } from '../lib/rpc'
import { claseEntrada } from '../ui'
import { TODOS_LOS_TIPOS, type Filtros, type PeriodoFiltro } from './filtros'

export const PERIODOS: { valor: PeriodoFiltro; texto: string }[] = [
  { valor: '3m', texto: '3 meses' },
  { valor: '6m', texto: '6 meses' },
  { valor: '12m', texto: '12 meses' },
  { valor: 'todo', texto: 'Todo' },
  { valor: 'personalizado', texto: 'Fechas' },
]

const TIPOS: { valor: TipoCategoria; texto: string; color: (c: ColoresGrafico) => string }[] = [
  { valor: 'ingreso', texto: 'Ingresos', color: (c) => c.ingreso },
  { valor: 'gasto', texto: 'Gastos', color: (c) => c.gasto },
  { valor: 'transferencia', texto: 'Transferencias al banco', color: () => '#a8a29e' },
]

const alternar = <T,>(lista: T[], valor: T) => (lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor])

/** Chips de periodo (fila superior en el celular y primer grupo de los filtros). */
export function ChipsPeriodo({ filtros, alCambiar, conFechas = false }: { filtros: Filtros; alCambiar: (f: Filtros) => void; conFechas?: boolean }) {
  return (
    <div role="radiogroup" aria-label="Periodo" className={`flex gap-1.5 ${conFechas ? 'flex-wrap' : 'shrink-0'}`}>
      {PERIODOS.filter((p) => conFechas || p.valor !== 'personalizado').map((p) => {
        const elegido = filtros.periodo === p.valor
        return (
          <label
            key={p.valor}
            className={`inline-flex min-h-9 shrink-0 items-center rounded-full px-3.5 text-sm whitespace-nowrap transition-colors duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink ${
              elegido ? 'bg-accion font-medium text-on-accion' : 'bg-suave text-ink hover:bg-emerald-50'
            }`}
          >
            <input type="radio" name={`periodo-${conFechas ? 'completo' : 'corto'}`} className="sr-only" checked={elegido} onChange={() => alCambiar({ ...filtros, periodo: p.valor })} />
            {p.texto}
          </label>
        )
      })}
    </div>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-2.5">
      <legend className="mb-3 text-sm font-medium text-ink">{titulo}</legend>
      {children}
    </fieldset>
  )
}

function Interruptor({ etiqueta, detalle, activo, alCambiar }: { etiqueta: string; detalle?: string; activo: boolean; alCambiar: (v: boolean) => void }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 text-sm">
      <span>
        {etiqueta}
        {detalle && <span className="ml-1.5 text-muted">{detalle}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        aria-label={etiqueta}
        onClick={() => alCambiar(!activo)}
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200 ${activo ? 'bg-emerald-600' : 'bg-stone-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform duration-200 ${activo ? 'translate-x-4' : ''}`} />
      </button>
    </div>
  )
}

/** Todos los filtros: en la barra lateral (escritorio) y en la hoja "Filtros" (celular). */
export function PanelFiltros({
  filtros,
  alCambiar,
  categorias,
  personas,
  porRevisar,
  colores,
  hoy,
}: {
  filtros: Filtros
  alCambiar: (f: Filtros) => void
  categorias: CategoriaBasica[]
  personas: string[]
  porRevisar: number
  colores: ColoresGrafico
  hoy: string
}) {
  const cambiar = (parcial: Partial<Filtros>) => alCambiar({ ...filtros, ...parcial })
  const categoriasGasto = categorias.filter((c) => c.tipo === 'gasto')
  const visibles = categorias.filter((c) => filtros.tipos.includes(c.tipo))

  return (
    <div className="space-y-8">
      <Grupo titulo="Periodo">
        <ChipsPeriodo filtros={filtros} alCambiar={alCambiar} conFechas />
        {filtros.periodo === 'personalizado' && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <label className="text-xs text-ink-2">
              Desde
              <input type="date" max={hoy} value={filtros.desde} onChange={(e) => cambiar({ desde: e.target.value })} className={`${claseEntrada} mt-1 !py-2 text-sm`} />
            </label>
            <label className="text-xs text-ink-2">
              Hasta
              <input type="date" max={hoy} value={filtros.hasta} onChange={(e) => cambiar({ hasta: e.target.value })} className={`${claseEntrada} mt-1 !py-2 text-sm`} />
            </label>
          </div>
        )}
      </Grupo>

      <Grupo titulo="Tipo de movimiento">
        {TIPOS.map((t) => (
          <label key={t.valor} className="flex min-h-9 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={filtros.tipos.includes(t.valor)}
              onChange={() => {
                const tipos = alternar(filtros.tipos, t.valor)
                cambiar({ tipos: tipos.length ? tipos : [...TODOS_LOS_TIPOS] })
              }}
              className="size-4 accent-emerald-700"
            />
            <span className="size-2.5 rounded-full" style={{ background: t.color(colores) }} aria-hidden="true" />
            {t.texto}
          </label>
        ))}
      </Grupo>

      <Grupo titulo="Categorías">
        <div className="space-y-1">
          {visibles.map((c) => (
            <label key={c.id} className="flex min-h-9 min-w-0 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={filtros.categorias.length === 0 || filtros.categorias.includes(c.id)}
                onChange={() => {
                  const base = filtros.categorias.length ? filtros.categorias : visibles.map((v) => v.id)
                  const siguiente = alternar(base, c.id)
                  cambiar({ categorias: siguiente.length === visibles.length || siguiente.length === 0 ? [] : siguiente })
                }}
                className="size-4 shrink-0 accent-emerald-700"
              />
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: c.tipo === 'gasto' ? colorDeCategoria(c.id, categoriasGasto, colores) : c.tipo === 'ingreso' ? colores.ingreso : '#a8a29e' }}
                aria-hidden="true"
              />
              <span className="truncate" title={c.nombre}>
                {c.nombre}
              </span>
            </label>
          ))}
        </div>
      </Grupo>

      <Grupo titulo="Persona">
        <select aria-label="Persona" value={filtros.persona} onChange={(e) => cambiar({ persona: e.target.value })} className={`${claseEntrada} !py-2.5 text-sm`}>
          <option value="">Todas</option>
          {personas.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Grupo>

      <div className="space-y-1 border-t border-line pt-5">
        <Interruptor etiqueta="Solo por revisar" detalle={porRevisar ? `(${porRevisar})` : undefined} activo={filtros.soloRevisar} alCambiar={(v) => cambiar({ soloRevisar: v })} />
        <Interruptor etiqueta="Ver anulados" activo={filtros.verAnulados} alCambiar={(v) => cambiar({ verAnulados: v })} />
      </div>
    </div>
  )
}
