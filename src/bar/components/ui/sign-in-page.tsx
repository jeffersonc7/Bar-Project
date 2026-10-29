// Login con la estructura de la referencia del usuario (titular serif centrado, tarjeta con
// campos grises y botón principal sólido, foto grande con esquinas redondeadas), en tema blanco.
// Adaptado según la skill integrar-componente-ui: sin botones de Google/Apple ni registro de
// cuentas (la app entra con nombre + clave del bar); imagen local en /public (funciona sin
// internet); textos en español; accesible (diálogo con título, botón de cerrar, labels).
import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { claseEntrada } from '@/ui'

/** Pantalla completa de ingreso: texto y formulario a la izquierda, foto a la derecha. */
export function PantallaIngreso({
  titulo,
  subtitulo,
  alCerrar,
  children,
  pie,
}: {
  titulo: string
  subtitulo: string
  alCerrar: () => void
  children: ReactNode
  pie?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby="ingreso-titulo"
      onClose={(e) => {
        if (e.target === e.currentTarget) alCerrar()
      }}
      className="aparece fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto bg-white p-0 text-ink"
    >
      <div className="grid min-h-dvh lg:grid-cols-2">
        <div className="flex flex-col px-5 pt-4 pb-10 sm:px-10 lg:py-8">
          <button
            type="button"
            onClick={alCerrar}
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full pr-3 pl-1 text-sm font-medium text-ink-2 transition-colors duration-200 hover:text-ink"
          >
            <ArrowLeft className="size-[18px]" aria-hidden="true" /> Volver al panel
          </button>

          {/* En el celular la foto va arriba, más baja. */}
          <img
            src="/acceso.webp"
            alt=""
            width={1200}
            height={800}
            decoding="async"
            className="mt-3 h-44 w-full rounded-3xl object-cover sm:h-56 lg:hidden"
          />

          <div className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center pt-8 lg:pt-0">
            <h1 id="ingreso-titulo" className="text-center font-serif text-[2.6rem] leading-[1.05] font-normal tracking-tight sm:text-5xl">
              {titulo}
            </h1>
            <p className="mt-3 text-center font-serif text-lg text-ink-2">{subtitulo}</p>
            <div className="mt-8 rounded-[1.75rem] border border-line bg-white p-5 shadow-[0_1px_2px_rgba(28,25,23,0.04)] sm:p-7">{children}</div>
            {pie && <div className="mt-6 text-center text-sm text-muted">{pie}</div>}
          </div>
        </div>

        <div className="hidden p-4 lg:block">
          <img src="/acceso.webp" alt="" width={1200} height={800} decoding="async" className="sticky top-4 h-[calc(100dvh-2rem)] w-full rounded-[1.75rem] object-cover" />
        </div>
      </div>
    </dialog>
  )
}

/** Campo de contraseña/clave con botón para mostrar u ocultar lo escrito. */
export function EntradaSecreta({
  id,
  valor,
  alCambiar,
  queOculta = 'la contraseña',
  invalido,
  className = '',
  claseContenedor = '',
  ...resto
}: {
  id: string
  valor: string
  alCambiar: (valor: string) => void
  queOculta?: string
  invalido?: boolean
  /** Ancho del campo (p. ej. "max-w-48"): va en el contenedor para que el botón quede pegado al campo. */
  claseContenedor?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'value' | 'onChange' | 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className={`relative ${claseContenedor}`}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        aria-invalid={invalido || undefined}
        className={`${claseEntrada} pr-11 ${className}`}
        {...resto}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? `Ocultar ${queOculta}` : `Mostrar ${queOculta}`}
        aria-pressed={visible}
        className="absolute inset-y-0 right-1 my-auto flex size-9 items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-stone-200 hover:text-ink"
      >
        {visible ? <EyeOff className="size-[18px]" aria-hidden="true" /> : <Eye className="size-[18px]" aria-hidden="true" />}
      </button>
    </div>
  )
}
