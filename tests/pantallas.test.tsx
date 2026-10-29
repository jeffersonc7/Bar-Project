// Renderiza las pantallas sin navegador: detecta errores de render y textos clave.
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Contenido from '../src/bar/dashboard/Contenido'
import { coloresGrafico } from '../src/bar/dashboard/colores'
import type { Movimiento } from '../src/bar/dashboard/calculos'
import type { Panel } from '../src/bar/lib/rpc'
import { filtrosIniciales } from '../src/bar/panel/filtros'
import { hoyEnBar } from '../src/bar/lib/formato'
import type { Categoria } from '../src/bar/lib/rpc'
import { Confirmacion } from '../src/bar/registrar/Confirmacion'
import { FormBanco, FormCierre, FormGastos, FormOtroIngreso, FormVenta, type PropsFormulario } from '../src/bar/registrar/formularios'
import { ListaRegistros } from '../src/bar/registrar/ListaRegistros'

const categorias: Categoria[] = [
  { id: 1, nombre: 'Venta bar', tipo: 'ingreso', requiere_descripcion: false, requiere_vendedor: true },
  { id: 2, nombre: 'Entrega', tipo: 'ingreso', requiere_descripcion: true, requiere_vendedor: false },
  { id: 5, nombre: 'Compras (factura)', tipo: 'gasto', requiere_descripcion: false, requiere_vendedor: false },
  { id: 9, nombre: 'Pagos a personas', tipo: 'gasto', requiere_descripcion: true, requiere_vendedor: false },
  { id: 11, nombre: 'Transferencia al banco', tipo: 'transferencia', requiere_descripcion: false, requiere_vendedor: false },
]

const hoy = '2026-10-27'
const props: PropsFormulario = { fecha: hoy, alCambiarFecha: () => {}, hoy, categorias, alRevisar: () => {} }

describe('formularios', () => {
  it('venta: monto, quién vendió (con la persona de la sesión elegida) y nota', () => {
    const html = renderToString(<FormVenta {...props} nombre="Viviana" />)
    expect(html).toContain('Monto vendido')
    expect(html).toContain('¿Quién vendió?')
    expect(html).toMatch(/checked="" value="Viviana"/)
  })

  it('gastos, otro ingreso, banco y cierre se dibujan', () => {
    expect(renderToString(<FormGastos {...props} />)).toContain('Agregar otro gasto')
    expect(renderToString(<FormOtroIngreso {...props} />)).toContain('¿De quién o de qué?')
    const banco = renderToString(<FormBanco {...props} caja={241.68} sugerido={91.68} />)
    expect(banco).toContain('$91.68')
    const cierre = renderToString(<FormCierre {...props} caja={241.68} />)
    expect(cierre).toContain('El sistema espera')
    expect(cierre).toContain('$241.68')
  })

  it('sin categorías descargadas pide conectarse', () => {
    expect(renderToString(<FormVenta {...props} categorias={[]} nombre="Viviana" />)).toContain('Conéctate a internet')
  })
})

describe('confirmación y lista', () => {
  it('muestra el resumen antes de guardar', () => {
    const html = renderToString(
      <Confirmacion
        borrador={{
          clase: 'movimientos',
          titulo: '¿Guardar estos 2 gastos?',
          movimientos: [
            { id_cliente: 'a', fecha: hoy, categoria_id: 5, monto: 10, descripcion: 'Factura 1', vendedor: null, categoria: 'Compras (factura)', tipo: 'gasto' },
            { id_cliente: 'b', fecha: hoy, categoria_id: 9, monto: 20, descripcion: 'Viviana', vendedor: null, categoria: 'Pagos a personas', tipo: 'gasto' },
          ],
        }}
        nombre="Saidy"
        guardando={false}
        alGuardar={() => {}}
        alVolver={() => {}}
      />,
    )
    expect(html).toContain('¿Guardar estos 2 gastos?')
    expect(html).toContain('$30.00')
    expect(html).toContain('Registra: <!-- -->Saidy')
  })

  it('últimos registros: pendientes primero y luego los del servidor', () => {
    const html = renderToString(
      <ListaRegistros
        envios={[
          {
            id: 'x',
            clase: 'cierre',
            registrado_por: 'Yaque',
            creado_en: '2026-10-27T23:00:00Z',
            estado: 'pendiente',
            cierre: { fecha: hoy, contado: 150, nota: null, esperado: 150 },
          },
        ]}
        ultimos={[
          { id: 1, fecha: hoy, categoria: 'Venta bar', tipo: 'ingreso', monto: 42.5, descripcion: null, vendedor: 'Efrén', registrado_por: 'Efrén', creado_en: '' },
        ]}
      />,
    )
    expect(html.indexOf('Cierre de caja')).toBeLessThan(html.indexOf('Venta bar'))
    expect(html).toContain('Por enviar')
    expect(html).toContain('+<!-- -->$42.50')
  })
})

describe('dashboard', () => {
  const fecha = hoyEnBar()
  const base = { descripcion: null, vendedor: null, registrado_por: 'Prueba', fuente: 'formulario', revisar: false, nota_revision: null, anulado: false, motivo_anulacion: null, anulado_por: null, anulado_en: null, creado_en: '' }
  const movimientos: Movimiento[] = [
    { ...base, id: 1, fecha, categoria_id: 1, categoria: 'Venta bar', tipo: 'ingreso', monto: 80, vendedor: 'Anahí' },
    { ...base, id: 2, fecha, categoria_id: 5, categoria: 'Compras (factura)', tipo: 'gasto', monto: 30 },
    { ...base, id: 3, fecha, categoria_id: 5, categoria: 'Compras (factura)', tipo: 'gasto', monto: 99, anulado: true, motivo_anulacion: 'Duplicado' },
  ]
  const panel: Panel = {
    ok: true,
    hoy: fecha,
    caja: { efectivo_en_caja: 200, fondo_caja: 150, para_transferir: 50 },
    categorias: [
      { id: 1, nombre: 'Venta bar', tipo: 'ingreso' },
      { id: 5, nombre: 'Compras (factura)', tipo: 'gasto' },
    ],
    movimientos,
    cierres: [],
  }
  const props = { panel, filtros: filtrosIniciales(fecha), hoy: fecha, colores: coloresGrafico(false), netoPendiente: 0, pendientes: 0, puedeAnular: false, alVerTodo: () => {}, alAnulado: () => {} }

  it('dibuja todas las secciones, no cuenta lo anulado y sugiere transferir', () => {
    const html = renderToString(<Contenido {...props} />)
    for (const texto of ['Efectivo en caja', '¿En qué se gastó el dinero?', 'Ventas', 'Banco y cierres de caja', 'Historial', 'Para tener en cuenta']) {
      expect(html).toContain(texto)
    }
    expect(html).toContain('$30.00') // gastos del periodo sin el anulado de $99
    expect(html).toContain('Duplicado') // el anulado se ve en el historial
    expect(html).toContain('Conviene transferir')
    expect(html).not.toContain('$150.00') // el fondo es solo una referencia interna: no se muestra
  })

  it('suma a la caja lo que está por enviar desde el celular', () => {
    const html = renderToString(<Contenido {...props} netoPendiente={12.5} pendientes={1} />)
    expect(html).toContain('$212.50')
    expect(html).toContain('Incluye <!-- -->1 registro<!-- --> por enviar.')
  })

  it('sin sesión se ven los datos pero no se puede anular', () => {
    const sin = renderToString(<Contenido {...props} />)
    expect(sin).not.toContain('>Anular<')
    const con = renderToString(<Contenido {...props} puedeAnular />)
    expect(con).toContain('>Anular<')
  })
})
