-- =============================================================================
-- Bar Project - migración 20261027210000_dashboard_lectura
-- Lectura del dashboard (opción A): Supabase Auth solo para el dashboard.
--
-- * El formulario sigue usando anon + RPC (nada se abre a anon).
-- * El dashboard entra con un usuario de Supabase Auth creado a mano y marcado con
--   app_metadata.rol = 'dashboard' (app_metadata no lo puede editar el usuario).
-- * Solo SELECT. Escribir y anular sigue yendo por RPC.
-- * Realtime: movimientos y cierres_caja se publican; Realtime respeta estas políticas.
-- * Limpieza: índices duplicados/sobrantes de la migración inicial.
-- =============================================================================

-- 1. Políticas de solo lectura para el rol del dashboard
create policy dashboard_lee_movimientos on public.movimientos
  for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'rol') = 'dashboard');

create policy dashboard_lee_categorias on public.categorias
  for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'rol') = 'dashboard');

create policy dashboard_lee_cierres on public.cierres_caja
  for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'rol') = 'dashboard');

-- v_caja (security_invoker) lee el fondo desde ajustes: se expone SOLO esa fila, nunca los hashes.
create policy dashboard_lee_fondo on public.ajustes
  for select to authenticated
  using (
    clave = 'fondo_caja'
    and ((select auth.jwt()) -> 'app_metadata' ->> 'rol') = 'dashboard'
  );

grant select on
  public.movimientos, public.categorias, public.cierres_caja, public.ajustes,
  public.v_movimientos, public.v_caja
  to authenticated;

-- 2. Realtime (las vistas no emiten eventos: el dashboard escucha las tablas y recalcula)
do $realtime$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'movimientos'
  ) then
    alter publication supabase_realtime add table public.movimientos;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cierres_caja'
  ) then
    alter publication supabase_realtime add table public.cierres_caja;
  end if;
end
$realtime$;

-- 3. Índices sobrantes (avisos de rendimiento tras la migración anterior)
drop index if exists public.movimientos_categoria_idx;       -- idéntico a movimientos_categoria_id_idx
drop index if exists public.movimientos_registrado_por_idx;  -- era para la FK a perfiles, ya no existe
