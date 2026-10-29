import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configurado } from './lib/supabase'
import { Panel } from './panel/Panel'

const clienteConsultas = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
})

function FaltaConfiguracion() {
  return (
    <main className="min-h-dvh bg-paper px-4 py-16">
      <div className="mx-auto max-w-xl rounded-2xl border border-line bg-sheet p-6">
        <h1 className="text-2xl font-bold">Falta conectar la app con Supabase</h1>
        <p className="mt-3 text-ink-2">
          Revisa <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (ver <code>docs/puesta-en-marcha.md</code>).
        </p>
      </div>
    </main>
  )
}

export default function App() {
  if (!configurado) return <FaltaConfiguracion />
  return (
    <QueryClientProvider client={clienteConsultas}>
      <Panel />
    </QueryClientProvider>
  )
}
