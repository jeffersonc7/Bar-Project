import { expect, test, type Page } from '@playwright/test'
import { movimientoDePrueba, simularSupabase } from './simulador'

const esMovil = (page: Page) => (page.viewportSize()?.width ?? 1280) < 1024
const llamadasA = <T extends { fn: string }>(estado: { llamadas: T[] }, fn: string) => estado.llamadas.filter((l) => l.fn === fn)
const sinDesborde = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)

/** "Registrar" sin sesión abre la pantalla de ingreso; con nombre + clave abre el panel de registro. */
async function entrarARegistrar(page: Page, nombre = 'Viviana', clave = '1234') {
  await page.getByRole('button', { name: 'Registrar', exact: true }).click()
  const ingreso = page.getByRole('dialog', { name: 'Registra en la caja' })
  await ingreso.getByRole('radiogroup', { name: '¿Quién eres?' }).getByText(nombre, { exact: true }).click()
  await ingreso.getByLabel('Clave del bar').fill(clave)
  await ingreso.getByRole('button', { name: 'Continuar' }).click()
  return ingreso
}

async function abrirRegistro(page: Page) {
  await page.goto('/')
  await entrarARegistrar(page)
  const registrar = page.getByRole('dialog', { name: 'Registrar' })
  await expect(registrar).toBeVisible()
  return registrar
}

async function abrirFiltros(page: Page) {
  if (esMovil(page)) {
    await page.getByRole('button', { name: 'Filtros' }).click()
    return page.getByRole('dialog', { name: 'Filtros' })
  }
  return page.getByRole('complementary', { name: 'Filtros' })
}

test('abre directo con los números, sin login', async ({ page }) => {
  const sim = await simularSupabase(page)
  await page.goto('/')
  await expect(page.locator('#resumen')).toContainText('$241.68')
  await expect(page.locator('#resumen')).toContainText('Para tener en cuenta')
  for (const titulo of ['¿En qué se gastó el dinero?', 'Ventas', 'Banco y cierres de caja', 'Historial']) {
    await expect(page.getByRole('heading', { name: titulo, exact: true })).toBeVisible()
  }
  expect(llamadasA(sim, 'panel_publico').length).toBeGreaterThan(0)
  expect(llamadasA(sim, 'resumen_caja')).toHaveLength(0) // sin entrar no se usa ninguna clave
  await expect(page.getByRole('button', { name: 'Anular' })).toHaveCount(0) // anular es modificar: pide sesión
  await sinDesborde(page)
})

test('si los últimos 3 meses están vacíos (cuaderno viejo), abre en "Todo" y no en $0.00', async ({ page }) => {
  await simularSupabase(page, { movimientos: [movimientoDePrueba(1, '2026-02-01', 2, 45.9), movimientoDePrueba(2, '2026-05-29', 1, 100, { vendedor: 'Anahí' })] })
  await page.goto('/')
  await expect(page.locator('#resumen')).toContainText('Todo el historial')
  await expect(page.locator('#resumen')).toContainText('$145.90')
  await expect(page.locator('#resumen')).not.toContainText('−100%')
  await expect(page.locator('#resumen')).not.toContainText('-100%')
})

test('los filtros funcionan sin entrar', async ({ page }) => {
  await simularSupabase(page)
  await page.goto('/')
  await expect(page.locator('#historial')).toContainText('Factura 123')

  let filtros = await abrirFiltros(page)
  await filtros.getByRole('radiogroup', { name: 'Periodo' }).getByText('Todo', { exact: true }).click()
  await filtros.getByRole('switch', { name: 'Solo por revisar' }).click()
  if (esMovil(page)) await filtros.getByRole('button', { name: 'Ver resultados' }).click()
  await expect(page.locator('#historial')).toContainText('Nombre poco legible')
  await expect(page.locator('#historial')).not.toContainText('Factura 123')

  filtros = await abrirFiltros(page)
  await filtros.getByRole('button', { name: 'Limpiar' }).click()
  if (esMovil(page)) await filtros.getByRole('button', { name: 'Ver resultados' }).click()
  await expect(page.locator('#historial')).toContainText('Factura 123')
})

test('registrar pide la clave; con una incorrecta no deja', async ({ page }) => {
  await simularSupabase(page)
  await page.goto('/')
  const ingreso = await entrarARegistrar(page, 'Saidy', '9999')
  await expect(ingreso.getByText(/Clave incorrecta/)).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Registrar' })).toHaveCount(0)
  await ingreso.getByRole('button', { name: 'Volver al panel' }).click()
  await expect(page.locator('#resumen')).toBeVisible()
})

test('registra una venta y la caja se actualiza', async ({ page }) => {
  const sim = await simularSupabase(page)
  const registrar = await abrirRegistro(page)
  await registrar.getByLabel('Monto vendido').fill('12,50')
  await registrar.getByRole('button', { name: 'Revisar y guardar' }).click()
  const confirmar = page.getByRole('dialog', { name: '¿Guardar esta venta?' })
  await expect(confirmar).toContainText('$12.50')
  await expect(confirmar).toContainText('Vendió Viviana')
  await confirmar.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(registrar.getByText('Guardado. Ya está en el sistema.')).toBeVisible()
  await expect(registrar.getByLabel('Monto vendido')).toHaveValue('')

  const [llamada] = llamadasA(sim, 'registrar_movimientos')
  expect(llamada.cuerpo.p_registrado_por).toBe('Viviana')
  expect((llamada.cuerpo.p_movimientos as Record<string, unknown>[])[0]).toMatchObject({ monto: 12.5, vendedor: 'Viviana', categoria_id: 1 })

  await registrar.getByRole('button', { name: 'Cerrar registrar' }).click()
  await expect(page.locator('#resumen')).toContainText('$254.18')
  await expect(page.getByTitle('Registrando como Viviana')).toBeVisible()
})

test('varios gastos en un envío van juntos y se validan', async ({ page }) => {
  const sim = await simularSupabase(page)
  const registrar = await abrirRegistro(page)
  await registrar.getByRole('button', { name: 'Gastos' }).click()
  await registrar.getByLabel('Categoría').first().selectOption({ label: 'Compras (factura)' })
  await registrar.getByLabel('Monto', { exact: true }).first().fill('20')
  await registrar.getByRole('button', { name: 'Agregar otro gasto' }).click()
  await registrar.getByLabel('Categoría').nth(1).selectOption({ label: 'Pagos a personas' })
  await registrar.getByLabel('Monto', { exact: true }).nth(1).fill('2500')
  await registrar.getByRole('button', { name: 'Revisar y guardar' }).click()
  await expect(registrar.getByText(/¿Falta el punto decimal\?/)).toBeVisible()
  await expect(registrar.getByText('Esta categoría necesita una descripción.')).toBeVisible()

  await registrar.getByLabel('Monto', { exact: true }).nth(1).fill('15')
  await registrar.getByLabel('¿A quién se le pagó?').fill('Yaque')
  await registrar.getByRole('button', { name: 'Revisar y guardar' }).click()
  const confirmar = page.getByRole('dialog', { name: '¿Guardar estos 2 gastos?' })
  await expect(confirmar).toContainText('$35.00')
  await confirmar.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(registrar.getByText('Guardado. Ya está en el sistema.')).toBeVisible()
  const llamadas = llamadasA(sim, 'registrar_movimientos')
  expect(llamadas).toHaveLength(1)
  expect(llamadas[0].cuerpo.p_movimientos).toHaveLength(2)
})

test('no deja transferir más de lo que hay en caja', async ({ page }) => {
  await simularSupabase(page)
  const registrar = await abrirRegistro(page)
  await registrar.getByRole('button', { name: 'Banco' }).click()
  await registrar.getByLabel('Monto transferido').fill('300')
  await registrar.getByRole('button', { name: 'Revisar y guardar' }).click()
  await expect(registrar.getByText(/En caja hay \$241\.68/)).toBeVisible()
})

test('sin internet guarda en el equipo y luego envía una sola vez', async ({ page, context }) => {
  const sim = await simularSupabase(page)
  const registrar = await abrirRegistro(page)
  await context.setOffline(true)
  await registrar.getByLabel('Monto vendido').fill('10')
  await registrar.getByRole('button', { name: 'Revisar y guardar' }).click()
  await page.getByRole('dialog', { name: '¿Guardar esta venta?' }).getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(registrar.getByText('Guardado en el celular. Se enviará solo cuando vuelva el internet.')).toBeVisible()
  await expect(registrar.getByText('Por enviar', { exact: true })).toBeVisible()
  expect(llamadasA(sim, 'registrar_movimientos')).toHaveLength(0)

  await context.setOffline(false)
  await expect(registrar.getByText('Por enviar', { exact: true })).toHaveCount(0, { timeout: 15_000 })
  expect(llamadasA(sim, 'registrar_movimientos')).toHaveLength(1)
})

test('cierre de caja: si no cuadra pide una nota', async ({ page }) => {
  const sim = await simularSupabase(page)
  const registrar = await abrirRegistro(page)
  await registrar.getByRole('button', { name: 'Cierre' }).click()
  await registrar.getByLabel('Efectivo contado').fill('240')
  await expect(registrar.getByText(/Faltan/)).toContainText('$1.68')
  await registrar.getByRole('button', { name: 'Revisar y guardar' }).click()
  await expect(registrar.getByText('No cuadra: explica qué pasó antes de guardar.')).toBeVisible()
  await registrar.getByLabel('Nota: ¿por qué no cuadra?').fill('Se dio mal un cambio')
  await registrar.getByRole('button', { name: 'Revisar y guardar' }).click()
  await page.getByRole('dialog', { name: '¿Guardar el cierre de caja?' }).getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(registrar.getByText('Guardado. Ya está en el sistema.')).toBeVisible()
  expect(llamadasA(sim, 'registrar_cierre_caja')[0].cuerpo).toMatchObject({ p_contado: 240, p_nota: 'Se dio mal un cambio' })
})

test('con sesión se puede anular (con clave de administración)', async ({ page }) => {
  const sim = await simularSupabase(page)
  const registrar = await abrirRegistro(page)
  await registrar.getByRole('button', { name: 'Cerrar registrar' }).click()

  const historial = page.locator('#historial')
  const fila = esMovil(page) ? historial.locator('li', { hasText: 'Factura 123' }) : historial.locator('tr', { hasText: 'Factura 123' })
  await fila.getByRole('button', { name: 'Anular' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Anular movimiento' })
  await dialogo.getByLabel('Motivo').fill('Registrado dos veces')
  await dialogo.getByLabel('Tu nombre').fill('Efrén')
  await dialogo.getByLabel('Clave de administración').fill('mal')
  await dialogo.getByRole('button', { name: 'Anular movimiento' }).click()
  await expect(dialogo.getByText(/Clave incorrecta/)).toBeVisible()
  await dialogo.getByLabel('Clave de administración').fill('admin-123')
  await dialogo.getByRole('button', { name: 'Anular movimiento' }).click()
  await expect(page.getByText(/Movimiento anulado/)).toBeVisible()
  await expect(fila).toContainText('Anulado por Efrén')
  await expect(page.locator('#resumen')).toContainText('$286.68')
  expect(llamadasA(sim, 'anular_movimiento').at(-1)?.cuerpo).toMatchObject({ p_movimiento_id: 3 })
})

test('cerrar sesión: los números siguen a la vista y registrar vuelve a pedir la clave', async ({ page }) => {
  await simularSupabase(page)
  const registrar = await abrirRegistro(page)
  await registrar.getByRole('button', { name: 'Cerrar registrar' }).click()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page.locator('#resumen')).toContainText('$241.68')
  await page.getByRole('button', { name: 'Registrar', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Registra en la caja' })).toBeVisible()
})

test('si la Data API está apagada, explica qué hacer', async ({ page }) => {
  await simularSupabase(page, { apiCaida: true })
  await page.goto('/')
  await expect(page.getByText(/falta activar la Data API/).first()).toBeVisible({ timeout: 15_000 })
})
