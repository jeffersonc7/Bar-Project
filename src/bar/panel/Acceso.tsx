import { useState, type FormEvent } from 'react'
import { EntradaSecreta, PantallaIngreso } from '@/components/ui/sign-in-page'
import { LLAVES, guardar } from '../lib/almacen'
import { PERSONAS } from '../lib/config'
import { ErrorDeConexion, explicarErrorServidor, mensajeDeClave, obtenerCategorias, obtenerResumen } from '../lib/rpc'
import { validarClaveBar, validarNombre } from '../lib/validaciones'
import { Aviso, Boton, Opciones, claseEntrada } from '../ui'
import type { Sesion } from './sesion'

const OTRA = 'otra'
const OPCIONES_PERSONA = [...PERSONAS.map((p) => ({ valor: p as string, texto: p as string })), { valor: OTRA, texto: 'Otra persona' }]

export const AYUDA_CLAVE = 'La clave del bar la tiene quien administra la caja. Si la cambiaron o no la recuerdas, pídesela a esa persona.'

/** Verifica nombre + clave del bar contra el servidor (solo hace falta para registrar). */
export function useAcceso(alEntrar: (sesion: Sesion, recordar: boolean) => void) {
  const [entrando, setEntrando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function entrar(nombre: string, clave: string, recordar: boolean): Promise<boolean> {
    const fallo = (nombre ? validarNombre(nombre) : 'Elige tu nombre.') ?? validarClaveBar(clave)
    if (fallo) {
      setError(fallo)
      return false
    }
    if (!navigator.onLine) {
      setError('Para entrar necesitas internet. Después puedes registrar aunque no haya conexión.')
      return false
    }
    setEntrando(true)
    setError(null)
    try {
      const [resumen, categorias] = await Promise.all([obtenerResumen(clave), obtenerCategorias()])
      if (!resumen.ok) {
        setError(mensajeDeClave(resumen))
        return false
      }
      guardar(LLAVES.resumen, resumen)
      guardar(LLAVES.categorias, categorias)
      alEntrar({ nombre: nombre.trim(), clave }, recordar)
      return true
    } catch (e) {
      setError(e instanceof ErrorDeConexion ? explicarErrorServidor(e.message) : 'No se pudo conectar con el servidor. Revisa el internet e intenta de nuevo.')
      return false
    } finally {
      setEntrando(false)
    }
  }

  return { entrar, entrando, error, limpiarError: () => setError(null) }
}

export type Acceso = ReturnType<typeof useAcceso>

/** Pantalla para entrar a registrar: nombre + clave del bar. */
export function PantallaAcceso({ acceso, alCerrar }: { acceso: Acceso; alCerrar: () => void }) {
  const [persona, setPersona] = useState<string | null>(null)
  const [otra, setOtra] = useState('')
  const [clave, setClave] = useState('')
  const [recordar, setRecordar] = useState(true)
  const [verAyuda, setVerAyuda] = useState(false)
  const nombre = persona === OTRA ? otra : (persona ?? '')

  function enviar(e: FormEvent) {
    e.preventDefault()
    void acceso.entrar(nombre, clave, recordar)
  }

  return (
    <PantallaIngreso
      titulo="Registra en la caja"
      subtitulo="Ventas, gastos y el cierre del día."
      alCerrar={alCerrar}
      pie={<>Para ver los números no hace falta entrar. Solo para registrar.</>}
    >
      <form onSubmit={enviar} noValidate className="space-y-5">
        <fieldset className="min-w-0 space-y-2">
          <legend className="mb-2 text-sm font-medium text-ink-2">¿Quién eres?</legend>
          <Opciones nombre="persona" etiqueta="¿Quién eres?" opciones={OPCIONES_PERSONA} valor={persona} alCambiar={setPersona} />
          {persona === OTRA && (
            <input aria-label="Escribe tu nombre" placeholder="Escribe tu nombre" value={otra} onChange={(e) => setOtra(e.target.value)} autoComplete="name" className={`${claseEntrada} mt-2`} />
          )}
        </fieldset>

        <div className="space-y-2">
          <label htmlFor="clave" className="block text-sm font-medium text-ink-2">
            Clave del bar
          </label>
          <EntradaSecreta
            id="clave"
            queOculta="la clave"
            placeholder="4 números"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            valor={clave}
            alCambiar={(v) => setClave(v.replace(/\D/g, '').slice(0, 4))}
            className="cifras text-lg tracking-[0.35em] placeholder:text-base placeholder:tracking-normal"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <label className="flex min-h-11 items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} className="size-4 accent-emerald-700" />
            Recordarme
          </label>
          <button type="button" onClick={() => setVerAyuda((v) => !v)} aria-expanded={verAyuda} className="min-h-11 text-sm font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-4">
            ¿Olvidaste la clave?
          </button>
        </div>
        {verAyuda && <Aviso tono="info">{AYUDA_CLAVE}</Aviso>}
        {acceso.error && <Aviso tono="error">{acceso.error}</Aviso>}

        <Boton type="submit" disabled={acceso.entrando} className="w-full">
          {acceso.entrando ? 'Revisando la clave…' : 'Continuar'}
        </Boton>
      </form>
    </PantallaIngreso>
  )
}
