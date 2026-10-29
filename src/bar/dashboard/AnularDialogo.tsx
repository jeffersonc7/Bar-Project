import { useEffect, useState, type FormEvent } from 'react'
import { dinero, fechaLarga } from '../lib/formato'
import { anularMovimiento, ErrorDeConexion, mensajeDeClave, esProblemaDeClave } from '../lib/rpc'
import { validarNombre } from '../lib/validaciones'
import { Aviso, Boton, Campo, Dialogo, claseEntrada } from '../ui'
import type { Movimiento } from './calculos'

export function AnularDialogo({
  movimiento,
  alCerrar,
  alAnular,
}: {
  movimiento: Movimiento | null
  alCerrar: () => void
  alAnular: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [quien, setQuien] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    setMotivo('')
    setClave('')
    setError(null)
  }, [movimiento?.id])

  async function anular(e: FormEvent) {
    e.preventDefault()
    if (!movimiento) return
    if (motivo.trim().length < 3) return setError('Escribe el motivo de la anulación.')
    const errNombre = validarNombre(quien)
    if (errNombre) return setError(`Tu nombre: ${errNombre.toLowerCase()}`)
    if (!clave) return setError('Escribe la clave de administración.')

    setEnviando(true)
    setError(null)
    try {
      const r = await anularMovimiento(clave, movimiento.id, motivo.trim(), quien.trim())
      if (r.ok) alAnular()
      else setError(esProblemaDeClave(r.codigo) ? mensajeDeClave(r) : r.mensaje)
    } catch (err) {
      setError(err instanceof ErrorDeConexion ? 'No se pudo conectar. Revisa el internet e intenta de nuevo.' : 'Algo salió mal al anular.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialogo abierto={movimiento !== null} titulo="Anular movimiento" alCerrar={() => !enviando && alCerrar()}>
      {movimiento && (
        <form onSubmit={anular} noValidate className="space-y-4">
          <div className="rounded-xl border border-line px-4 py-3">
            <p className="font-semibold">
              {movimiento.categoria}: <span className="cifras">{dinero(movimiento.monto)}</span>
            </p>
            <p className="text-sm text-ink-2">
              {fechaLarga(movimiento.fecha)}
              {movimiento.descripcion ? `. ${movimiento.descripcion}` : ''}
            </p>
          </div>
          <p className="text-sm text-ink-2">
            No se borra: queda en el historial marcado como anulado y deja de contar para la caja y los gráficos. No se puede deshacer.
          </p>
          <Campo etiqueta="Motivo" htmlFor="motivo">
            <textarea id="motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={claseEntrada} />
          </Campo>
          <Campo etiqueta="Tu nombre" htmlFor="quien">
            <input id="quien" value={quien} onChange={(e) => setQuien(e.target.value)} autoComplete="name" className={claseEntrada} />
          </Campo>
          <Campo etiqueta="Clave de administración" htmlFor="clave-admin">
            <input
              id="clave-admin"
              type="password"
              autoComplete="off"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              className={claseEntrada}
            />
          </Campo>
          {error && <Aviso tono="error">{error}</Aviso>}
          <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
            <Boton variante="secundario" onClick={alCerrar} disabled={enviando}>
              Cancelar
            </Boton>
            <Boton type="submit" variante="peligro" disabled={enviando}>
              {enviando ? 'Anulando…' : 'Anular movimiento'}
            </Boton>
          </div>
        </form>
      )}
    </Dialogo>
  )
}
