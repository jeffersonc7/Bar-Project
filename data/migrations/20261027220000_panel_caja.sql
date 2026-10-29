-- =============================================================================
-- Bar Project - migración 20261027220000_panel_caja
-- El dashboard se abre directo y se desbloquea con nombre + clave del bar (decisión del
-- usuario, 27-oct-2026). Esta RPC entrega todo lo que el dashboard necesita, solo con la
-- clave correcta (misma verificación y bloqueo anti fuerza bruta que el formulario).
-- anon sigue sin acceso directo a las tablas. Las políticas de dashboard_lectura (login por
-- correo) quedan, pero la app ya no las usa.
-- =============================================================================
create or replace function public.panel_caja(p_clave text)
returns jsonb
language plpgsql
volatile -- no "stable": verificar_clave anota los intentos fallidos (escribe)
security definer
set search_path = ''
as $fn$
declare
  v_estado text;
  v_caja   public.v_caja%rowtype;
begin
  v_estado := privado.verificar_clave('bar', p_clave);
  if v_estado <> 'ok' then
    return privado.err_clave(v_estado);
  end if;

  select * into v_caja from public.v_caja;

  return jsonb_build_object(
    'ok', true,
    'hoy', (now() at time zone 'America/Guayaquil')::date,
    'caja', jsonb_build_object(
      'efectivo_en_caja', v_caja.efectivo_en_caja,
      'fondo_caja', v_caja.fondo_caja,
      'para_transferir', v_caja.para_transferir
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
end
$fn$;

revoke all on function public.panel_caja(text) from public, anon, authenticated;
grant execute on function public.panel_caja(text) to anon, authenticated;
