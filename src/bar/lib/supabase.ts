import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Valores públicos del proyecto (la clave "publishable" está hecha para ir en el navegador;
// la seguridad la dan las RPC con clave y el RLS). Un .env con VITE_SUPABASE_* los reemplaza.
const URL_PROYECTO = 'https://mhvzuhpcguaresgibjei.supabase.co'
const CLAVE_PUBLICA = 'sb_publishable_fi5BPA5kho3AfhJsXCmy6w_foUeIMw2'

const url = import.meta.env.VITE_SUPABASE_URL || URL_PROYECTO
const clavePublica = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || CLAVE_PUBLICA

export const configurado = Boolean(url && clavePublica)

export const supabase = createClient<Database>(url, clavePublica)
