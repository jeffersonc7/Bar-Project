import { useState, type FormEvent } from 'react'
import { CATEGORIA_VENTA, PERSONAS } from '../lib/config'
import { dinero, fechaLarga, redondear } from '../lib/formato'
import { nuevoId } from '../lib/ids'
import type { Categoria } from '../lib/rpc'
import { leerMonto, validarFecha, validarNombre, validarTexto } from '../lib/validaciones'
import type { MovimientoLocal } from '../offline/baseLocal'
import { Aviso, Boton, Campo, EntradaMonto, IconoAlerta, IconoOk, Opciones, claseEntrada } from '../ui'
import type { Borrador } from './tipos'

type Errores = Record<string, string | null | undefined>
const hayErrores = (e: Errores) => Object.values(e).some(Boolean)

export interface PropsFormulario {
  fecha: string
  alCambiarFecha: (fecha: string) => void
  hoy: string
  categorias: Categoria[]
  alRevisar: (b: Borrador) => void
}

const OTRO = 'otro'
const OPCIONES_VENDEDOR = [...PERSONAS.map((p) => ({ valor: p as string, texto: p as string })), { valor: OTRO, texto: 'Otra persona' }]
const esPersonaConocida = (nombre: string) => (PERSONAS as readonly string[]).includes(nombre)

function CampoFecha({ fecha, alCambiar, hoy, error }: { fecha: string; alCambiar: (f: string) => void; hoy: string; error?: string | null }) {
  const ayuda = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? `${fechaLarga(fecha)}${fecha === hoy ? ' (hoy)' : ''}` : undefined
  return (
    <Campo etiqueta="Fecha" htmlFor="fecha" error={error} ayuda={ayuda}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <input
          id="fecha"
          type="date"
          max={hoy}
          value={fecha}
          onChange={(e) => alCambiar(e.target.value)}
          aria-invalid={Boolean(error) || undefined}
          className={`${claseEntrada} max-w-52`}
        />
        {fecha !== hoy && (
          <Boton variante="texto" onClick={() => alCambiar(hoy)}>
            Volver a hoy
          </Boton>
        )}
      </div>
    </Campo>
  )
}

function SinCategorias() {
  return <Aviso tono="info">Faltan las categorías. Conéctate a internet un momento para descargarlas.</Aviso>
}

function ErrorDeGrupo({ texto }: { texto?: string | null }) {
  if (!texto) return null
  return (
    <p className="flex items-start gap-1.5 text-sm text-salida" role="alert">
      <IconoAlerta className="mt-0.5 size-4" />
      {texto}
    </p>
  )
}

/* ---------------- Venta ---------------- */

export function FormVenta({ nombre, ...p }: PropsFormulario & { nombre: string }) {
  const categoria = p.categorias.find((c) => c.nombre === CATEGORIA_VENTA) ?? p.categorias.find((c) => c.requiere_vendedor)
  const [vendedor, setVendedor] = useState<string>(esPersonaConocida(nombre) ? nombre : OTRO)
  const [otroVendedor, setOtroVendedor] = useState(esPersonaConocida(nombre) ? '' : nombre)
  const [monto, setMonto] = useState('')
  const [nota, setNota] = useState('')
  const [errores, setErrores] = useState<Errores>({})

  if (!categoria) return <SinCategorias />

  function revisar(e: FormEvent) {
    e.preventDefault()
    if (!categoria) return
    const m = leerMonto(monto)
    const quien = vendedor === OTRO ? otroVendedor.trim() : vendedor
    const nuevos: Errores = {
      fecha: validarFecha(p.fecha, p.hoy),
      monto: m.ok ? null : m.error,
      vendedor: validarNombre(quien),
      nota: validarTexto(nota, false, ''),
    }
    setErrores(nuevos)
    if (hayErrores(nuevos) || !m.ok) return
    p.alRevisar({
      clase: 'movimientos',
      titulo: '¿Guardar esta venta?',
      movimientos: [
        {
          id_cliente: nuevoId(),
          fecha: p.fecha,
          categoria_id: categoria.id,
          monto: m.valor,
          descripcion: nota.trim() || null,
          vendedor: quien,
          categoria: categoria.nombre,
          tipo: categoria.tipo,
        },
      ],
    })
  }

  return (
    <form onSubmit={revisar} noValidate className="space-y-5">
      <CampoFecha fecha={p.fecha} alCambiar={p.alCambiarFecha} hoy={p.hoy} error={errores.fecha} />
      <Campo etiqueta="Monto vendido" htmlFor="monto" error={errores.monto}>
        <EntradaMonto id="monto" valor={monto} alCambiar={setMonto} invalido={Boolean(errores.monto)} />
      </Campo>
      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-sm font-semibold text-ink-2">¿Quién vendió?</legend>
        <Opciones nombre="vendedor" etiqueta="¿Quién vendió?" opciones={OPCIONES_VENDEDOR} valor={vendedor} alCambiar={setVendedor} />
        {vendedor === OTRO && (
          <input
            aria-label="Nombre de quien vendió"
            placeholder="Nombre de quien vendió"
            value={otroVendedor}
            onChange={(e) => setOtroVendedor(e.target.value)}
            className={`${claseEntrada} mt-2`}
          />
        )}
        <ErrorDeGrupo texto={errores.vendedor} />
      </fieldset>
      <Campo etiqueta="Nota (opcional)" htmlFor="nota" error={errores.nota}>
        <input id="nota" placeholder="Ej.: ventas en la tarde" value={nota} onChange={(e) => setNota(e.target.value)} className={claseEntrada} />
      </Campo>
      <Boton type="submit" className="w-full">
        Revisar y guardar
      </Boton>
    </form>
  )
}

/* ---------------- Gastos (uno o varios) ---------------- */

interface FilaGasto {
  llave: string
  categoriaId: string
  monto: string
  descripcion: string
}

const filaVacia = (): FilaGasto => ({ llave: nuevoId(), categoriaId: '', monto: '', descripcion: '' })

function textosDescripcion(c?: Categoria) {
  if (c?.nombre === 'Pagos a personas') return { etiqueta: '¿A quién se le pagó?', placeholder: 'Nombre de la persona' }
  if (c?.requiere_descripcion) return { etiqueta: '¿Qué fue?', placeholder: 'Describe el gasto' }
  return { etiqueta: 'Descripción (opcional)', placeholder: 'Ej.: colas, pan, factura 123' }
}

export function FormGastos(p: PropsFormulario) {
  const gastos = p.categorias.filter((c) => c.tipo === 'gasto')
  const [filas, setFilas] = useState<FilaGasto[]>(() => [filaVacia()])
  const [errores, setErrores] = useState<Record<string, Errores>>({})
  const [errorFecha, setErrorFecha] = useState<string | null>(null)

  if (!gastos.length) return <SinCategorias />

  const cambiar = (llave: string, cambio: Partial<FilaGasto>) =>
    setFilas((fs) => fs.map((f) => (f.llave === llave ? { ...f, ...cambio } : f)))

  const total = redondear(
    filas.reduce((suma, f) => {
      const m = leerMonto(f.monto)
      return m.ok ? suma + m.valor : suma
    }, 0),
  )

  function revisar(e: FormEvent) {
    e.preventDefault()
    const errFecha = validarFecha(p.fecha, p.hoy)
    const nuevos: Record<string, Errores> = {}
    const movimientos: MovimientoLocal[] = []

    for (const f of filas) {
      const cat = gastos.find((c) => String(c.id) === f.categoriaId)
      const m = leerMonto(f.monto)
      const err: Errores = {
        categoria: cat ? null : 'Elige la categoría.',
        monto: m.ok ? null : m.error,
        descripcion: validarTexto(f.descripcion, cat?.requiere_descripcion ?? false, 'Esta categoría necesita una descripción.'),
      }
      nuevos[f.llave] = err
      if (cat && m.ok && !hayErrores(err)) {
        movimientos.push({
          id_cliente: nuevoId(),
          fecha: p.fecha,
          categoria_id: cat.id,
          monto: m.valor,
          descripcion: f.descripcion.trim() || null,
          vendedor: null,
          categoria: cat.nombre,
          tipo: cat.tipo,
        })
      }
    }

    setErrores(nuevos)
    setErrorFecha(errFecha)
    if (errFecha || movimientos.length !== filas.length) return
    p.alRevisar({
      clase: 'movimientos',
      titulo: filas.length === 1 ? '¿Guardar este gasto?' : `¿Guardar estos ${filas.length} gastos?`,
      movimientos,
    })
  }

  return (
    <form onSubmit={revisar} noValidate className="space-y-5">
      <CampoFecha fecha={p.fecha} alCambiar={p.alCambiarFecha} hoy={p.hoy} error={errorFecha} />

      {filas.map((f, i) => {
        const cat = gastos.find((c) => String(c.id) === f.categoriaId)
        const err = errores[f.llave] ?? {}
        const textos = textosDescripcion(cat)
        return (
          <fieldset key={f.llave} className="space-y-4 rounded-xl border border-line p-4">
            <legend className="sr-only">{`Gasto ${i + 1}`}</legend>
            {filas.length > 1 && (
              <div className="flex items-center justify-between">
                <p className="font-semibold">{`Gasto ${i + 1}`}</p>
                <Boton variante="texto" onClick={() => setFilas((fs) => fs.filter((x) => x.llave !== f.llave))}>
                  Quitar
                </Boton>
              </div>
            )}
            <Campo etiqueta="Categoría" htmlFor={`cat-${f.llave}`} error={err.categoria}>
              <select
                id={`cat-${f.llave}`}
                value={f.categoriaId}
                onChange={(e) => cambiar(f.llave, { categoriaId: e.target.value })}
                aria-invalid={Boolean(err.categoria) || undefined}
                className={claseEntrada}
              >
                <option value="" disabled>
                  Elige una categoría
                </option>
                {gastos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Monto" htmlFor={`monto-${f.llave}`} error={err.monto}>
              <EntradaMonto
                id={`monto-${f.llave}`}
                valor={f.monto}
                alCambiar={(v) => cambiar(f.llave, { monto: v })}
                invalido={Boolean(err.monto)}
              />
            </Campo>
            <Campo etiqueta={textos.etiqueta} htmlFor={`desc-${f.llave}`} error={err.descripcion}>
              <input
                id={`desc-${f.llave}`}
                placeholder={textos.placeholder}
                value={f.descripcion}
                onChange={(e) => cambiar(f.llave, { descripcion: e.target.value })}
                aria-invalid={Boolean(err.descripcion) || undefined}
                className={claseEntrada}
              />
            </Campo>
          </fieldset>
        )
      })}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Boton variante="secundario" onClick={() => setFilas((fs) => [...fs, filaVacia()])}>
          Agregar otro gasto
        </Boton>
        {filas.length > 1 && (
          <p className="text-ink-2">
            Total <span className="cifras ml-1 font-semibold text-ink">{dinero(total)}</span>
          </p>
        )}
      </div>
      <Boton type="submit" className="w-full">
        Revisar y guardar
      </Boton>
    </form>
  )
}

/* ---------------- Otro ingreso ---------------- */

export function FormOtroIngreso(p: PropsFormulario) {
  const opciones = p.categorias.filter((c) => c.tipo === 'ingreso' && !c.requiere_vendedor)
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  const [monto, setMonto] = useState('')
  const [detalle, setDetalle] = useState('')
  const [errores, setErrores] = useState<Errores>({})

  if (!opciones.length) return <SinCategorias />

  function revisar(e: FormEvent) {
    e.preventDefault()
    const cat = opciones.find((c) => String(c.id) === categoriaId)
    const m = leerMonto(monto)
    const nuevos: Errores = {
      fecha: validarFecha(p.fecha, p.hoy),
      categoria: cat ? null : 'Elige el tipo de ingreso.',
      monto: m.ok ? null : m.error,
      detalle: validarTexto(detalle, true, 'Escribe de quién o de qué es el ingreso.'),
    }
    setErrores(nuevos)
    if (hayErrores(nuevos) || !cat || !m.ok) return
    p.alRevisar({
      clase: 'movimientos',
      titulo: '¿Guardar este ingreso?',
      movimientos: [
        {
          id_cliente: nuevoId(),
          fecha: p.fecha,
          categoria_id: cat.id,
          monto: m.valor,
          descripcion: detalle.trim(),
          vendedor: null,
          categoria: cat.nombre,
          tipo: cat.tipo,
        },
      ],
    })
  }

  return (
    <form onSubmit={revisar} noValidate className="space-y-5">
      <CampoFecha fecha={p.fecha} alCambiar={p.alCambiarFecha} hoy={p.hoy} error={errores.fecha} />
      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-sm font-semibold text-ink-2">Tipo de ingreso</legend>
        <Opciones
          nombre="tipo-ingreso"
          etiqueta="Tipo de ingreso"
          opciones={opciones.map((c) => ({ valor: String(c.id), texto: c.nombre }))}
          valor={categoriaId}
          alCambiar={setCategoriaId}
        />
        <ErrorDeGrupo texto={errores.categoria} />
      </fieldset>
      <Campo etiqueta="Monto" htmlFor="monto" error={errores.monto}>
        <EntradaMonto id="monto" valor={monto} alCambiar={setMonto} invalido={Boolean(errores.monto)} />
      </Campo>
      <Campo etiqueta="¿De quién o de qué?" htmlFor="detalle" error={errores.detalle}>
        <input
          id="detalle"
          placeholder="Ej.: entrega de la Sra. Narcisa"
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
          aria-invalid={Boolean(errores.detalle) || undefined}
          className={claseEntrada}
        />
      </Campo>
      <Boton type="submit" className="w-full">
        Revisar y guardar
      </Boton>
    </form>
  )
}

/* ---------------- Transferencia al banco ---------------- */

export function FormBanco({ caja, sugerido, ...p }: PropsFormulario & { caja: number | null; sugerido: number | null }) {
  const categoria = p.categorias.find((c) => c.tipo === 'transferencia')
  const [monto, setMonto] = useState('')
  const [nota, setNota] = useState('')
  const [errores, setErrores] = useState<Errores>({})

  if (!categoria) return <SinCategorias />

  function revisar(e: FormEvent) {
    e.preventDefault()
    if (!categoria) return
    const m = leerMonto(monto)
    const nuevos: Errores = {
      fecha: validarFecha(p.fecha, p.hoy),
      monto: !m.ok
        ? m.error
        : caja !== null && m.valor > caja
          ? `En caja hay ${dinero(caja)}; no se puede transferir más que eso.`
          : null,
      nota: validarTexto(nota, false, ''),
    }
    setErrores(nuevos)
    if (hayErrores(nuevos) || !m.ok) return
    p.alRevisar({
      clase: 'movimientos',
      titulo: '¿Guardar esta transferencia al banco?',
      movimientos: [
        {
          id_cliente: nuevoId(),
          fecha: p.fecha,
          categoria_id: categoria.id,
          monto: m.valor,
          descripcion: nota.trim() || null,
          vendedor: null,
          categoria: categoria.nombre,
          tipo: categoria.tipo,
        },
      ],
    })
  }

  return (
    <form onSubmit={revisar} noValidate className="space-y-5">
      {sugerido !== null && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {sugerido > 0 ? (
            <>
              Se recomienda transferir hasta <strong>{dinero(sugerido)}</strong>.{' '}
              <Boton variante="texto" className="!min-h-0 align-baseline text-sm" onClick={() => setMonto(sugerido.toFixed(2))}>
                Usar {dinero(sugerido)}
              </Boton>
            </>
          ) : (
            <>Todavía no hace falta transferir al banco.</>
          )}
        </p>
      )}
      <CampoFecha fecha={p.fecha} alCambiar={p.alCambiarFecha} hoy={p.hoy} error={errores.fecha} />
      <Campo etiqueta="Monto transferido" htmlFor="monto" error={errores.monto}>
        <EntradaMonto id="monto" valor={monto} alCambiar={setMonto} invalido={Boolean(errores.monto)} />
      </Campo>
      <Campo etiqueta="Nota o número de comprobante (opcional)" htmlFor="nota" error={errores.nota}>
        <input id="nota" placeholder="Ej.: comprobante 004512" value={nota} onChange={(e) => setNota(e.target.value)} className={claseEntrada} />
      </Campo>
      <Boton type="submit" className="w-full">
        Revisar y guardar
      </Boton>
    </form>
  )
}

/* ---------------- Cierre de caja ---------------- */

export function FormCierre({ caja, ...p }: PropsFormulario & { caja: number | null }) {
  const [contado, setContado] = useState('')
  const [nota, setNota] = useState('')
  const [errores, setErrores] = useState<Errores>({})

  const lectura = leerMonto(contado, { permitirCero: true, maximo: 100000 })
  const esperado = p.fecha === p.hoy ? caja : null
  const diferencia = esperado !== null && lectura.ok ? redondear(lectura.valor - esperado) : null
  const pideNota = diferencia !== null && diferencia !== 0

  function revisar(e: FormEvent) {
    e.preventDefault()
    const nuevos: Errores = {
      fecha: validarFecha(p.fecha, p.hoy),
      contado: lectura.ok ? null : lectura.error,
      nota: validarTexto(nota, pideNota, 'No cuadra: explica qué pasó antes de guardar.'),
    }
    setErrores(nuevos)
    if (hayErrores(nuevos) || !lectura.ok) return
    p.alRevisar({
      clase: 'cierre',
      titulo: '¿Guardar el cierre de caja?',
      cierre: { fecha: p.fecha, contado: lectura.valor, nota: nota.trim() || null, esperado },
    })
  }

  return (
    <form onSubmit={revisar} noValidate className="space-y-5">
      <CampoFecha fecha={p.fecha} alCambiar={p.alCambiarFecha} hoy={p.hoy} error={errores.fecha} />
      <Campo etiqueta="Efectivo contado" htmlFor="contado" error={errores.contado} ayuda="Cuenta todo el dinero de la caja, incluido el fondo.">
        <EntradaMonto id="contado" valor={contado} alCambiar={setContado} invalido={Boolean(errores.contado)} />
      </Campo>

      {esperado !== null ? (
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 rounded-xl border border-line px-4 py-3">
          <dt className="text-ink-2">El sistema espera</dt>
          <dd className="cifras text-right font-semibold">{dinero(esperado)}</dd>
          {diferencia !== null && (
            <>
              <dt className="text-ink-2">Diferencia</dt>
              <dd className="flex items-center justify-end gap-1.5 font-semibold">
                {diferencia === 0 ? (
                  <>
                    <IconoOk className="size-4 text-ok" /> Cuadra
                  </>
                ) : (
                  <>
                    <IconoAlerta className="size-4 text-alerta" />
                    {diferencia > 0 ? 'Sobran' : 'Faltan'} <span className="cifras">{dinero(Math.abs(diferencia))}</span>
                  </>
                )}
              </dd>
            </>
          )}
        </dl>
      ) : (
        <p className="text-sm text-ink-2">
          Para un día anterior, lo esperado lo calcula el sistema al guardar. Si no cuadra, te pedirá una nota.
        </p>
      )}

      <Campo etiqueta={pideNota ? 'Nota: ¿por qué no cuadra?' : 'Nota (opcional)'} htmlFor="nota-cierre" error={errores.nota}>
        <textarea
          id="nota-cierre"
          rows={2}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          aria-invalid={Boolean(errores.nota) || undefined}
          className={claseEntrada}
        />
      </Campo>
      <Boton type="submit" className="w-full">
        Revisar y guardar
      </Boton>
    </form>
  )
}
