-- =============================================================================
-- Bar Project - migración 20261027200000_cambios_formulario
-- Proyecto Supabase: mhvzuhpcguaresgibjei
-- Fuente de verdad: docs/especificacion-formulario.md + skill reglas-bar.
--
-- NO APLICADA. Se aplica solo cuando la sesión principal lo pida.
--
-- Qué hace
--   1. categorias: lista cerrada nueva (tipo 'transferencia'); 2 columnas de reglas.
--   2. movimientos: quita metodo_pago, registrado_por -> text, agrega vendedor,
--      lote_id, id_cliente, columnas de anulación; límites y triggers de integridad.
--      Conserva fuente / imagen_origen / revisar / nota_revision (histórico del cuaderno).
--   3. Elimina detalle_venta, perfiles, trigger crear_perfil y su función.
--   4. cierres_caja, ajustes (fondo_caja + hashes de claves SIN valor).
--   5. Vistas v_movimientos y v_caja (security_invoker). El saldo nunca se guarda.
--   6. Seguridad: RLS activo sin políticas; anon/authenticated sin acceso a tablas ni
--      vistas. Todo el acceso va por RPC (SECURITY DEFINER, search_path vacío).
--   7. Índices.
--
-- RPC públicas (todas devuelven jsonb {ok: true, ...} o {ok: false, codigo, mensaje, ...};
-- los errores de clave NO lanzan excepción porque hay que persistir el contador de intentos)
--   obtener_categorias()                                            sin clave (lista pública del menú)
--   resumen_caja(p_clave)                                           clave del bar
--   registrar_movimientos(p_clave, p_registrado_por, p_movimientos, p_lote_id)  clave del bar
--   registrar_cierre_caja(p_clave, p_registrado_por, p_fecha, p_contado, p_nota, p_id_cliente)  clave del bar
--   anular_movimiento(p_clave_admin, p_movimiento_id, p_motivo, p_anulado_por)  clave de admin
--
-- Formato de p_movimientos (array json, 1 a 50 elementos), cada elemento:
--   {id_cliente uuid, fecha 'YYYY-MM-DD', categoria_id int, monto number,
--    descripcion text?, vendedor text?}
--   El cliente debe enviar SIEMPRE el mismo id_cliente y el mismo p_lote_id al reintentar
--   un envío (offline): las filas ya guardadas se omiten y se cuentan en "duplicados".
--
-- Códigos de error: clave_invalida, bloqueado, clave_no_configurada, datos_invalidos,
--   id_cliente_requerido, id_cliente_repetido, fecha_requerida, fecha_futura,
--   categoria_invalida, monto_invalido, monto_excede_limite, monto_decimales,
--   descripcion_requerida, descripcion_larga, vendedor_requerido, vendedor_largo,
--   transferencia_excede_caja, nombre_invalido, nota_requerida, cierre_existente,
--   movimiento_no_existe, ya_anulado, motivo_invalido, error_guardado.
--
-- CLAVES (bar y admin) - cómo se fijan, FUERA del repo
--   Esta migración deja clave_bar_hash y clave_admin_hash en NULL. Mientras sean NULL
--   las RPC con clave responden 'clave_no_configurada' (cerrado por defecto).
--   Recomendado: calcular el hash en tu máquina y pegar solo el hash, así la clave en
--   texto plano no pasa por el historial de consultas del Dashboard:
--       htpasswd -nbBC 10 x '<CLAVE>' | cut -d: -f2 | sed 's/^\$2y\$/$2a$/'
--   y luego, en el SQL Editor (solo el hash):
--       update public.ajustes set valor = '<HASH_BCRYPT>' where clave = 'clave_bar_hash';
--       update public.ajustes set valor = '<HASH_BCRYPT>' where clave = 'clave_admin_hash';
--   El CHECK ajustes_hash_check rechaza cualquier valor que no sea un hash bcrypt, así
--   que una clave en texto plano no puede guardarse por error.
--   Anti fuerza bruta (clave de 4 dígitos = 10 000 combinaciones): 5 fallos seguidos
--   bloquean ese ámbito 15 minutos (privado.verificar_clave). El bloqueo es global, no por
--   IP: un atacante podría bloquear el registro 15 min (los envíos quedan en cola offline).
--
-- CUESTIÓN ABIERTA: lectura del dashboard y Realtime (ver bloque comentado al final).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. Prerrequisitos y guardas (si algo falla, la migración entera se revierte)
-- -----------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

do $guarda$
begin
  if to_regprocedure('extensions.crypt(text,text)') is null
     or to_regprocedure('extensions.gen_salt(text,integer)') is null then
    raise exception 'pgcrypto no está en el schema extensions; ajustar las llamadas a crypt/gen_salt.';
  end if;

  -- Esta migración cambia tipos y restricciones de movimientos: solo es segura con la tabla vacía.
  if exists (select 1 from public.movimientos) then
    raise exception 'movimientos tiene filas; esta migración asume la tabla vacía. Abortando sin cambios.';
  end if;
end
$guarda$;


-- -----------------------------------------------------------------------------
-- 1. Limpieza de lo viejo (perfiles, detalle_venta, trigger, políticas, vista)
-- -----------------------------------------------------------------------------

-- 1a. Políticas previas (pueden depender de perfiles). El nuevo modelo no usa políticas.
do $politicas$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('categorias', 'movimientos', 'detalle_venta', 'perfiles')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$politicas$;

-- 1b. Trigger crear_perfil (sobre auth.users) y su función, sin asumir el nombre de la función.
do $trigger$
declare
  r record;
begin
  for r in
    select t.tgname,
           t.tgrelid::regclass as tabla,
           t.tgfoid::regprocedure as funcion
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where not t.tgisinternal
      and (t.tgname = 'crear_perfil' or p.proname = 'crear_perfil')
  loop
    execute format('drop trigger %I on %s', r.tgname, r.tabla);
    -- Sin CASCADE: si otro objeto usa la función, la migración falla en vez de romperlo.
    execute format('drop function if exists %s', r.funcion);
  end loop;
end
$trigger$;

-- 1c. Vista vieja (se recrea más abajo); depende de metodo_pago / registrado_por.
drop view if exists public.v_movimientos;

-- 1d. Tablas sin uso. detalle_venta referencia a movimientos; perfiles es referenciada por registrado_por.
drop table if exists public.detalle_venta;
alter table public.movimientos drop constraint if exists movimientos_registrado_por_fkey;
drop table if exists public.perfiles;


-- -----------------------------------------------------------------------------
-- 2. categorias: lista cerrada de la especificación
-- -----------------------------------------------------------------------------
-- Ninguna fila de movimientos las referencia (guarda de arriba; además la FK lo impediría).
delete from public.categorias;
alter table public.categorias alter column id restart with 1;

-- Reemplaza el CHECK de tipo (deposito -> transferencia) sin depender del nombre del constraint.
do $tipo$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.categorias'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%tipo%'
  loop
    execute format('alter table public.categorias drop constraint %I', r.conname);
  end loop;
end
$tipo$;

alter table public.categorias
  add constraint categorias_tipo_check check (tipo in ('ingreso', 'gasto', 'transferencia')),
  -- Reglas del formulario guardadas como datos (las RPC las leen; no hay nombres "mágicos" en el código).
  add column requiere_descripcion boolean not null default false,
  add column requiere_vendedor    boolean not null default false;

insert into public.categorias (nombre, tipo, requiere_descripcion, requiere_vendedor) values
  -- Ingresos
  ('Venta bar',                                                       'ingreso',       false, true),
  ('Entrega',                                                         'ingreso',       true,  false),
  ('Donación',                                                        'ingreso',       true,  false),
  ('Otro ingreso',                                                    'ingreso',       true,  false),
  -- Gastos
  ('Compras (factura)',                                               'gasto',         false, false),
  ('Refrigerio (pan, pasteles, colas)',                               'gasto',         false, false),
  ('Eventos y celebraciones (agasajos)',                              'gasto',         false, false),
  ('Materiales (palas, cuadernos, papeles, cartulinas, borradores)',  'gasto',         false, false),
  ('Pagos a personas',                                                'gasto',         true,  false),
  ('Otro gasto',                                                      'gasto',         true,  false),
  -- Transferencia
  ('Transferencia al banco',                                          'transferencia', false, false);


-- -----------------------------------------------------------------------------
-- 3. movimientos
-- -----------------------------------------------------------------------------
alter table public.movimientos drop column metodo_pago;   -- su CHECK se va con la columna

alter table public.movimientos
  alter column registrado_por drop default,
  alter column registrado_por type text using registrado_por::text,
  alter column registrado_por set not null,
  alter column monto type numeric(10, 2);   -- 2 decimales máximo (USD)

alter table public.movimientos
  add column vendedor           text,
  add column lote_id            uuid,
  add column id_cliente         uuid,
  add column anulado            boolean not null default false,
  add column motivo_anulacion   text,
  add column anulado_por        text,
  add column anulado_en         timestamptz;

alter table public.movimientos
  add constraint movimientos_id_cliente_key unique (id_cliente),   -- varios NULL permitidos (histórico)
  add constraint movimientos_monto_max_check check (monto <= 2000),
  add constraint movimientos_registrado_por_check check (btrim(registrado_por) <> ''),
  add constraint movimientos_vendedor_check check (vendedor is null or btrim(vendedor) <> ''),
  -- Anulado => motivo, quién y cuándo. No anulado => esos campos vacíos.
  add constraint movimientos_anulacion_check check (
    anulado = false
    or (nullif(btrim(motivo_anulacion), '') is not null and anulado_por is not null and anulado_en is not null)
  ),
  add constraint movimientos_anulacion_vacia_check check (
    anulado = true
    or (motivo_anulacion is null and anulado_por is null and anulado_en is null)
  );


-- -----------------------------------------------------------------------------
-- 4. Schema privado (no expuesto por la API) y utilidades internas
-- -----------------------------------------------------------------------------
create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;

-- Intentos fallidos por clave (anti fuerza bruta). Solo lo toca privado.verificar_clave.
create table privado.intentos_clave (
  ambito          text primary key check (ambito in ('bar', 'admin')),
  fallos          smallint not null default 0,
  bloqueado_hasta timestamptz
);
alter table privado.intentos_clave enable row level security;
revoke all on table privado.intentos_clave from public, anon, authenticated;
insert into privado.intentos_clave (ambito) values ('bar'), ('admin');

-- Respuesta de error uniforme.
create or replace function privado.err(p_codigo text, p_mensaje text, p_extra jsonb default '{}'::jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $fn$
  select jsonb_build_object('ok', false, 'codigo', p_codigo, 'mensaje', p_mensaje)
         || coalesce(p_extra, '{}'::jsonb);
$fn$;

-- Traduce el estado de verificar_clave a una respuesta de error.
create or replace function privado.err_clave(p_estado text)
returns jsonb
language sql
stable
set search_path = ''
as $fn$
  select case p_estado
    when 'bloqueado'            then privado.err('bloqueado', 'Demasiados intentos fallidos. Espera unos minutos.')
    when 'clave_no_configurada' then privado.err('clave_no_configurada', 'La clave aún no está configurada.')
    else                             privado.err('clave_invalida', 'Clave incorrecta.')
  end;
$fn$;

-- Verifica una clave contra su hash bcrypt en ajustes. Devuelve 'ok' | 'clave_invalida' |
-- 'bloqueado' | 'clave_no_configurada'. 5 fallos seguidos => bloqueo de 15 minutos.
-- Bloquea la fila del ámbito hasta el fin de la transacción (serializa; volumen bajo).
create or replace function privado.verificar_clave(p_ambito text, p_clave text)
returns text
language plpgsql
set search_path = ''
as $fn$
declare
  c_max_fallos constant int      := 5;
  c_bloqueo    constant interval := interval '15 minutes';
  v_hash  text;
  v_fila  privado.intentos_clave%rowtype;
begin
  if p_ambito not in ('bar', 'admin') then
    raise exception 'ámbito de clave desconocido';
  end if;

  select * into v_fila from privado.intentos_clave where ambito = p_ambito for update;

  if v_fila.bloqueado_hasta is not null and v_fila.bloqueado_hasta > now() then
    return 'bloqueado';
  end if;

  select valor into v_hash from public.ajustes where clave = 'clave_' || p_ambito || '_hash';
  if v_hash is null then
    return 'clave_no_configurada';
  end if;

  if p_clave is not null and p_clave <> '' and v_hash = extensions.crypt(p_clave, v_hash) then
    update privado.intentos_clave
       set fallos = 0, bloqueado_hasta = null
     where ambito = p_ambito;
    return 'ok';
  end if;

  update privado.intentos_clave
     set fallos = case when fallos + 1 >= c_max_fallos then 0 else fallos + 1 end,
         bloqueado_hasta = case when fallos + 1 >= c_max_fallos then now() + c_bloqueo else null end
   where ambito = p_ambito;
  return 'clave_invalida';
end
$fn$;

-- Integridad de movimientos (defensa en profundidad: aplica también a cargas hechas por el dueño).
--  * vendedor obligatorio si la categoría lo exige Y fuente = 'formulario' (el cuaderno histórico queda exento).
--  * vendedor solo en categorías que lo usan (Venta bar).
create or replace function privado.validar_movimiento()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare
  v_requiere boolean;
begin
  select requiere_vendedor into v_requiere from public.categorias where id = new.categoria_id;

  if v_requiere and new.fuente = 'formulario' and nullif(btrim(new.vendedor), '') is null then
    raise exception 'El vendedor es obligatorio en las ventas del formulario.' using errcode = 'check_violation';
  end if;
  if not coalesce(v_requiere, false) and new.vendedor is not null then
    raise exception 'El vendedor solo aplica a la categoría de ventas.' using errcode = 'check_violation';
  end if;
  return new;
end
$fn$;

-- Nadie borra movimientos y los campos contables no se editan: se anula y se registra de nuevo.
-- Sí se permite: descripcion, vendedor, revisar, nota_revision, imagen_origen y anulado false -> true.
create or replace function privado.proteger_movimiento()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'Los movimientos no se borran: se anulan con anular_movimiento().'
      using errcode = 'restrict_violation';
  end if;

  if new.id            is distinct from old.id
     or new.fecha        is distinct from old.fecha
     or new.categoria_id is distinct from old.categoria_id
     or new.monto        is distinct from old.monto
     or new.lote_id      is distinct from old.lote_id
     or new.id_cliente   is distinct from old.id_cliente
     or new.registrado_por is distinct from old.registrado_por
     or new.fuente       is distinct from old.fuente
     or new.creado_en    is distinct from old.creado_en then
    raise exception 'Fecha, categoría, monto y autoría de un movimiento no se editan: anúlalo y regístralo de nuevo.'
      using errcode = 'restrict_violation';
  end if;

  if old.anulado and (
       not new.anulado
       or new.motivo_anulacion is distinct from old.motivo_anulacion
       or new.anulado_por      is distinct from old.anulado_por
       or new.anulado_en       is distinct from old.anulado_en) then
    raise exception 'Un movimiento anulado no se modifica ni se reactiva.'
      using errcode = 'restrict_violation';
  end if;

  return new;
end
$fn$;

create trigger movimientos_validar
  before insert or update on public.movimientos
  for each row execute function privado.validar_movimiento();

create trigger movimientos_proteger
  before update or delete on public.movimientos
  for each row execute function privado.proteger_movimiento();

revoke execute on all functions in schema privado from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 5. cierres_caja
-- -----------------------------------------------------------------------------
create table public.cierres_caja (
  id             bigint generated always as identity primary key,
  fecha          date          not null,
  contado        numeric(10,2) not null check (contado >= 0),
  esperado       numeric(12,2) not null,
  diferencia     numeric(12,2) generated always as (contado - esperado) stored,
  nota           text,
  registrado_por text          not null check (btrim(registrado_por) <> ''),
  id_cliente     uuid,
  creado_en      timestamptz   not null default now(),
  constraint cierres_caja_fecha_key unique (fecha),               -- un cierre por día
  constraint cierres_caja_id_cliente_key unique (id_cliente),     -- idempotencia offline
  -- Si hay diferencia, la nota es obligatoria.
  constraint cierres_caja_nota_check check (
    contado = esperado or nullif(btrim(nota), '') is not null
  )
);
alter table public.cierres_caja enable row level security;


-- -----------------------------------------------------------------------------
-- 6. ajustes (fondo de caja y hashes de claves)
-- -----------------------------------------------------------------------------
create table public.ajustes (
  clave          text primary key,
  valor          text,
  actualizado_en timestamptz not null default now(),
  constraint ajustes_clave_check check (clave in ('fondo_caja', 'clave_bar_hash', 'clave_admin_hash')),
  constraint ajustes_fondo_check check (
    clave <> 'fondo_caja' or coalesce(valor ~ '^[0-9]{1,6}(\.[0-9]{1,2})?$', false)
  ),
  -- Solo hashes bcrypt ($2a$/$2b$/$2x$/$2y$, costo de 2 dígitos, 53 caracteres): nunca texto plano.
  constraint ajustes_hash_check check (
    clave not in ('clave_bar_hash', 'clave_admin_hash')
    or valor is null
    or valor ~ '^\$2[abxy]\$[0-9]{2}\$[./A-Za-z0-9]{53}$'
  )
);
alter table public.ajustes enable row level security;

-- Las claves quedan SIN valor a propósito. Ver cómo fijarlas en el encabezado.
insert into public.ajustes (clave, valor) values
  ('fondo_caja', '150'),
  ('clave_bar_hash', null),
  ('clave_admin_hash', null);


-- -----------------------------------------------------------------------------
-- 7. Vistas (el saldo nunca se guarda). security_invoker: respetan el RLS del llamador.
-- -----------------------------------------------------------------------------

-- Historial completo: incluye anulados (siguen visibles). monto_caja es 0 si está anulado,
-- así el dashboard puede sumar monto_caja sin filtrar.
create view public.v_movimientos with (security_invoker = true) as
select
  m.id,
  m.fecha,
  m.categoria_id,
  c.nombre as categoria,
  c.tipo,
  m.monto,
  case when c.tipo = 'ingreso' then m.monto else -m.monto end as monto_firmado,
  case when m.anulado then 0::numeric
       when c.tipo = 'ingreso' then m.monto
       else -m.monto end as monto_caja,
  m.descripcion,
  m.vendedor,
  m.registrado_por,
  m.lote_id,
  m.fuente,
  m.revisar,
  m.nota_revision,
  m.anulado,
  m.motivo_anulacion,
  m.anulado_por,
  m.anulado_en,
  m.creado_en
from public.movimientos m
join public.categorias c on c.id = m.categoria_id;

-- Caja: ingreso suma; gasto y transferencia restan; anulados excluidos; histórico completo.
create view public.v_caja with (security_invoker = true) as
select
  s.efectivo_en_caja,
  f.fondo_caja,
  greatest(0, s.efectivo_en_caja - f.fondo_caja) as para_transferir
from (
  select coalesce(sum(case c.tipo when 'ingreso' then m.monto else -m.monto end), 0)::numeric(12,2)
           as efectivo_en_caja
  from public.movimientos m
  join public.categorias c on c.id = m.categoria_id
  where not m.anulado
) s
cross join (
  select coalesce((select a.valor::numeric from public.ajustes a where a.clave = 'fondo_caja'), 0)::numeric(10,2)
           as fondo_caja
) f;


-- -----------------------------------------------------------------------------
-- 8. Índices
-- -----------------------------------------------------------------------------
-- La migración inicial ya creó algunos índices con estos nombres: se recrean con la definición nueva.
drop index if exists public.movimientos_fecha_idx;
drop index if exists public.movimientos_categoria_id_idx;
drop index if exists public.movimientos_creado_en_idx;
drop index if exists public.movimientos_lote_id_idx;
drop index if exists public.movimientos_activos_idx;

create index movimientos_fecha_idx        on public.movimientos (fecha desc);
create index movimientos_categoria_id_idx on public.movimientos (categoria_id);            -- FK
create index movimientos_creado_en_idx    on public.movimientos (creado_en desc, id desc); -- últimos registros
create index movimientos_lote_id_idx      on public.movimientos (lote_id) where lote_id is not null;
-- Sumas de caja/dashboard: solo filas activas; cubre fecha, categoría y monto.
create index movimientos_activos_idx      on public.movimientos (fecha) include (categoria_id, monto) where not anulado;
-- id_cliente y cierres_caja.fecha / id_cliente ya tienen índice por su UNIQUE.


-- -----------------------------------------------------------------------------
-- 9. RPC públicas (SECURITY DEFINER, search_path vacío, nombres calificados)
-- -----------------------------------------------------------------------------

-- 9a. Menú de categorías (dato no sensible, sin clave).
create or replace function public.obtener_categorias()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id,
           'nombre', c.nombre,
           'tipo', c.tipo,
           'requiere_descripcion', c.requiere_descripcion,
           'requiere_vendedor', c.requiere_vendedor
         ) order by c.id), '[]'::jsonb)
  from public.categorias c
  where c.activa;
$fn$;

-- 9b. Datos de la pantalla principal del formulario: caja, para transferir, 5 últimos registros
--     del formulario y aviso de cierre pendiente del día anterior.
create or replace function public.resumen_caja(p_clave text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_estado   text;
  v_hoy      date := (now() at time zone 'America/Guayaquil')::date;
  v_ayer     date := ((now() at time zone 'America/Guayaquil')::date - 1);
  v_caja     public.v_caja%rowtype;
  v_ultimos  jsonb;
  v_pend     date;
begin
  v_estado := privado.verificar_clave('bar', p_clave);
  if v_estado <> 'ok' then
    return privado.err_clave(v_estado);
  end if;

  select * into v_caja from public.v_caja;

  select coalesce(jsonb_agg(to_jsonb(u) order by u.creado_en desc, u.id desc), '[]'::jsonb)
    into v_ultimos
  from (
    select m.id, m.fecha, c.nombre as categoria, c.tipo, m.monto, m.descripcion,
           m.vendedor, m.registrado_por, m.creado_en
    from public.movimientos m
    join public.categorias c on c.id = m.categoria_id
    where not m.anulado and m.fuente = 'formulario'
    order by m.creado_en desc, m.id desc
    limit 5
  ) u;

  -- Día anterior con movimientos activos y sin cierre.
  if exists (select 1 from public.movimientos m where m.fecha = v_ayer and not m.anulado)
     and not exists (select 1 from public.cierres_caja k where k.fecha = v_ayer) then
    v_pend := v_ayer;
  end if;

  return jsonb_build_object(
    'ok', true,
    'hoy', v_hoy,
    'efectivo_en_caja', v_caja.efectivo_en_caja,
    'fondo_caja', v_caja.fondo_caja,
    'para_transferir', v_caja.para_transferir,
    'ultimos', v_ultimos,
    'cierre_pendiente', v_pend
  );
end
$fn$;

-- 9c. Registrar uno o varios movimientos (un envío = un lote). Todo o nada.
create or replace function public.registrar_movimientos(
  p_clave           text,
  p_registrado_por  text,
  p_movimientos     jsonb,
  p_lote_id         uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_estado  text;
  v_nombre  text := nullif(btrim(p_registrado_por), '');
  v_hoy     date := (now() at time zone 'America/Guayaquil')::date;
  v_lote    uuid := coalesce(p_lote_id, gen_random_uuid());
  v_item    jsonb;
  v_i       int := 0;
  v_id      uuid;
  v_fecha   date;
  v_catid   smallint;
  v_monto   numeric;
  v_desc    text;
  v_vend    text;
  v_cat     public.categorias%rowtype;
  v_ids     uuid[] := '{}';
  v_filas   jsonb := '[]'::jsonb;
  v_nuevas  int := 0;
  v_dups    int := 0;
  v_ins     int := 0;
  v_transf  numeric := 0;
  v_caja    numeric;
begin
  v_estado := privado.verificar_clave('bar', p_clave);
  if v_estado <> 'ok' then
    return privado.err_clave(v_estado);
  end if;

  -- Serializa escrituras que dependen del saldo (transferencia <= efectivo en caja).
  perform pg_advisory_xact_lock(hashtext('bar:caja'));

  if v_nombre is null or length(v_nombre) > 60 then
    return privado.err('nombre_invalido', 'Indica quién registra (máx. 60 caracteres).');
  end if;
  if jsonb_typeof(p_movimientos) is distinct from 'array'
     or jsonb_array_length(p_movimientos) not between 1 and 50 then
    return privado.err('datos_invalidos', 'p_movimientos debe ser un arreglo de 1 a 50 movimientos.');
  end if;

  -- Fase 1: validar TODO antes de escribir nada.
  for v_item in select value from jsonb_array_elements(p_movimientos) loop
    v_i := v_i + 1;

    begin
      if jsonb_typeof(v_item) <> 'object' then
        return privado.err('datos_invalidos', 'Cada movimiento debe ser un objeto.', jsonb_build_object('indice', v_i));
      end if;
      v_id    := (v_item ->> 'id_cliente')::uuid;
      v_fecha := (v_item ->> 'fecha')::date;
      v_catid := (v_item ->> 'categoria_id')::smallint;
      v_monto := (v_item ->> 'monto')::numeric;
    exception when others then
      return privado.err('datos_invalidos', 'Formato de datos incorrecto.', jsonb_build_object('indice', v_i));
    end;

    if v_id is null then
      return privado.err('id_cliente_requerido', 'Falta id_cliente.', jsonb_build_object('indice', v_i));
    end if;
    if v_id = any (v_ids) then
      return privado.err('id_cliente_repetido', 'id_cliente repetido en el envío.', jsonb_build_object('indice', v_i));
    end if;
    v_ids := v_ids || v_id;

    if v_fecha is null or not isfinite(v_fecha) then
      return privado.err('fecha_requerida', 'La fecha es obligatoria.', jsonb_build_object('indice', v_i));
    end if;
    if v_fecha > v_hoy then
      return privado.err('fecha_futura', 'La fecha no puede ser futura.', jsonb_build_object('indice', v_i));
    end if;

    select * into v_cat from public.categorias where id = v_catid and activa;
    if not found then
      return privado.err('categoria_invalida', 'Categoría inexistente o inactiva.', jsonb_build_object('indice', v_i));
    end if;

    -- NaN se rechaza solo: en Postgres NaN > cualquier número, así que falla el tope de 2000.
    if v_monto is null or v_monto <= 0 then
      return privado.err('monto_invalido', 'El monto debe ser mayor que 0.', jsonb_build_object('indice', v_i));
    end if;
    if v_monto > 2000 then
      return privado.err('monto_excede_limite', 'El monto no puede superar 2000 (¿falta el punto decimal?).', jsonb_build_object('indice', v_i));
    end if;
    if v_monto <> round(v_monto, 2) then
      return privado.err('monto_decimales', 'El monto admite máximo 2 decimales.', jsonb_build_object('indice', v_i));
    end if;

    v_desc := nullif(btrim(v_item ->> 'descripcion'), '');
    if v_desc is not null and length(v_desc) > 500 then
      return privado.err('descripcion_larga', 'La descripción admite máximo 500 caracteres.', jsonb_build_object('indice', v_i));
    end if;
    if v_cat.requiere_descripcion and v_desc is null then
      return privado.err('descripcion_requerida', 'Esta categoría requiere descripción.', jsonb_build_object('indice', v_i));
    end if;

    if v_cat.requiere_vendedor then
      v_vend := nullif(btrim(v_item ->> 'vendedor'), '');
      if v_vend is null then
        return privado.err('vendedor_requerido', 'Indica quién vendió.', jsonb_build_object('indice', v_i));
      end if;
      if length(v_vend) > 60 then
        return privado.err('vendedor_largo', 'El nombre del vendedor admite máximo 60 caracteres.', jsonb_build_object('indice', v_i));
      end if;
    else
      v_vend := null;
    end if;

    -- Reenvío: si ya existe, se omite (no cuenta para la validación de caja).
    if exists (select 1 from public.movimientos where id_cliente = v_id) then
      v_dups := v_dups + 1;
      continue;
    end if;

    if v_cat.tipo = 'transferencia' then
      v_transf := v_transf + v_monto;
    end if;
    v_nuevas := v_nuevas + 1;
    v_filas := v_filas || jsonb_build_object(
      'id_cliente', v_id, 'fecha', v_fecha, 'categoria_id', v_catid,
      'monto', v_monto, 'descripcion', v_desc, 'vendedor', v_vend);
  end loop;

  -- Una transferencia no puede superar el efectivo en caja (conservador: suma de las
  -- transferencias nuevas del envío contra la caja ANTES del envío).
  if v_transf > 0 then
    select efectivo_en_caja into v_caja from public.v_caja;
    if v_transf > v_caja then
      return privado.err('transferencia_excede_caja',
        'La transferencia supera el efectivo en caja.',
        jsonb_build_object('efectivo_en_caja', v_caja));
    end if;
  end if;

  -- Fase 2: escribir. Subtransacción: si algo falla, no queda nada a medias.
  if v_nuevas > 0 then
    begin
      insert into public.movimientos
        (fecha, categoria_id, monto, descripcion, vendedor, registrado_por, lote_id, id_cliente, fuente)
      select f.fecha, f.categoria_id, f.monto, f.descripcion, f.vendedor,
             v_nombre, v_lote, f.id_cliente, 'formulario'
      from jsonb_to_recordset(v_filas)
           as f(fecha date, categoria_id smallint, monto numeric, descripcion text, vendedor text, id_cliente uuid)
      on conflict (id_cliente) do nothing;
      get diagnostics v_ins = row_count;
    exception when others then
      return privado.err('error_guardado', 'No se pudo guardar. Intenta de nuevo.',
                         jsonb_build_object('sqlstate', sqlstate));
    end;
  end if;

  return jsonb_build_object(
    'ok', true,
    'lote_id', v_lote,
    'insertados', v_ins,
    'duplicados', v_dups + (v_nuevas - v_ins),
    'efectivo_en_caja', (select efectivo_en_caja from public.v_caja)
  );
end
$fn$;

-- 9d. Anular un movimiento (clave de admin + motivo). Nunca se borra.
create or replace function public.anular_movimiento(
  p_clave_admin    text,
  p_movimiento_id  bigint,
  p_motivo         text,
  p_anulado_por    text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_estado  text;
  v_motivo  text := nullif(btrim(p_motivo), '');
  v_quien   text := nullif(btrim(p_anulado_por), '');
  v_anulado boolean;
begin
  v_estado := privado.verificar_clave('admin', p_clave_admin);
  if v_estado <> 'ok' then
    return privado.err_clave(v_estado);
  end if;

  if v_motivo is null or length(v_motivo) < 3 or length(v_motivo) > 300 then
    return privado.err('motivo_invalido', 'El motivo es obligatorio (3 a 300 caracteres).');
  end if;
  if v_quien is null or length(v_quien) > 60 then
    return privado.err('nombre_invalido', 'Indica quién anula (máx. 60 caracteres).');
  end if;

  select anulado into v_anulado from public.movimientos where id = p_movimiento_id for update;
  if not found then
    return privado.err('movimiento_no_existe', 'El movimiento no existe.');
  end if;
  if v_anulado then
    return privado.err('ya_anulado', 'El movimiento ya estaba anulado.');
  end if;

  update public.movimientos
     set anulado = true,
         motivo_anulacion = v_motivo,
         anulado_por = v_quien,
         anulado_en = now()
   where id = p_movimiento_id;

  return jsonb_build_object(
    'ok', true,
    'id', p_movimiento_id,
    'efectivo_en_caja', (select efectivo_en_caja from public.v_caja)
  );
end
$fn$;

-- 9e. Cierre de caja diario (un cierre por fecha). esperado = efectivo en caja hasta esa fecha
--     (histórico completo, sin anulados), calculado en el servidor.
create or replace function public.registrar_cierre_caja(
  p_clave           text,
  p_registrado_por  text,
  p_fecha           date,
  p_contado         numeric,
  p_nota            text default null,
  p_id_cliente      uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_estado    text;
  v_nombre    text := nullif(btrim(p_registrado_por), '');
  v_nota      text := nullif(btrim(p_nota), '');
  v_hoy       date := (now() at time zone 'America/Guayaquil')::date;
  v_esperado  numeric;
  v_dif       numeric;
  v_previo    public.cierres_caja%rowtype;
begin
  v_estado := privado.verificar_clave('bar', p_clave);
  if v_estado <> 'ok' then
    return privado.err_clave(v_estado);
  end if;

  perform pg_advisory_xact_lock(hashtext('bar:caja'));

  if v_nombre is null or length(v_nombre) > 60 then
    return privado.err('nombre_invalido', 'Indica quién registra (máx. 60 caracteres).');
  end if;
  if p_id_cliente is null then
    return privado.err('id_cliente_requerido', 'Falta id_cliente.');
  end if;
  if p_fecha is null or not isfinite(p_fecha) then
    return privado.err('fecha_requerida', 'La fecha es obligatoria.');
  end if;
  if p_fecha > v_hoy then
    return privado.err('fecha_futura', 'La fecha no puede ser futura.');
  end if;
  -- Tope de cordura (la caja nunca debería acercarse a esto); evita errores de dedo.
  if p_contado is null or p_contado < 0 or p_contado > 100000 then
    return privado.err('monto_invalido', 'El efectivo contado debe estar entre 0 y 100000.');
  end if;
  if p_contado <> round(p_contado, 2) then
    return privado.err('monto_decimales', 'El monto admite máximo 2 decimales.');
  end if;
  if v_nota is not null and length(v_nota) > 500 then
    return privado.err('descripcion_larga', 'La nota admite máximo 500 caracteres.');
  end if;

  -- Reenvío del mismo cierre: respuesta idempotente.
  select * into v_previo from public.cierres_caja where id_cliente = p_id_cliente;
  if found then
    return jsonb_build_object('ok', true, 'duplicado', true, 'fecha', v_previo.fecha,
                              'esperado', v_previo.esperado, 'diferencia', v_previo.diferencia);
  end if;
  if exists (select 1 from public.cierres_caja where fecha = p_fecha) then
    return privado.err('cierre_existente', 'Ese día ya tiene cierre de caja.');
  end if;

  -- Misma fórmula que v_caja, acotada a la fecha del cierre.
  select coalesce(sum(case c.tipo when 'ingreso' then m.monto else -m.monto end), 0)
    into v_esperado
  from public.movimientos m
  join public.categorias c on c.id = m.categoria_id
  where not m.anulado and m.fecha <= p_fecha;

  v_dif := p_contado - v_esperado;
  if v_dif <> 0 and v_nota is null then
    return privado.err('nota_requerida', 'Hay diferencia: escribe una nota que la explique.',
                       jsonb_build_object('esperado', v_esperado, 'diferencia', v_dif));
  end if;

  begin
    insert into public.cierres_caja (fecha, contado, esperado, nota, registrado_por, id_cliente)
    values (p_fecha, p_contado, v_esperado, v_nota, v_nombre, p_id_cliente);
  exception
    when unique_violation then
      return privado.err('cierre_existente', 'Ese día ya tiene cierre de caja.');
    when others then
      return privado.err('error_guardado', 'No se pudo guardar. Intenta de nuevo.',
                         jsonb_build_object('sqlstate', sqlstate));
  end;

  return jsonb_build_object('ok', true, 'duplicado', false, 'fecha', p_fecha,
                            'esperado', v_esperado, 'diferencia', v_dif);
end
$fn$;


-- -----------------------------------------------------------------------------
-- 10. Permisos: cerrado por defecto
-- -----------------------------------------------------------------------------
-- Supabase concede por defecto ALL a anon/authenticated sobre objetos nuevos de public:
-- se revoca todo explícitamente. RLS queda activo y SIN políticas => denegado para ambos roles.
-- (service_role y el dueño conservan acceso y se saltan el RLS.)
revoke all on table
  public.categorias, public.movimientos, public.cierres_caja, public.ajustes,
  public.v_movimientos, public.v_caja
  from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;

-- RPC: se quita EXECUTE a PUBLIC y a los roles de la API, y solo se concede lo necesario.
revoke all on function
  public.obtener_categorias(),
  public.resumen_caja(text),
  public.registrar_movimientos(text, text, jsonb, uuid),
  public.anular_movimiento(text, bigint, text, text),
  public.registrar_cierre_caja(text, text, date, numeric, text, uuid)
  from public, anon, authenticated;

grant execute on function
  public.obtener_categorias(),
  public.resumen_caja(text),
  public.registrar_movimientos(text, text, jsonb, uuid),
  public.anular_movimiento(text, bigint, text, text),
  public.registrar_cierre_caja(text, text, date, numeric, text, uuid)
  to anon, authenticated;


-- =============================================================================
-- CUESTIÓN ABIERTA - Lectura del dashboard y Realtime  (NO IMPLEMENTADA)
-- =============================================================================
-- Problema: con anon cerrado, el dashboard no puede leer tablas ni suscribirse a Realtime.
-- Realtime (postgres_changes) solo entrega filas que el rol del suscriptor puede leer por RLS;
-- una RPC de solo lectura NO sirve para Realtime (habría que sondear cada N segundos).
--
-- Opciones
--   A (recomendada) Supabase Auth para el dashboard: uno o pocos usuarios creados a mano,
--     registro público DESACTIVADO, y políticas SELECT solo para el rol 'authenticated' con
--     una marca en app_metadata (nunca user_metadata). El formulario sigue siendo anon + RPC.
--     Da lectura directa, Realtime real y no abre nada a anon.
--   B RPC de lectura protegidas por clave (p. ej. listar_movimientos(p_clave_admin, ...)):
--     sin login nuevo, pero sin Realtime (polling) y la clave viaja en cada consulta.
--
-- Decisión que necesita el usuario: A o B, y quién entra al dashboard (¿una cuenta compartida
-- o una por persona?). Además, la pantalla de anulación necesita listar movimientos con su id:
-- con A sale gratis desde v_movimientos; con B hace falta otra RPC con clave de admin.
--
-- Borrador de A (para revisar; se activaría en una migración aparte):
--
--   -- 1) Dashboard > Authentication: desactivar "Allow new users to sign up"; crear el usuario
--   --    a mano y fijar en su app_metadata:  {"rol": "dashboard"}.
--   -- 2) Políticas de solo lectura:
--   create policy dashboard_lee on public.movimientos for select to authenticated
--     using (((select auth.jwt()) -> 'app_metadata' ->> 'rol') = 'dashboard');
--   create policy dashboard_lee on public.categorias for select to authenticated
--     using (((select auth.jwt()) -> 'app_metadata' ->> 'rol') = 'dashboard');
--   create policy dashboard_lee on public.cierres_caja for select to authenticated
--     using (((select auth.jwt()) -> 'app_metadata' ->> 'rol') = 'dashboard');
--   -- v_caja (security_invoker) lee el fondo desde ajustes: exponer SOLO esa fila, nunca los hashes.
--   create policy dashboard_lee_fondo on public.ajustes for select to authenticated
--     using (clave = 'fondo_caja'
--            and ((select auth.jwt()) -> 'app_metadata' ->> 'rol') = 'dashboard');
--   grant select on public.movimientos, public.categorias, public.cierres_caja,
--                   public.ajustes, public.v_movimientos, public.v_caja to authenticated;
--   -- 3) Realtime (las vistas no emiten eventos: suscribirse a las tablas y recalcular):
--   alter publication supabase_realtime add table public.movimientos, public.cierres_caja;
--
-- Nota: get_advisors avisará (INFO) "RLS enabled, no policy" en las 4 tablas y (WARN) que las
-- RPC SECURITY DEFINER son ejecutables por anon. Ambos son intencionales en este diseño.
-- =============================================================================
