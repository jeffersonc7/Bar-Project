// Paleta de gráficos (referencia validada del skill dataviz; probada contra los fondos de la app:
// claro #ffffff y oscuro #151b31). El orden de los colores es el mecanismo de seguridad para
// daltonismo: no se reordena. El color sigue a la categoría (por id), nunca a su posición en el ranking.
import type { CategoriaBasica } from './calculos'

const CATEGORICO_CLARO = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
const CATEGORICO_OSCURO = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']

export interface ColoresGrafico {
  superficie: string
  grid: string
  eje: string
  texto: string
  cursor: string
  /** Entradas de dinero (par divergente azul/rojo). */
  ingreso: string
  /** Salidas de dinero. */
  gasto: string
  serie: string[]
}

export function coloresGrafico(oscuro: boolean): ColoresGrafico {
  return oscuro
    ? {
        superficie: '#0f172a',
        grid: '#1e293b',
        eje: '#334155',
        texto: '#94a3b8',
        cursor: 'rgba(147, 197, 253, 0.10)',
        ingreso: '#3987e5',
        gasto: '#e66767',
        serie: CATEGORICO_OSCURO,
      }
    : {
        superficie: '#ffffff',
        grid: '#efeeec',
        eje: '#d6d3d1',
        texto: '#78716c',
        cursor: 'rgba(28, 25, 23, 0.04)',
        ingreso: '#2a78d6',
        gasto: '#e34948',
        serie: CATEGORICO_CLARO,
      }
}

/** Color fijo de cada categoría de gasto según su orden por id (6 categorías hoy, 8 colores como máximo). */
export function colorDeCategoria(id: number, categoriasGasto: CategoriaBasica[], colores: ColoresGrafico): string {
  const orden = categoriasGasto.map((c) => c.id).sort((a, b) => a - b)
  const i = orden.indexOf(id)
  return i >= 0 && i < colores.serie.length ? colores.serie[i] : colores.texto
}
