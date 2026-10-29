---
name: integrar-componente-ui
description: Cómo integrar un componente React externo (21st.dev, shadcn/ui, plantillas pegadas en el chat) en la app del bar sin romper su diseño, accesibilidad ni el modo sin internet. Úsalo cuando el usuario pegue un componente o pida "usa este componente/login/diseño".
---

Basado en la integración del login (componente `sign-in-page` de 21st.dev y luego la referencia visual del usuario) → `src/bar/components/ui/sign-in-page.tsx`. Estilo vigente: tema blanco sobrio, títulos serif (Newsreader), botón principal negro, campos grises, foto con esquinas redondeadas; sin degradados (el usuario los rechazó).

## Dónde va

- Componentes reutilizables de UI en `src/bar/components/ui/` (convención de shadcn). Importar con el alias `@/components/ui/...` (configurado en `vite.config.ts` y `tsconfig.json`; `@` = `src/bar`).
- Si el componente trae una demo (`demo.tsx`), no se copia: se usa directamente en la pantalla real.

## Qué cambiar siempre

1. **Rutas**: la app usa rutas por hash (`#/`, `#/registrar`, `#/dashboard`). No instalar `react-router-dom`; reemplazar `useNavigate()` por enlaces `<a href="#/...">`.
2. **Funciones que no existen**: quitar botones de redes sociales (Google/GitHub), "crear cuenta", "recordarme", "olvidé mi contraseña" con enlaces vacíos, etc. Un botón que no hace nada es peor que no tenerlo. Si se quiere la función, se implementa de verdad (Supabase Auth) o se explica en texto qué hacer.
3. **Textos** en español, en lenguaje de quien usa la app (ver skill `frontend-design`, sección de escritura).
4. **Colores**: usar los tokens del sistema (`bg-sheet`, `text-ink`, `text-ink-2`, `border-line`, `bg-accion`, `text-pen`, `text-salida`…) definidos en `src/bar/estilos.css`. Colores fijos de Tailwind solo para superficies que son siempre oscuras (el degradado de marca `from-slate-900 via-blue-900 to-slate-800`).
5. **Íconos**: `lucide-react` (ya instalado), con `aria-hidden="true"` si van junto a texto, y `aria-label` si el botón es solo ícono.
6. **Imágenes**: nunca enlazar CDNs de terceros (la PWA funciona sin internet). Descargar a `public/` en WebP optimizado (≈1200px, <250 KB), con `width/height`, `alt` (vacío si es decorativa) y `loading="lazy"` si no está en la primera pantalla. Fuente sugerida: Unsplash (licencia libre); verificar con `curl` que la URL existe antes de usarla.
7. **Accesibilidad mínima**: cada campo con `<label>`; errores junto al campo con `role="alert"`; foco visible; objetivos táctiles ≥ 44px; `cursor-pointer` en lo clicable (ya global en `estilos.css`); respetar `prefers-reduced-motion`.
8. **Formularios**: `noValidate` + validación propia en español (ver `lib/validaciones.ts`); `autoComplete` correcto (`email`, `current-password`, `off` para claves del bar).

## Verificación obligatoria

1. `npm run typecheck && npm test`
2. `npm run test:e2e` (agregar o actualizar una prueba en `tests/e2e/` que use el componente).
3. Captura a 390px y a 1366px, modo claro y oscuro: sin desborde horizontal (`scrollWidth <= innerWidth`) ni texto cortado.
4. Explicar al usuario qué se adaptó y por qué (qué se quitó del original).
