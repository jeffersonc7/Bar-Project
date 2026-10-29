import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { CircleCheck, Clock, Info, TriangleAlert, WifiOff } from 'lucide-react'

/* ---------- Íconos (Lucide; decorativos: van junto a un texto que los explica) ---------- */

type PropsIcono = { className?: string }
const claseIcono = (className = 'size-4') => `shrink-0 ${className}`

export const IconoAlerta = ({ className }: PropsIcono) => <TriangleAlert aria-hidden="true" className={claseIcono(className)} />
export const IconoOk = ({ className }: PropsIcono) => <CircleCheck aria-hidden="true" className={claseIcono(className)} />
export const IconoReloj = ({ className }: PropsIcono) => <Clock aria-hidden="true" className={claseIcono(className)} />
export const IconoSinConexion = ({ className }: PropsIcono) => <WifiOff aria-hidden="true" className={claseIcono(className)} />
export const IconoInfo = ({ className }: PropsIcono) => <Info aria-hidden="true" className={claseIcono(className)} />

/* ---------- Botón ---------- */

type Variante = 'primario' | 'secundario' | 'texto' | 'peligro'

const VARIANTES: Record<Variante, string> = {
  primario: 'min-h-12 rounded-xl bg-accion px-5 text-on-accion hover:bg-emerald-800',
  secundario: 'min-h-12 rounded-xl bg-suave px-5 text-ink hover:bg-stone-200',
  peligro: 'min-h-12 rounded-xl bg-salida px-5 text-white hover:opacity-90',
  texto: 'min-h-8 font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-4 hover:decoration-emerald-800',
}

export function Boton({
  variante = 'primario',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      type={type}
      {...props}
      className={`inline-flex items-center justify-center gap-2 text-base font-semibold transition-[opacity,background-color,color] duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTES[variante]} ${className}`}
    />
  )
}

/* ---------- Campos ---------- */

export const claseEntrada =
  'block w-full rounded-xl border border-transparent bg-suave px-3.5 py-3 text-base text-ink transition-colors duration-200 placeholder:text-muted focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-100 aria-[invalid=true]:border-salida aria-[invalid=true]:bg-salida-suave'

export function Campo({
  etiqueta,
  htmlFor,
  ayuda,
  error,
  children,
}: {
  etiqueta: ReactNode
  htmlFor?: string
  ayuda?: ReactNode
  error?: string | null
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink-2">
        {etiqueta}
      </label>
      {children}
      {error ? (
        <p className="flex items-start gap-1.5 text-sm text-salida" role="alert">
          <IconoAlerta className="mt-0.5 size-4" />
          {error}
        </p>
      ) : ayuda ? (
        <p className="text-sm text-muted">{ayuda}</p>
      ) : null}
    </div>
  )
}

export function EntradaMonto({
  id,
  valor,
  alCambiar,
  invalido,
  placeholder = '0.00',
}: {
  id: string
  valor: string
  alCambiar: (v: string) => void
  invalido?: boolean
  placeholder?: string
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-lg text-muted" aria-hidden="true">
        $
      </span>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        aria-invalid={invalido || undefined}
        className={`${claseEntrada} cifras pl-8 text-lg`}
      />
    </div>
  )
}

/** Grupo de opciones tipo "chips" (radio). */
export function Opciones<T extends string>({
  nombre,
  etiqueta,
  opciones,
  valor,
  alCambiar,
}: {
  nombre: string
  etiqueta: string
  opciones: readonly { valor: T; texto: string }[]
  valor: T | null
  alCambiar: (v: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="flex flex-wrap gap-2">
      {opciones.map((o) => {
        const elegido = valor === o.valor
        return (
          <label
            key={o.valor}
            className={`inline-flex min-h-11 cursor-pointer select-none items-center rounded-full px-4 text-base transition-colors duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink has-[:focus-visible]:ring-offset-2 ${
              elegido ? 'bg-accion font-medium text-on-accion' : 'bg-suave text-ink hover:bg-emerald-50'
            }`}
          >
            <input type="radio" name={nombre} value={o.valor} checked={elegido} onChange={() => alCambiar(o.valor)} className="sr-only" />
            {o.texto}
          </label>
        )
      })}
    </div>
  )
}

/* ---------- Avisos ---------- */

type Tono = 'info' | 'ok' | 'alerta' | 'error'

const TONOS: Record<Tono, { clase: string; icono: ReactNode }> = {
  info: { clase: 'border-line bg-suave text-ink', icono: <IconoInfo className="mt-0.5 size-5 text-ink-2" /> },
  ok: { clase: 'border-green-200 bg-green-50 text-ink', icono: <IconoOk className="mt-0.5 size-5 text-ok" /> },
  alerta: { clase: 'border-amber-200 bg-amber-50 text-ink', icono: <IconoAlerta className="mt-0.5 size-5 text-alerta" /> },
  error: { clase: 'border-red-200 bg-salida-suave text-ink', icono: <IconoAlerta className="mt-0.5 size-5 text-salida" /> },
}

export function Aviso({ tono, children, accion }: { tono: Tono; children: ReactNode; accion?: ReactNode }) {
  const t = TONOS[tono]
  return (
    <div className={`flex flex-wrap items-start gap-x-3 gap-y-2 rounded-xl border px-4 py-3 ${t.clase}`} role={tono === 'error' ? 'alert' : 'status'}>
      {t.icono}
      <div className="min-w-0 flex-1 basis-56">{children}</div>
      {accion && <div className="shrink-0">{accion}</div>}
    </div>
  )
}

/* ---------- Diálogo modal (nativo: trae foco atrapado, Escape y fondo) ---------- */

export function Dialogo({
  abierto,
  titulo,
  alCerrar,
  tituloVisible = true,
  pie,
  children,
}: {
  abierto: boolean
  titulo: string
  alCerrar: () => void
  /** false: el título solo lo leen los lectores de pantalla (el contenido trae su propia cabecera). */
  tituloVisible?: boolean
  /** Botones fijos abajo, fuera de la zona que se desplaza. */
  pie?: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (abierto && !d.open) d.showModal()
    if (!abierto && d.open) d.close()
  }, [abierto])

  return (
    <dialog
      ref={ref}
      onClose={(e) => {
        if (e.target === e.currentTarget) alCerrar()
      }}
      aria-labelledby="dialogo-titulo"
      className="sube m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-3xl bg-sheet p-0 text-ink shadow-2xl backdrop:bg-stone-950/40 backdrop:backdrop-blur-[2px] open:flex open:flex-col sm:m-auto sm:max-w-lg sm:rounded-3xl"
    >
      {abierto && (
        <>
          <div className={`min-h-0 flex-1 overflow-y-auto px-5 pt-5 ${pie ? 'pb-5' : 'pb-[max(1.25rem,env(safe-area-inset-bottom))]'}`}>
            <h2 id="dialogo-titulo" className={tituloVisible ? 'font-serif text-2xl font-medium' : 'sr-only'}>
              {titulo}
            </h2>
            <div className={tituloVisible ? 'mt-4' : ''}>{children}</div>
          </div>
          {pie && <div className="border-t border-line bg-sheet px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{pie}</div>}
        </>
      )}
    </dialog>
  )
}

/* ---------- Cajón lateral (diálogo nativo pegado a un lado) ---------- */

export function Cajon({
  abierto,
  etiqueta,
  alCerrar,
  lado = 'derecha',
  className = '',
  children,
}: {
  abierto: boolean
  etiqueta: string
  alCerrar: () => void
  lado?: 'derecha' | 'izquierda'
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (abierto && !d.open) d.showModal()
    if (!abierto && d.open) d.close()
  }, [abierto])

  return (
    <dialog
      ref={ref}
      onClose={(e) => {
        if (e.target === e.currentTarget) alCerrar()
      }}
      aria-label={etiqueta}
      onClick={(e) => {
        // Clic en el fondo oscuro (fuera del contenido) cierra el cajón.
        if (e.target === e.currentTarget) alCerrar()
      }}
      className={`fixed inset-y-0 m-0 h-dvh max-h-none w-full p-0 shadow-2xl backdrop:bg-stone-950/40 backdrop:backdrop-blur-[2px] ${
        lado === 'derecha' ? 'desliza-izq right-0 left-auto max-w-lg' : 'desliza-der right-auto left-0 max-w-xs'
      } ${className}`}
    >
      {abierto && children}
    </dialog>
  )
}

export function Cargando({ texto }: { texto: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-4 text-ink-2" role="status">
      {texto}
    </div>
  )
}
