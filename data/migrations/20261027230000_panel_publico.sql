-- =============================================================================
-- Bar Project - migración 20261027230000_panel_publico
-- Decisión del usuario (27-oct-2026): los números y filtros del dashboard se ven SIN login;
-- solo registrar (y anular) pide nombre + clave. Consecuencia aceptada: quien tenga el link
-- ve las finanzas del bar. Escribir sigue protegido: anon no toca tablas y cada RPC de
-- escritura verifica la clave (bar o admin) con bloqueo anti fuerza bruta.
-- Reemplaza a panel_caja(p_clave), que ya no se usa.
-- =============================================================================
drop function if exists public.panel_caja(text);

create or replace function public.panel_publico()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $fn$
  select jsonb_build_object(
    'ok', true,
    'hoy', (now() at time zone 'America/Guayaquil')::date,
    'caja', (
      select jsonb_build_object(
        'efectivo_en_caja', c.efectivo_en_caja,
        'fondo_caja', c.fondo_caja,
        'para_transferir', c.para_transferir
      )
      from public.v_caja c
    ),
    'categorias', (
      select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'tipo', c.tipo) order by c.id), '[]'::jsonb)
      from public.categorias c
    ),
    'movimientos', (
      select coalesce(jsonb_agg(to_jsonb(v) order by v.fecha, v.id), '[]'::jsonb)
      from public.v_movimientos v
    ),
    'cierres', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', k.id, 'fecha', k.fecha, 'contado', k.contado, 'esperado', k.esperado,
               'diferencia', k.diferencia, 'nota', k.nota, 'registrado_por', k.registrado_por
             ) order by k.fecha desc), '[]'::jsonb)
      from public.cierres_caja k
    )
  );
$fn$;

revoke all on function public.panel_publico() from public, anon, authenticated;
grant execute on function public.panel_publico() to anon, authenticated;
