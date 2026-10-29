import type { ReactNode } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { dinero, dineroEje, fechaConAnio, fechaCorta, mesCorto, mesLargo } from '../lib/formato'
import type { FilaMensual, FlujoMensual, PuntoSaldo, VentaSemanal } from './calculos'
import type { ColoresGrafico } from './colores'

/* ---------- Piezas comunes ---------- */

interface ItemTooltip {
  name?: string | number
  value?: unknown
  color?: string
}

function ContenidoTooltip({
  active,
  payload,
  label,
  titulo,
  ocultarCeros = false,
}: {
  active?: boolean
  payload?: readonly ItemTooltip[]
  label?: unknown
  titulo: (label: unknown) => string
  ocultarCeros?: boolean
}) {
  if (!active || !payload?.length) return null
  const filas = payload.filter((p) => typeof p.value === 'number' && (!ocultarCeros || p.value !== 0))
  return (
    <div className="min-w-44 rounded-xl border border-line bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-ink">{titulo(label)}</p>
      <ul className="mt-1 space-y-0.5">
        {filas.map((p) => (
          <li key={String(p.name)} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: p.color }} aria-hidden="true" />
            <span className="text-ink-2">{p.name}</span>
            <span className="cifras ml-auto pl-3 font-semibold text-ink">{dinero(p.value as number)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const ejeTexto = (c: ColoresGrafico) => ({ fill: c.texto, fontSize: 12 })
const isoDe = (t: number) => new Date(t).toISOString().slice(0, 10)

/** Eje vertical con números redondos (pasos de 1, 2, 2.5 o 5 × 10ⁿ) desde 0. */
export function escalaLimpia(maximo: number, intervalos = 4): { tope: number; marcas: number[] } {
  if (!(maximo > 0)) return { tope: 10, marcas: [0, 5, 10] }
  const bruto = maximo / intervalos
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  const paso = [1, 2, 2.5, 5, 10].map((f) => f * potencia).find((p) => p >= bruto) ?? 10 * potencia
  const tope = Math.ceil(maximo / paso - 1e-9) * paso
  const marcas = Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => Math.round(i * paso * 100) / 100)
  return { tope, marcas }
}

export function Leyenda({ elementos }: { elementos: { texto: string; color: string }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-2">
      {elementos.map((e) => (
        <li key={e.texto} className="flex items-center gap-1.5">
          <span className="size-2.5 shrink-0 rounded-sm" style={{ background: e.color }} aria-hidden="true" />
          {e.texto}
        </li>
      ))}
    </ul>
  )
}

/** Tabla equivalente de cada gráfico (accesibilidad y lectura exacta). */
export function TablaDatos({ columnas, filas }: { columnas: string[]; filas: (string | number)[][] }) {
  return (
    <table className="cifras w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-ink-2">
          {columnas.map((c, i) => (
            <th key={c} scope="col" className={`py-1.5 pr-3 font-semibold ${i > 0 ? 'text-right' : ''}`}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((f, i) => (
          <tr key={i} className="border-b border-grid last:border-b-0">
            {f.map((celda, j) => (
              <td key={j} className={`py-1.5 pr-3 ${j > 0 ? 'text-right' : ''}`}>
                {celda}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function MarcoGrafico({
  titulo,
  detalle,
  leyenda,
  tabla,
  descripcionAccesible,
  children,
}: {
  titulo: string
  detalle?: ReactNode
  leyenda?: ReactNode
  tabla?: ReactNode
  descripcionAccesible: string
  children: ReactNode
}) {
  return (
    <figure className="min-w-0 rounded-2xl border border-line p-4 sm:p-5">
      <figcaption>
        <h3 className="font-semibold">{titulo}</h3>
        {detalle && <p className="mt-0.5 text-sm text-ink-2">{detalle}</p>}
      </figcaption>
      {leyenda}
      <div className="mt-3" role="img" aria-label={descripcionAccesible}>
        {children}
      </div>
      {tabla && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-medium text-ink-2 underline decoration-stone-300 underline-offset-4 hover:text-ink">Ver los datos en tabla</summary>
          <div className="relative mt-2 overflow-x-auto">{tabla}</div>
        </details>
      )}
    </figure>
  )
}

/* ---------- Saldo de caja en el tiempo ---------- */

export function GraficoSaldo({ puntos, fondo, colores }: { puntos: PuntoSaldo[]; fondo: number | null; colores: ColoresGrafico }) {
  const datos = puntos.map((p) => ({ t: Date.parse(`${p.fecha}T00:00:00Z`), saldo: p.saldo }))
  const escala = escalaLimpia(Math.max(fondo ?? 0, ...puntos.map((p) => p.saldo)))
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={datos} margin={{ top: 16, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={colores.grid} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(t: number) => fechaCorta(isoDe(t))}
          tick={ejeTexto(colores)}
          stroke={colores.eje}
          tickLine={false}
          minTickGap={32}
        />
        <YAxis
          domain={[0, escala.tope]}
          ticks={escala.marcas}
          tickFormatter={dineroEje}
          tick={ejeTexto(colores)}
          stroke={colores.eje}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip
          cursor={{ stroke: colores.eje }}
          content={(p) => <ContenidoTooltip {...p} titulo={(t) => fechaConAnio(isoDe(Number(t)))} />}
        />
        {fondo !== null && <ReferenceLine y={fondo} stroke={colores.texto} strokeWidth={1} />}
        <Area
          type="stepAfter"
          dataKey="saldo"
          name="Saldo en caja"
          stroke={colores.ingreso}
          strokeWidth={2}
          fill={colores.ingreso}
          fillOpacity={0.1}
          dot={false}
          activeDot={{ r: 5, stroke: colores.superficie, strokeWidth: 2, fill: colores.ingreso }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ---------- Entradas y gastos por mes ---------- */

export function GraficoFlujo({ datos, colores }: { datos: FlujoMensual[]; colores: ColoresGrafico }) {
  const escala = escalaLimpia(Math.max(0, ...datos.flatMap((d) => [d.ingresos, d.gastos])))
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={datos} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke={colores.grid} />
        <XAxis dataKey="mes" tickFormatter={mesCorto} tick={ejeTexto(colores)} stroke={colores.eje} tickLine={false} />
        <YAxis
          domain={[0, escala.tope]}
          ticks={escala.marcas}
          tickFormatter={dineroEje}
          tick={ejeTexto(colores)}
          stroke={colores.eje}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip cursor={{ fill: colores.cursor }} content={(p) => <ContenidoTooltip {...p} titulo={(l) => mesLargo(String(l))} />} />
        <Bar dataKey="ingresos" name="Entró" fill={colores.ingreso} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        <Bar dataKey="gastos" name="Se gastó" fill={colores.gasto} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ---------- Gastos por mes y categoría (apilado) ---------- */

export function GraficoGastosPorMes({
  datos,
  series,
  colores,
}: {
  datos: FilaMensual[]
  series: { llave: string; nombre: string; color: string }[]
  colores: ColoresGrafico
}) {
  const escala = escalaLimpia(Math.max(0, ...datos.map((fila) => series.reduce((s, serie) => s + Number(fila[serie.llave] ?? 0), 0))))
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={datos} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke={colores.grid} />
        <XAxis dataKey="mes" tickFormatter={mesCorto} tick={ejeTexto(colores)} stroke={colores.eje} tickLine={false} />
        <YAxis
          domain={[0, escala.tope]}
          ticks={escala.marcas}
          tickFormatter={dineroEje}
          tick={ejeTexto(colores)}
          stroke={colores.eje}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip
          cursor={{ fill: colores.cursor }}
          content={(p) => <ContenidoTooltip {...p} titulo={(l) => mesLargo(String(l))} ocultarCeros />}
        />
        {series.map((s) => (
          <Bar
            key={s.llave}
            dataKey={s.llave}
            name={s.nombre}
            stackId="gastos"
            fill={s.color}
            stroke={colores.superficie}
            strokeWidth={2}
            maxBarSize={24}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ---------- Ventas por semana ---------- */

export function GraficoVentasSemana({ datos, colores }: { datos: VentaSemanal[]; colores: ColoresGrafico }) {
  const escala = escalaLimpia(Math.max(0, ...datos.map((d) => d.total)))
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={datos} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke={colores.grid} />
        <XAxis dataKey="semana" tickFormatter={fechaCorta} tick={ejeTexto(colores)} stroke={colores.eje} tickLine={false} minTickGap={24} />
        <YAxis
          domain={[0, escala.tope]}
          ticks={escala.marcas}
          tickFormatter={dineroEje}
          tick={ejeTexto(colores)}
          stroke={colores.eje}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip
          cursor={{ fill: colores.cursor }}
          content={(p) => <ContenidoTooltip {...p} titulo={(l) => `Semana del ${fechaConAnio(String(l))}`} />}
        />
        <Bar dataKey="total" name="Ventas" fill={colores.ingreso} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ---------- Barras horizontales en HTML (ranking con valor visible) ---------- */

export function BarrasHorizontales({
  filas,
}: {
  filas: { clave: string | number; etiqueta: string; valor: number; color: string; detalle?: string }[]
}) {
  const maximo = Math.max(0, ...filas.map((f) => f.valor))
  return (
    <ul className="space-y-3.5">
      {filas.map((f) => (
        <li key={f.clave}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-ink">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: f.color }} aria-hidden="true" />
              <span className="truncate">{f.etiqueta}</span>
            </span>
            <span className="cifras shrink-0 font-semibold text-ink">
              {dinero(f.valor)}
              {f.detalle && <span className="ml-2 font-normal text-muted">{f.detalle}</span>}
            </span>
          </div>
          <div
            className="mt-1.5 h-2.5 rounded-r-[4px]"
            style={{ width: `${maximo ? Math.max(1.5, (f.valor / maximo) * 100) : 0}%`, background: f.color }}
            aria-hidden="true"
          />
        </li>
      ))}
    </ul>
  )
}
