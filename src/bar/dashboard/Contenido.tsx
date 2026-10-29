import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { dinero, dineroConSigno, fechaConAnio, fechaLarga, mesLargo } from '../lib/formato'
import type { Panel } from '../lib/rpc'
import { aplicarFiltros, rangoAnterior, rangoDeFiltros, textoRango, variacion, type Filtros } from '../panel/filtros'
import { Aviso, Boton, IconoAlerta, IconoOk } from '../ui'
import { AnularDialogo } from './AnularDialogo'
import {
  flujoPorMes,
  gastosMasGrandes,
  gastosPorCategoria,
  gastosPorMes,
  mesesDelRango,
  resumenVentas,
  saldoEnRango,
  SIN_VENDEDOR,
  totales,
  ultimaFecha,
  ventasPorSemana,
  ventasPorVendedor,
  type Cierre,
  type Movimiento,
} from './calculos'
import { colorDeCategoria, type ColoresGrafico } from './colores'
import { BarrasHorizontales, GraficoFlujo, GraficoGastosPorMes, GraficoSaldo, GraficoVentasSemana, Leyenda, MarcoGrafico, TablaDatos } from './graficos'
import { Historial } from './Historial'

function Seccion({
  id,
  titulo,
  descripcion,
  antes,
  principal = false,
  children,
}: {
  id: string
  titulo: string
  descripcion?: ReactNode
  /** Línea pequeña sobre el título (p. ej. el periodo). */
  antes?: ReactNode
  /** La primera sección lleva el título grande de la página. */
  principal?: boolean
  children: ReactNode
}) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-32 lg:scroll-mt-20">
      {antes && <p className="text-sm text-muted">{antes}</p>}
      <h2
        id={`${id}-titulo`}
        className={`font-serif font-normal tracking-tight ${principal ? 'mt-1 text-[2.3rem] leading-[1.05] sm:text-5xl' : 'text-[1.85rem] leading-tight sm:text-[2.15rem]'}`}
      >
        {titulo}
      </h2>
      {descripcion && <p className="mt-1.5 max-w-2xl text-sm text-ink-2">{descripcion}</p>}
      <div className="mt-6">{children}</div>
    </section>
  )
}

function Caja({ titulo, detalle, children }: { titulo: string; detalle?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line p-4 sm:p-5">
      <h3 className="font-semibold">{titulo}</h3>
      {detalle && <p className="mt-0.5 text-sm text-ink-2">{detalle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  )
}

type TonoIndicador = 'verde' | 'azul' | 'rojo' | 'ambar' | 'neutro'

const TONOS_INDICADOR: Record<TonoIndicador, { caja: string; etiqueta: string }> = {
  verde: { caja: 'border-emerald-100 bg-emerald-50', etiqueta: 'text-emerald-800' },
  azul: { caja: 'border-sky-100 bg-sky-50', etiqueta: 'text-sky-800' },
  rojo: { caja: 'border-red-100 bg-red-50', etiqueta: 'text-red-800' },
  ambar: { caja: 'border-amber-100 bg-amber-50', etiqueta: 'text-amber-900' },
  neutro: { caja: 'border-line bg-white', etiqueta: 'text-ink-2' },
}

/** Indicador con comparación contra el periodo anterior (flecha + texto, nunca solo color). */
function Indicador({
  etiqueta,
  valor,
  delta,
  subirEsBueno,
  nota,
  tono = 'neutro',
}: {
  etiqueta: string
  valor: string
  delta: number | null
  subirEsBueno: boolean
  nota?: string
  tono?: TonoIndicador
}) {
  let pie: ReactNode = <span className="text-ink-2">{nota ?? 'Sin periodo anterior'}</span>
  if (delta !== null && Number.isFinite(delta)) {
    const sube = delta > 0
    const color = delta === 0 ? 'text-ink-2' : sube === subirEsBueno ? 'text-emerald-700' : 'text-red-700'
    const Flecha = sube ? ArrowUpRight : ArrowDownRight
    pie = (
      <span className="flex flex-wrap items-center gap-x-1">
        <span className={`inline-flex items-center font-semibold ${color}`}>
          {delta !== 0 && <Flecha className="size-3.5" aria-hidden="true" />}
          {`${sube ? '+' : ''}${Math.round(delta * 100)}%`}
        </span>
        <span className="text-ink-2">vs. periodo anterior</span>
      </span>
    )
  }
  const t = TONOS_INDICADOR[tono]
  return (
    <div className={`rounded-2xl border p-4 ${t.caja}`}>
      <p className={`text-sm font-medium ${t.etiqueta}`}>{etiqueta}</p>
      <p className="mt-1.5 text-[1.45rem] leading-tight font-semibold tracking-tight sm:text-[1.65rem]">{valor}</p>
      <div className="mt-1.5 text-xs">{pie}</div>
    </div>
  )
}

function ResultadoCierre({ c }: { c: Cierre }) {
  if (c.diferencia === 0) {
    return (
      <span className="flex items-center justify-end gap-1.5">
        <IconoOk className="size-4 text-ok" /> Cuadró
      </span>
    )
  }
  return (
    <span className="flex items-center justify-end gap-1.5">
      <IconoAlerta className="size-4 text-alerta" />
      {c.diferencia > 0 ? 'Sobró' : 'Faltó'} <span className="cifras">{dinero(Math.abs(c.diferencia))}</span>
    </span>
  )
}

/** Se carga aparte (lazy) desde el panel: los gráficos no pesan en la primera pantalla. */
export default function Contenido({
  panel,
  filtros,
  hoy,
  colores,
  netoPendiente,
  pendientes,
  puedeAnular,
  alVerTodo,
  alAnulado,
}: {
  panel: Panel
  filtros: Filtros
  hoy: string
  colores: ColoresGrafico
  /** Efecto en caja de lo registrado en este equipo que aún no se envía. */
  netoPendiente: number
  pendientes: number
  /** Solo con sesión (anular es modificar datos). */
  puedeAnular: boolean
  alVerTodo: () => void
  alAnulado: () => void
}) {
  const [aAnular, setAAnular] = useState<Movimiento | null>(null)
  const [avisoAnulado, setAvisoAnulado] = useState(false)
  const rango = useMemo(() => rangoDeFiltros(filtros, hoy), [filtros, hoy])

  const c = useMemo(() => {
    const todos = panel.movimientos
    const filtrados = aplicarFiltros(todos, filtros, rango)
    const previo = rangoAnterior(rango)
    const anteriores = previo ? aplicarFiltros(todos, filtros, previo) : null
    const meses = mesesDelRango(rango, todos)
    const categoriasGasto = panel.categorias.filter((cat) => cat.tipo === 'gasto')
    return {
      filtrados,
      categoriasGasto,
      t: totales(filtrados),
      // Sin movimientos en el periodo no se compara (evita un "−100%" que solo confunde).
      tPrevio: anteriores && filtrados.length > 0 ? totales(anteriores) : null,
      porCategoria: gastosPorCategoria(filtrados),
      porMes: gastosPorMes(filtrados, meses, categoriasGasto),
      flujo: flujoPorMes(filtrados, meses),
      // El saldo es de toda la caja: no depende de los filtros de tipo o categoría.
      saldo: saldoEnRango(todos, rango),
      semanas: ventasPorSemana(filtrados, rango),
      vendedores: ventasPorVendedor(filtrados),
      ventas: resumenVentas(filtrados),
      grandes: gastosMasGrandes(filtrados),
      transferencias: filtrados.filter((m) => m.tipo === 'transferencia' && !m.anulado).sort((a, b) => b.fecha.localeCompare(a.fecha)),
      cierres: panel.cierres.filter((ci) => (rango.desde === null || ci.fecha >= rango.desde) && ci.fecha <= rango.hasta),
      porRevisar: filtrados.filter((m) => m.revisar && !m.anulado).length,
      ultima: ultimaFecha(todos.filter((m) => !m.anulado)),
    }
  }, [panel, filtros, rango])

  const efectivo = Math.round((panel.caja.efectivo_en_caja + netoPendiente) * 100) / 100
  const fondo = panel.caja.fondo_caja
  const paraTransferir = Math.max(0, Math.round((efectivo - fondo) * 100) / 100)
  const t = c.t
  const seriesGasto = c.categoriasGasto.map((cat) => ({ llave: `c${cat.id}`, nombre: cat.nombre, color: colorDeCategoria(cat.id, c.categoriasGasto, colores) }))
  const conGastos = new Set(c.porCategoria.map((g) => g.categoria_id))
  const sinDatos = c.filtrados.length === 0
  const descuadrados = c.cierres.filter((ci) => ci.diferencia !== 0).length

  // Lo que conviene mirar para decidir, a partir de los datos filtrados.
  const consejos: ReactNode[] = []
  if (paraTransferir > 0) consejos.push(<>Conviene transferir <strong>{dinero(paraTransferir)}</strong> al banco: hay más efectivo en caja del que hace falta tener.</>)
  const mayor = c.porCategoria[0]
  if (mayor) consejos.push(<><strong>{mayor.categoria}</strong> se lleva el {Math.round(mayor.porcentaje * 100)}% de los gastos ({dinero(mayor.total)}).</>)
  if (c.tPrevio && c.tPrevio.resultado !== 0) {
    const dif = Math.round((t.resultado - c.tPrevio.resultado) * 100) / 100
    consejos.push(<>El resultado {dif >= 0 ? 'mejoró' : 'bajó'} <strong>{dinero(Math.abs(dif))}</strong> frente al periodo anterior.</>)
  }
  if (c.ventas.mejorDia) consejos.push(<>El mejor día de ventas fue el {fechaLarga(c.ventas.mejorDia.fecha)}, con <strong>{dinero(c.ventas.mejorDia.total)}</strong>.</>)
  if (descuadrados) consejos.push(<><strong>{descuadrados}</strong> {descuadrados === 1 ? 'cierre no cuadró' : 'cierres no cuadraron'}; las notas están en Banco y cierres.</>)
  if (c.porRevisar) consejos.push(<><strong>{c.porRevisar}</strong> {c.porRevisar === 1 ? 'movimiento tiene' : 'movimientos tienen'} datos por revisar.</>)

  return (
    <div className="space-y-14 sm:space-y-16">
      <Seccion id="resumen" titulo="Así va la caja" antes={textoRango(rango)} principal>
        {(avisoAnulado || (sinDatos && c.ultima)) && (
          <div className="mb-6 space-y-3">
            {avisoAnulado && <Aviso tono="ok">Movimiento anulado. Ya no cuenta para la caja ni para los gráficos.</Aviso>}
            {sinDatos && c.ultima && (
              <Aviso
                tono="info"
                accion={
                  <Boton variante="texto" onClick={alVerTodo}>
                    Ver todo el historial
                  </Boton>
                }
              >
                No hay movimientos con estos filtros. El último registro es del {fechaLarga(c.ultima)}.
              </Aviso>
            )}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-12">
          <div className="flex flex-col justify-between rounded-3xl bg-emerald-800 p-6 text-white sm:p-7 lg:col-span-5">
            <div>
              <p className="text-sm font-medium text-emerald-100">Efectivo en caja</p>
              <p className="mt-2 text-[3.4rem] leading-none font-semibold tracking-tight sm:text-6xl">{dinero(efectivo)}</p>
              {pendientes > 0 && <p className="mt-2 text-sm text-amber-200">Incluye {pendientes === 1 ? '1 registro' : `${pendientes} registros`} por enviar.</p>}
            </div>
            {paraTransferir > 0 ? (
              <div className="mt-8 rounded-2xl bg-amber-300 px-4 py-3 text-amber-950">
                <p className="text-xs font-medium text-amber-900">Recomendado transferir al banco</p>
                <p className="cifras text-2xl font-semibold">{dinero(paraTransferir)}</p>
              </div>
            ) : (
              <p className="mt-8 rounded-2xl bg-emerald-900/60 px-4 py-3 text-sm text-emerald-50">Todavía no hace falta transferir al banco.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 lg:col-span-7">
            <Indicador etiqueta="Entró" tono="azul" valor={dinero(t.ingresos)} delta={c.tPrevio ? variacion(t.ingresos, c.tPrevio.ingresos) : null} subirEsBueno />
            <Indicador etiqueta="Se gastó" tono="rojo" valor={dinero(t.gastos)} delta={c.tPrevio ? variacion(t.gastos, c.tPrevio.gastos) : null} subirEsBueno={false} />
            <Indicador
              etiqueta="Resultado"
              tono={t.resultado >= 0 ? 'verde' : 'rojo'}
              valor={dineroConSigno(t.resultado)}
              delta={c.tPrevio ? variacion(t.resultado, Math.abs(c.tPrevio.resultado)) : null}
              subirEsBueno
            />
            <Indicador etiqueta="Al banco" tono="ambar" valor={dinero(t.transferencias)} delta={null} subirEsBueno nota="Transferido en el periodo" />
          </div>
        </div>

        {consejos.length > 0 && (
          <div className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 sm:p-6">
            <h3 className="font-serif text-xl text-emerald-950">Para tener en cuenta</h3>
            <ul className="mt-3 divide-y divide-emerald-100">
              {consejos.slice(0, 5).map((texto, i) => (
                <li key={i} className="py-3 text-sm leading-relaxed text-emerald-950/80 [&_strong]:font-semibold [&_strong]:text-emerald-950">
                  {texto}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <MarcoGrafico
            titulo="Saldo de la caja"
            detalle="Efectivo al final de cada día. La línea marca desde dónde conviene transferir al banco."
            descripcionAccesible={`Saldo de la caja en el periodo; termina en ${dinero(c.saldo.at(-1)?.saldo ?? 0)}.`}
            tabla={<TablaDatos columnas={['Fecha', 'Saldo']} filas={c.saldo.map((p) => [fechaConAnio(p.fecha), dinero(p.saldo)])} />}
          >
            {c.saldo.length ? <GraficoSaldo puntos={c.saldo} fondo={fondo} colores={colores} /> : <p className="py-10 text-center text-ink-2">Todavía no hay movimientos.</p>}
          </MarcoGrafico>
          <MarcoGrafico
            titulo="Entró y se gastó, mes a mes"
            detalle="Lo transferido al banco no es gasto: está en la tabla."
            descripcionAccesible="Barras por mes con lo que entró y lo que se gastó."
            leyenda={<Leyenda elementos={[{ texto: 'Entró', color: colores.ingreso }, { texto: 'Se gastó', color: colores.gasto }]} />}
            tabla={
              <TablaDatos
                columnas={['Mes', 'Entró', 'Se gastó', 'Resultado', 'Al banco']}
                filas={c.flujo.map((f) => [mesLargo(f.mes), dinero(f.ingresos), dinero(f.gastos), dineroConSigno(f.resultado), dinero(f.transferencias)])}
              />
            }
          >
            <GraficoFlujo datos={c.flujo} colores={colores} />
          </MarcoGrafico>
        </div>
      </Seccion>

      <Seccion id="gastos" titulo="¿En qué se gastó el dinero?" descripcion={`${dinero(t.gastos)} en gastos con estos filtros. Las transferencias al banco no son gasto.`}>
        <div className="grid gap-4 lg:grid-cols-2">
          <MarcoGrafico
            titulo="Por categoría"
            detalle="Total de cada categoría y su parte de todos los gastos."
            descripcionAccesible="Gastos por categoría, de mayor a menor."
            tabla={<TablaDatos columnas={['Categoría', 'Total', 'Parte', 'Registros']} filas={c.porCategoria.map((g) => [g.categoria, dinero(g.total), `${Math.round(g.porcentaje * 100)}%`, g.cantidad])} />}
          >
            {c.porCategoria.length ? (
              <BarrasHorizontales
                filas={c.porCategoria.map((g) => ({
                  clave: g.categoria_id,
                  etiqueta: g.categoria,
                  valor: g.total,
                  color: colorDeCategoria(g.categoria_id, c.categoriasGasto, colores),
                  detalle: `${Math.round(g.porcentaje * 100)}%`,
                }))}
              />
            ) : (
              <p className="py-6 text-ink-2">No hay gastos con estos filtros.</p>
            )}
          </MarcoGrafico>
          <MarcoGrafico
            titulo="Mes a mes"
            detalle="Cada barra es un mes, dividida por categoría."
            descripcionAccesible="Gastos de cada mes divididos por categoría."
            leyenda={<Leyenda elementos={seriesGasto.filter((s) => conGastos.has(Number(s.llave.slice(1)))).map((s) => ({ texto: s.nombre, color: s.color }))} />}
            tabla={
              <TablaDatos
                columnas={['Mes', ...c.categoriasGasto.map((cat) => cat.nombre)]}
                filas={c.porMes.map((f) => [mesLargo(String(f.mes)), ...c.categoriasGasto.map((cat) => dinero(Number(f[`c${cat.id}`] ?? 0)))])}
              />
            }
          >
            <GraficoGastosPorMes datos={c.porMes} series={seriesGasto} colores={colores} />
          </MarcoGrafico>
        </div>
        <div className="mt-4">
          <Caja titulo="Los gastos más grandes" detalle="Los cinco montos más altos con estos filtros.">
            {c.grandes.length ? (
              <ol className="divide-y divide-line">
                {c.grandes.map((m, i) => (
                  <li key={m.id} className="flex items-center gap-3 py-3">
                    <span className="w-5 shrink-0 font-serif text-lg text-muted">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{m.descripcion || m.categoria}</p>
                      <p className="truncate text-sm text-ink-2">
                        {m.categoria}, {fechaLarga(m.fecha)}
                      </p>
                    </div>
                    <p className="cifras shrink-0 font-semibold text-salida">−{dinero(m.monto)}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-ink-2">No hay gastos con estos filtros.</p>
            )}
          </Caja>
        </div>
      </Seccion>

      <Seccion id="ventas" titulo="Ventas" descripcion="Solo la categoría Venta bar. Entregas y donaciones no se cuentan aquí.">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Indicador etiqueta="Total vendido" tono="azul" valor={dinero(c.ventas.total)} delta={c.tPrevio ? variacion(t.ventas, c.tPrevio.ventas) : null} subirEsBueno />
          <Indicador etiqueta="Días con venta" tono="azul" valor={String(c.ventas.dias)} delta={null} subirEsBueno nota="Con al menos una venta" />
          <Indicador etiqueta="Promedio por día" tono="azul" valor={dinero(c.ventas.promedioPorDia)} delta={null} subirEsBueno nota="Solo días con venta" />
          <Indicador
            tono="azul"
            etiqueta="Mejor día"
            valor={c.ventas.mejorDia ? dinero(c.ventas.mejorDia.total) : '—'}
            delta={null}
            subirEsBueno
            nota={c.ventas.mejorDia ? fechaLarga(c.ventas.mejorDia.fecha) : 'Sin ventas'}
          />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <MarcoGrafico
              titulo="Por semana"
              detalle="Ventas de lunes a domingo."
              descripcionAccesible="Columnas con las ventas de cada semana."
              tabla={<TablaDatos columnas={['Semana del', 'Ventas']} filas={c.semanas.map((s) => [fechaConAnio(s.semana), dinero(s.total)])} />}
            >
              {c.semanas.length ? <GraficoVentasSemana datos={c.semanas} colores={colores} /> : <p className="py-10 text-center text-ink-2">No hay ventas con estos filtros.</p>}
            </MarcoGrafico>
          </div>
          <div className="lg:col-span-5">
            <MarcoGrafico
              titulo="Por quién vendió"
              detalle={c.vendedores.some((v) => v.vendedor === SIN_VENDEDOR) ? 'Las ventas del cuaderno no anotaban quién vendió.' : undefined}
              descripcionAccesible="Ventas por persona, de mayor a menor."
              tabla={<TablaDatos columnas={['Persona', 'Total', 'Ventas']} filas={c.vendedores.map((v) => [v.vendedor, dinero(v.total), v.ventas])} />}
            >
              {c.vendedores.length ? (
                <BarrasHorizontales
                  filas={c.vendedores.map((v) => ({ clave: v.vendedor, etiqueta: v.vendedor, valor: v.total, color: colores.ingreso, detalle: v.ventas === 1 ? '1 venta' : `${v.ventas} ventas` }))}
                />
              ) : (
                <p className="py-6 text-ink-2">No hay ventas con estos filtros.</p>
              )}
            </MarcoGrafico>
          </div>
        </div>
      </Seccion>

      <Seccion id="banco" titulo="Banco y cierres de caja" descripcion="El efectivo que pasó a la cuenta del bar y cómo cuadró la caja al final de cada día.">
        <div className="grid gap-4 lg:grid-cols-2">
          <Caja
            titulo="Transferencias al banco"
            detalle={c.transferencias.length ? `${c.transferencias.length === 1 ? '1 transferencia' : `${c.transferencias.length} transferencias`} por ${dinero(t.transferencias)}.` : undefined}
          >
            {c.transferencias.length ? (
              <ul className="divide-y divide-line">
                {c.transferencias.map((m) => (
                  <li key={m.id} className="flex items-baseline justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">{fechaLarga(m.fecha)}</p>
                      {m.descripcion && <p className="text-sm text-ink-2">{m.descripcion}</p>}
                    </div>
                    <p className="cifras shrink-0 font-semibold">{dinero(m.monto)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-2">No hubo transferencias al banco con estos filtros.</p>
            )}
          </Caja>
          <Caja titulo="Cierres de caja" detalle={c.cierres.length ? `Cuadró ${c.cierres.length - descuadrados} de ${c.cierres.length}.` : undefined}>
            {c.cierres.length ? (
              <ul className="divide-y divide-line">
                {c.cierres.map((ci) => (
                  <li key={ci.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{fechaLarga(ci.fecha)}</p>
                      <p className="text-ink-2">
                        Contado {dinero(ci.contado)}, esperado {dinero(ci.esperado)}
                      </p>
                      {ci.nota && <p className="text-ink-2">{ci.nota}</p>}
                      <p className="text-xs text-muted">{ci.registrado_por}</p>
                    </div>
                    <div className="shrink-0 font-semibold">
                      <ResultadoCierre c={ci} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-2">No hay cierres en este periodo. Se registran con "Registrar", pestaña Cierre, al final de cada día.</p>
            )}
          </Caja>
        </div>
      </Seccion>

      <Seccion id="historial" titulo="Historial" descripcion="Todos los movimientos con estos filtros. Para corregir un error, se anula el movimiento y se registra de nuevo.">
        <Historial movimientos={c.filtrados} puedeAnular={puedeAnular} alAnular={setAAnular} />
      </Seccion>

      <AnularDialogo
        movimiento={aAnular}
        alCerrar={() => setAAnular(null)}
        alAnular={() => {
          setAAnular(null)
          setAvisoAnulado(true)
          alAnulado()
        }}
      />
    </div>
  )
}
