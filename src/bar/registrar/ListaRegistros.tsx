import { dinero, fechaCorta } from '../lib/formato'
import type { TipoCategoria, UltimoRegistro } from '../lib/rpc'
import type { Envio } from '../offline/baseLocal'
import { IconoReloj } from '../ui'

interface Renglon {
  clave: string
  fecha: string
  titulo: string
  detalle: string | null
  quien: string
  monto: number
  tipo: TipoCategoria | 'cierre'
  porEnviar: boolean
}

function detalleDe(descripcion: string | null, vendedor: string | null): string | null {
  const partes = [vendedor && `Vendió ${vendedor}`, descripcion].filter(Boolean)
  return partes.length ? partes.join('. ') : null
}

function desdeEnvios(envios: Envio[]): Renglon[] {
  return envios
    .filter((e) => e.estado === 'pendiente')
    .slice()
    .reverse()
    .flatMap((e): Renglon[] =>
      e.clase === 'movimientos'
        ? e.movimientos.map((m) => ({
            clave: m.id_cliente,
            fecha: m.fecha,
            titulo: m.categoria,
            detalle: detalleDe(m.descripcion, m.vendedor),
            quien: e.registrado_por,
            monto: m.monto,
            tipo: m.tipo,
            porEnviar: true,
          }))
        : [
            {
              clave: e.id,
              fecha: e.cierre.fecha,
              titulo: 'Cierre de caja',
              detalle: e.cierre.nota,
              quien: e.registrado_por,
              monto: e.cierre.contado,
              tipo: 'cierre',
              porEnviar: true,
            },
          ],
    )
}

function desdeServidor(ultimos: UltimoRegistro[]): Renglon[] {
  return ultimos.map((u) => ({
    clave: `s-${u.id}`,
    fecha: u.fecha,
    titulo: u.categoria,
    detalle: detalleDe(u.descripcion, u.vendedor),
    quien: u.registrado_por,
    monto: u.monto,
    tipo: u.tipo,
    porEnviar: false,
  }))
}

function Monto({ r }: { r: Renglon }) {
  if (r.tipo === 'cierre') return <span className="cifras font-semibold">{dinero(r.monto)}</span>
  const entra = r.tipo === 'ingreso'
  return (
    <span className={`cifras font-semibold ${entra ? 'text-emerald-700' : 'text-salida'}`}>
      {entra ? '+' : '−'}
      {dinero(r.monto)}
    </span>
  )
}

/** Últimos registros como renglones del cuaderno: la fecha va en el margen. */
export function ListaRegistros({ envios, ultimos }: { envios: Envio[]; ultimos: UltimoRegistro[] }) {
  const renglones = [...desdeEnvios(envios), ...desdeServidor(ultimos)]

  if (!renglones.length) {
    return (
      <p className="hoja rounded-2xl border border-line py-6 pr-4 pl-16 text-ink-2">
        Todavía no hay registros del formulario. Lo que guardes aparecerá aquí.
      </p>
    )
  }

  return (
    <ol className="hoja overflow-hidden rounded-2xl border border-line">
      {renglones.map((r) => {
        const [dia, mes] = fechaCorta(r.fecha).split(' ')
        return (
          <li key={r.clave} className="grid min-h-14 grid-cols-[3.25rem_minmax(0,1fr)_auto] gap-x-3 border-b border-grid py-3 pr-4 last:border-b-0">
            <span className="pt-0.5 text-center text-xs leading-tight text-muted">
              <span className="block text-base font-semibold text-ink-2">{dia}</span>
              {mes}
            </span>
            <div className="min-w-0">
              <p className="font-semibold">{r.titulo}</p>
              {r.detalle && <p className="truncate text-sm text-ink-2">{r.detalle}</p>}
              {r.porEnviar ? (
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-alerta">
                  <IconoReloj className="size-4" /> Por enviar
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-muted">Registró {r.quien}</p>
              )}
            </div>
            <span className="pt-0.5">
              <Monto r={r} />
            </span>
          </li>
        )
      })}
    </ol>
  )
}
