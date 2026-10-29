import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/ibm-plex-sans'
import '@fontsource-variable/newsreader'
import './estilos.css'
import App from './App'

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
