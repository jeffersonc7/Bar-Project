// Prueba la API publicada tal como la usa el celular (clave pública, rol anon).
// Solo lee o intenta operaciones que DEBEN ser rechazadas: no guarda nada y no gasta intentos de clave.
//   npm run probar:api
const URL_PROYECTO = process.env.VITE_SUPABASE_URL ?? 'https://mhvzuhpcguaresgibjei.supabase.co'
const CLAVE = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_fi5BPA5kho3AfhJsXCmy6w_foUeIMw2'
const cabeceras = { apikey: CLAVE, 'Content-Type': 'application/json' }

async function pedir(ruta, opciones = {}) {
  const r = await fetch(`${URL_PROYECTO}${ruta}`, { ...opciones, headers: { ...cabeceras, ...(opciones.headers ?? {}) } })
  const texto = await r.text()
  let cuerpo = texto
  try {
    cuerpo = JSON.parse(texto)
  } catch {
    // respuesta no JSON
  }
  return { status: r.status, cuerpo }
}

const apagada = (r) => r.status === 503 && /schema cache|PGRST002/i.test(JSON.stringify(r.cuerpo))
const SIN_API = 'no se puede comprobar: la Data API está apagada (PGRST002)'
const rechazado = (r) => (apagada(r) ? SIN_API : [401, 403].includes(r.status) || r.cuerpo?.code === '42501')

const pruebas = [
  ['La Data API responde y da las 11 categorías', async () => {
    const r = await pedir('/rest/v1/rpc/obtener_categorias', { method: 'POST', body: '{}' })
    if (apagada(r)) return 'la Data API está apagada (PGRST002): actívala en Supabase (docs/puesta-en-marcha.md, paso 1)'
    return Array.isArray(r.cuerpo) && r.cuerpo.length === 11 ? true : `respuesta inesperada ${r.status}: ${JSON.stringify(r.cuerpo).slice(0, 160)}`
  }],
  ['El panel público responde (dashboard sin login)', async () => {
    const r = await pedir('/rest/v1/rpc/panel_publico', { method: 'POST', body: '{}' })
    if (apagada(r)) return SIN_API
    return r.cuerpo?.ok === true && Array.isArray(r.cuerpo.movimientos) ? true : `respuesta inesperada ${r.status}: ${JSON.stringify(r.cuerpo).slice(0, 160)}`
  }],
  ['El público no puede leer la tabla de movimientos directamente', async () => {
    const r = await pedir('/rest/v1/movimientos?select=id&limit=1')
    const v = rechazado(r)
    return v === true || typeof v === 'string' ? v : `debía rechazar y respondió ${r.status}: ${JSON.stringify(r.cuerpo).slice(0, 160)}`
  }],
  ['El público no puede leer ajustes (hashes de claves)', async () => {
    const r = await pedir('/rest/v1/ajustes?select=*')
    const v = rechazado(r)
    return v === true || typeof v === 'string' ? v : `debía rechazar y respondió ${r.status}: ${JSON.stringify(r.cuerpo).slice(0, 160)}`
  }],
  ['El público no puede leer la caja directamente', async () => {
    const r = await pedir('/rest/v1/v_caja?select=*')
    const v = rechazado(r)
    return v === true || typeof v === 'string' ? v : `debía rechazar y respondió ${r.status}: ${JSON.stringify(r.cuerpo).slice(0, 160)}`
  }],
  ['El público no puede insertar movimientos sin RPC', async () => {
    const r = await pedir('/rest/v1/movimientos', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ fecha: '2026-01-01', categoria_id: 1, monto: 1, registrado_por: 'prueba', vendedor: 'prueba' }),
    })
    const v = rechazado(r)
    return v === true || typeof v === 'string' ? v : `debía rechazar y respondió ${r.status}: ${JSON.stringify(r.cuerpo).slice(0, 160)}`
  }],
  ['Las funciones internas (schema privado) no están expuestas', async () => {
    const r = await pedir('/rest/v1/rpc/verificar_clave', { method: 'POST', body: JSON.stringify({ p_ambito: 'bar', p_clave: 'x' }) })
    if (apagada(r)) return SIN_API
    return r.status === 404 || rechazado(r) === true || `respondió ${r.status}: ${JSON.stringify(r.cuerpo).slice(0, 160)}`
  }],
  ['Auth responde (login del dashboard)', async () => {
    const r = await pedir('/auth/v1/settings')
    if (r.status !== 200) return `Auth respondió ${r.status}`
    return r.cuerpo?.disable_signup ? true : 'aviso: el registro público de cuentas está ACTIVADO; desactívalo (docs/puesta-en-marcha.md, paso 4)'
  }],
]

let fallos = 0
for (const [nombre, prueba] of pruebas) {
  try {
    const resultado = await prueba()
    if (resultado === true) {
      console.log(`  ✓ ${nombre}`)
    } else {
      fallos += 1
      console.log(`  ✗ ${nombre}\n      ${resultado}`)
    }
  } catch (error) {
    fallos += 1
    console.log(`  ✗ ${nombre}\n      sin conexión: ${error.message}`)
  }
}
console.log(fallos ? `\n${fallos} de ${pruebas.length} con problemas.` : `\nTodo bien: ${pruebas.length} pruebas.`)
process.exit(fallos ? 1 : 0)
