// Calcula el hash bcrypt de la clave del bar o de la de administración, EN ESTA MÁQUINA,
// e imprime el SQL para pegarlo en Supabase > SQL Editor. La clave nunca sale de aquí
// ni queda en el historial de la terminal.
//
//   npm run clave          -> clave del bar (4 números)
//   npm run clave -- admin -> clave de administración (mínimo 6 caracteres)
import { createInterface } from 'node:readline'
import bcrypt from 'bcryptjs'

const esAdmin = process.argv[2] === 'admin'
const llave = esAdmin ? 'clave_admin_hash' : 'clave_bar_hash'
const nombre = esAdmin ? 'clave de administración' : 'clave del bar'

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
let oculto = false
// Oculta lo que se escribe (no muestra la clave en pantalla).
rl._writeToOutput = (texto) => {
  if (!oculto) rl.output.write(texto)
}

function preguntar(pregunta) {
  return new Promise((resolver) => {
    rl.output.write(pregunta)
    oculto = true
    rl.question('', (respuesta) => {
      oculto = false
      rl.output.write('\n')
      resolver(respuesta.trim())
    })
  })
}

const clave = await preguntar(`Escribe la ${nombre}: `)
const repetida = await preguntar('Escríbela otra vez: ')
rl.close()

if (clave !== repetida) {
  console.error('\nLas dos claves no coinciden. No se generó nada.')
  process.exit(1)
}
if (!esAdmin && !/^\d{4}$/.test(clave)) {
  console.error('\nLa clave del bar debe tener exactamente 4 números.')
  process.exit(1)
}
if (esAdmin && clave.length < 6) {
  console.error('\nLa clave de administración debe tener al menos 6 caracteres.')
  process.exit(1)
}

// pgcrypto verifica bcrypt con prefijo $2a$ (mismo algoritmo que $2b$).
const hash = bcrypt.hashSync(clave, 10).replace(/^\$2[by]\$/, '$2a$')

console.log(`\nPega esto en Supabase > SQL Editor y ejecútalo:\n`)
console.log(`update public.ajustes set valor = '${hash}', actualizado_en = now() where clave = '${llave}';\n`)
