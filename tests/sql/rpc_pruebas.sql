-- =============================================================================
-- Pruebas de las RPC y la seguridad de la base (Caja del Bar).
--
-- Se ejecutan dentro de un bloque que SIEMPRE termina con error a propósito: así Postgres
-- revierte todo y no queda nada guardado (ni movimientos, ni claves de prueba, ni intentos).
--
--   Resultado correcto:  ERROR "RESULTADO: N pruebas OK (todo revertido, no quedó nada guardado)"
--   Si algo falla:       ERROR "assertion failed: <prueba>: <respuesta de la RPC>"
--
-- Cómo correrlo: con el agente tester-backend (execute_sql de Supabase) o pegándolo en el
-- SQL Editor. Nunca uses claves reales aquí: este bloque pone claves de prueba temporales.
-- =============================================================================
do $pruebas$
declare
  ok int := 0;
  r jsonb;
  hoy date := (now() at time zone 'America/Guayaquil')::date;
  dia_viejo date := (now() at time zone 'America/Guayaquil')::date - 3650; -- sin movimientos ni cierres
  c_venta smallint;
  c_compras smallint;
  c_pagos smallint;
  c_banco smallint;
  caja0 numeric;
  caja numeric;
  lote uuid := gen_random_uuid();
  id1 uuid := gen_random_uuid();
  id2 uuid := gen_random_uuid();
  id_cierre uuid := gen_random_uuid();
  mov_id bigint;
  i int;
begin
  select id into c_venta from public.categorias where nombre = 'Venta bar';
  select id into c_compras from public.categorias where nombre = 'Compras (factura)';
  select id into c_pagos from public.categorias where nombre = 'Pagos a personas';
  select id into c_banco from public.categorias where nombre = 'Transferencia al banco';

  -- Claves de prueba (solo existen dentro de esta transacción).
  update public.ajustes set valor = extensions.crypt('1234', extensions.gen_salt('bf', 4)) where clave = 'clave_bar_hash';
  update public.ajustes set valor = extensions.crypt('admin-123', extensions.gen_salt('bf', 4)) where clave = 'clave_admin_hash';
  update privado.intentos_clave set fallos = 0, bloqueado_hasta = null;
  select efectivo_en_caja into caja0 from public.v_caja;

  -- 1. Menú de categorías
  assert jsonb_array_length(public.obtener_categorias()) = 11, 'obtener_categorias debe devolver 11 categorías';
  ok := ok + 1;

  -- 2-3. Clave del bar
  r := public.resumen_caja('0000');
  assert r ->> 'codigo' = 'clave_invalida', 'clave incorrecta: ' || r;
  ok := ok + 1;
  r := public.resumen_caja('1234');
  assert (r ->> 'ok')::boolean and (r ->> 'efectivo_en_caja')::numeric = caja0, 'resumen con clave correcta: ' || r;
  ok := ok + 1;

  -- 3b. Panel del dashboard: público (decisión del usuario), no pide clave ni gasta intentos
  update privado.intentos_clave set fallos = 0 where ambito = 'bar';
  r := public.panel_publico();
  assert (select fallos from privado.intentos_clave where ambito = 'bar') = 0, 'panel_publico no debe tocar los intentos de clave';
  ok := ok + 1;
  assert (r ->> 'ok')::boolean
     and jsonb_array_length(r -> 'categorias') = 11
     and jsonb_array_length(r -> 'movimientos') = (select count(*) from public.movimientos)
     and (r -> 'caja' ->> 'efectivo_en_caja')::numeric = caja0, 'panel_publico trae categorías, todos los movimientos y la caja';
  ok := ok + 1;

  -- 4-8. Validaciones de registrar_movimientos
  r := public.registrar_movimientos('1234', 'Prueba', jsonb_build_array(jsonb_build_object(
    'id_cliente', gen_random_uuid(), 'fecha', hoy, 'categoria_id', c_venta, 'monto', 10)));
  assert r ->> 'codigo' = 'vendedor_requerido', 'venta sin vendedor: ' || r;
  ok := ok + 1;

  r := public.registrar_movimientos('1234', 'Prueba', jsonb_build_array(jsonb_build_object(
    'id_cliente', gen_random_uuid(), 'fecha', hoy, 'categoria_id', c_venta, 'monto', 2500, 'vendedor', 'Ana')));
  assert r ->> 'codigo' = 'monto_excede_limite', 'monto mayor a 2000: ' || r;
  ok := ok + 1;

  r := public.registrar_movimientos('1234', 'Prueba', jsonb_build_array(jsonb_build_object(
    'id_cliente', gen_random_uuid(), 'fecha', hoy + 1, 'categoria_id', c_compras, 'monto', 5)));
  assert r ->> 'codigo' = 'fecha_futura', 'fecha futura: ' || r;
  ok := ok + 1;

  r := public.registrar_movimientos('1234', 'Prueba', jsonb_build_array(jsonb_build_object(
    'id_cliente', gen_random_uuid(), 'fecha', hoy, 'categoria_id', c_pagos, 'monto', 20)));
  assert r ->> 'codigo' = 'descripcion_requerida', 'pago a personas sin descripción: ' || r;
  ok := ok + 1;

  r := public.registrar_movimientos('1234', 'Prueba', jsonb_build_array(jsonb_build_object(
    'id_cliente', gen_random_uuid(), 'fecha', hoy, 'categoria_id', c_compras, 'monto', 1.234)));
  assert r ->> 'codigo' = 'monto_decimales', 'monto con 3 decimales: ' || r;
  ok := ok + 1;

  -- 9-11. Lote (venta + gasto) e idempotencia por id_cliente
  r := public.registrar_movimientos('1234', 'Prueba', jsonb_build_array(
      jsonb_build_object('id_cliente', id1, 'fecha', hoy, 'categoria_id', c_venta, 'monto', 50, 'vendedor', 'Viviana'),
      jsonb_build_object('id_cliente', id2, 'fecha', hoy, 'categoria_id', c_compras, 'monto', 20, 'descripcion', 'Factura')),
    lote);
  assert (r ->> 'insertados')::int = 2 and (select count(*) from public.movimientos where lote_id = lote) = 2, 'lote de 2: ' || r;
  ok := ok + 1;

  select efectivo_en_caja into caja from public.v_caja;
  assert caja = caja0 + 30, format('caja después del lote: esperaba %s, hay %s', caja0 + 30, caja);
  ok := ok + 1;

  r := public.registrar_movimientos('1234', 'Prueba', jsonb_build_array(
      jsonb_build_object('id_cliente', id1, 'fecha', hoy, 'categoria_id', c_venta, 'monto', 50, 'vendedor', 'Viviana'),
      jsonb_build_object('id_cliente', id2, 'fecha', hoy, 'categoria_id', c_compras, 'monto', 20, 'descripcion', 'Factura')),
    lote);
  assert (r ->> 'insertados')::int = 0 and (r ->> 'duplicados')::int = 2
     and (select count(*) from public.movimientos where lote_id = lote) = 2, 'reenvío sin duplicar: ' || r;
  ok := ok + 1;

  -- 12. Transferencia mayor que el efectivo
  r := public.registrar_movimientos('1234', 'Prueba', jsonb_build_array(jsonb_build_object(
    'id_cliente', gen_random_uuid(), 'fecha', hoy, 'categoria_id', c_banco, 'monto', caja + 1)));
  assert r ->> 'codigo' = 'transferencia_excede_caja', 'transferencia > caja: ' || r;
  ok := ok + 1;

  -- 13-17. Anulación
  select id into mov_id from public.movimientos where id_cliente = id2;
  r := public.anular_movimiento('mal', mov_id, 'Duplicado', 'Prueba');
  assert r ->> 'codigo' = 'clave_invalida', 'anular con clave mala: ' || r;
  ok := ok + 1;

  r := public.anular_movimiento('admin-123', mov_id, ' ', 'Prueba');
  assert r ->> 'codigo' = 'motivo_invalido', 'anular sin motivo: ' || r;
  ok := ok + 1;

  r := public.anular_movimiento('admin-123', mov_id, 'Duplicado', 'Prueba');
  select efectivo_en_caja into caja from public.v_caja;
  assert (r ->> 'ok')::boolean and caja = caja0 + 50, 'anular devuelve el gasto a la caja: ' || r;
  ok := ok + 1;

  r := public.anular_movimiento('admin-123', mov_id, 'Otra vez', 'Prueba');
  assert r ->> 'codigo' = 'ya_anulado', 'anular dos veces: ' || r;
  ok := ok + 1;

  assert exists (select 1 from public.v_movimientos where id = mov_id and anulado and monto_caja = 0),
    'el anulado sigue visible en v_movimientos y no cuenta';
  ok := ok + 1;

  -- 18-19. Nadie edita ni borra movimientos
  begin
    update public.movimientos set monto = 1 where id = mov_id;
    assert false, 'dejó editar el monto de un movimiento';
  exception when restrict_violation then
    ok := ok + 1;
  end;

  -- El borrado no se ejecuta aquí (un hook lo prohíbe): se comprueba que el trigger cubre DELETE.
  assert exists (
    select 1 from pg_trigger
    where tgname = 'movimientos_proteger' and tgrelid = 'public.movimientos'::regclass and (tgtype & 8) <> 0
  ), 'falta el trigger que impide borrar movimientos';
  ok := ok + 1;

  -- 20-23. Cierre de caja (en un día viejo, sin movimientos: esperado = 0)
  r := public.registrar_cierre_caja('1234', 'Prueba', dia_viejo, 5, null, id_cierre);
  assert r ->> 'codigo' = 'nota_requerida', 'cierre con diferencia sin nota: ' || r;
  ok := ok + 1;

  r := public.registrar_cierre_caja('1234', 'Prueba', dia_viejo, 5, 'Sobró por prueba', id_cierre);
  assert (r ->> 'ok')::boolean and (r ->> 'diferencia')::numeric = 5, 'cierre con nota: ' || r;
  ok := ok + 1;

  r := public.registrar_cierre_caja('1234', 'Prueba', dia_viejo, 5, 'Sobró por prueba', id_cierre);
  assert (r ->> 'duplicado')::boolean, 'reenvío del mismo cierre: ' || r;
  ok := ok + 1;

  r := public.registrar_cierre_caja('1234', 'Prueba', dia_viejo, 0, null, gen_random_uuid());
  assert r ->> 'codigo' = 'cierre_existente', 'segundo cierre del mismo día: ' || r;
  ok := ok + 1;

  -- 24. Bloqueo tras 5 claves incorrectas
  update privado.intentos_clave set fallos = 0, bloqueado_hasta = null where ambito = 'bar';
  for i in 1..5 loop
    r := public.resumen_caja('9999');
  end loop;
  r := public.resumen_caja('1234');
  assert r ->> 'codigo' = 'bloqueado', 'bloqueo tras 5 fallos: ' || r;
  ok := ok + 1;

  -- 24b. Bloqueo de la clave de administración tras 5 fallos (anular es lo más sensible)
  update privado.intentos_clave set fallos = 0, bloqueado_hasta = null where ambito = 'admin';
  for i in 1..5 loop
    r := public.anular_movimiento('mal', mov_id, 'Prueba', 'Prueba');
  end loop;
  r := public.anular_movimiento('admin-123', mov_id, 'Prueba', 'Prueba');
  assert r ->> 'codigo' = 'bloqueado', 'bloqueo de la clave admin tras 5 fallos: ' || r;
  ok := ok + 1;

  -- 25-28. Permisos y RLS
  assert not has_table_privilege('anon', 'public.movimientos', 'select')
     and not has_table_privilege('anon', 'public.movimientos', 'insert')
     and not has_table_privilege('anon', 'public.ajustes', 'select'), 'anon no debe leer ni escribir tablas';
  ok := ok + 1;

  -- Intencional: el público (anon) ejecuta SOLO estas 6 RPC; las de escritura verifican la clave por dentro
  -- y panel_publico / obtener_categorias son lectura pública (decisión del usuario).
  -- (el aviso WARN *_security_definer_function_executable de Supabase es esperado por este diseño).
  assert has_function_privilege('anon', 'public.registrar_movimientos(text,text,jsonb,uuid)', 'execute')
     and has_function_privilege('anon', 'public.anular_movimiento(text,bigint,text,text)', 'execute')
     and has_function_privilege('anon', 'public.panel_publico()', 'execute')
     and has_function_privilege('anon', 'public.resumen_caja(text)', 'execute')
     and has_function_privilege('anon', 'public.registrar_cierre_caja(text,text,date,numeric,text,uuid)', 'execute')
     and has_function_privilege('anon', 'public.obtener_categorias()', 'execute')
     and not has_function_privilege('anon', 'privado.verificar_clave(text,text)', 'execute')
     and not exists (
       select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prosecdef
         and p.proname not in ('registrar_movimientos', 'anular_movimiento', 'panel_publico', 'resumen_caja', 'registrar_cierre_caja', 'obtener_categorias')
         and has_function_privilege('anon', p.oid, 'execute')
     ), 'permisos de funciones: anon solo debe ejecutar las 6 RPC con clave';
  ok := ok + 1;

  assert (select bool_and(relrowsecurity) from pg_class where oid in (
    'public.movimientos'::regclass, 'public.ajustes'::regclass, 'public.cierres_caja'::regclass, 'public.categorias'::regclass)),
    'RLS debe estar activo en las 4 tablas';
  ok := ok + 1;

  begin
    update public.ajustes set valor = '1234' where clave = 'clave_bar_hash';
    assert false, 'aceptó una clave en texto plano';
  exception when check_violation then
    ok := ok + 1;
  end;

  raise exception 'RESULTADO: % pruebas OK (todo revertido, no quedó nada guardado)', ok;
end
$pruebas$;
