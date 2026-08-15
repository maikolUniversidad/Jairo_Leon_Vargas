-- ============================================================================
-- UTL 360 · 0041_inventario.sql
-- Inventario de equipos físicos (cámaras, lentes, micrófonos, trípodes…) con:
--   · catálogo de equipos y sus piezas/partes,
--   · préstamos (solicitud → entrega → devolución) con historial de quién lo tuvo,
--   · novedades (accidentes, daños, mantenimiento, pérdidas),
--   · evidencias en foto/video de la entrega y la recepción.
--
-- No confundir con `equipos_cobertura` (equipos de PERSONAS que atribuyen el
-- material de una cobertura). Esto es inventario de bienes.
-- Ejecuta DESPUÉS de 0040. Idempotente.
-- ============================================================================

-- ─────────────── Quién gestiona el inventario ───────────────
-- Admins, dirección, coordinación y comunicaciones gestionan; todo el staff
-- puede leer y solicitar préstamos (ver políticas más abajo).
create or replace function public.can_manage_inventario()
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_admin()
    or public.has_role('direccion_general'::app_role)
    or public.has_role('coordinador_utl'::app_role)
    or public.has_role('comunicaciones'::app_role);
$$;

-- ─────────────── Catálogo de equipos ───────────────
create table if not exists public.inventario_equipos (
  id           uuid primary key default gen_random_uuid(),
  codigo       text,                      -- placa/código interno de inventario
  nombre       text not null,
  categoria    text not null default 'otro'
    check (categoria in ('camara','lente','microfono','audio','tripode','estabilizador',
                         'iluminacion','dron','almacenamiento','computo','energia','accesorio','otro')),
  marca        text,
  modelo       text,
  serial       text,                      -- número de serie del fabricante
  estado       text not null default 'disponible'
    check (estado in ('disponible','prestado','mantenimiento','danado','baja')),
  condicion    text not null default 'bueno'
    check (condicion in ('nuevo','bueno','regular','malo')),
  ubicacion    text,                      -- dónde se guarda cuando está disponible
  valor        numeric(14,2),             -- valor de reposición (COP)
  fecha_compra date,
  notas        text,
  foto_url     text,                      -- foto del equipo (bucket público)
  activo       boolean not null default true,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint inventario_equipos_nombre_no_vacio check (length(btrim(nombre)) > 0)
);

-- Un código de inventario no se puede repetir (cuando se usa).
create unique index if not exists idx_inventario_equipos_codigo
  on public.inventario_equipos (lower(btrim(codigo)))
  where codigo is not null and btrim(codigo) <> '';

create index if not exists idx_inventario_equipos_estado on public.inventario_equipos (estado);
create index if not exists idx_inventario_equipos_categoria on public.inventario_equipos (categoria);

-- ─────────────── Piezas y partes de cada equipo ───────────────
-- Un kit de cámara trae batería, cargador, tapa, memoria, cable, estuche… Cada
-- una se registra para poder verificar en la entrega y la devolución.
create table if not exists public.inventario_partes (
  id         uuid primary key default gen_random_uuid(),
  equipo_id  uuid not null references public.inventario_equipos(id) on delete cascade,
  nombre     text not null,
  cantidad   int not null default 1 check (cantidad >= 0),
  esencial   boolean not null default true,   -- debe volver junto con el equipo
  estado     text not null default 'ok' check (estado in ('ok','faltante','danado')),
  notas      text,
  created_at timestamptz not null default now(),
  constraint inventario_partes_nombre_no_vacio check (length(btrim(nombre)) > 0)
);
create index if not exists idx_inventario_partes_equipo on public.inventario_partes (equipo_id);

-- ─────────────── Préstamos ───────────────
-- Historial de quién tuvo cada equipo y en qué condición salió/volvió.
create table if not exists public.inventario_prestamos (
  id                  uuid primary key default gen_random_uuid(),
  equipo_id           uuid not null references public.inventario_equipos(id) on delete cascade,
  responsable_id      uuid references auth.users(id) on delete set null,  -- quién lo pide/lo tiene
  entregado_por       uuid references auth.users(id) on delete set null,  -- quién hace la entrega
  recibido_por        uuid references auth.users(id) on delete set null,  -- quién recibe la devolución
  estado              text not null default 'activo'
    check (estado in ('solicitado','activo','devuelto','vencido','rechazado')),
  proposito           text,                     -- para qué / a qué cobertura
  fecha_salida        timestamptz,
  fecha_prevista      timestamptz,              -- devolución esperada
  fecha_devolucion    timestamptz,
  condicion_salida    text check (condicion_salida in ('nuevo','bueno','regular','malo')),
  condicion_devolucion text check (condicion_devolucion in ('nuevo','bueno','regular','malo')),
  checklist_salida    jsonb,                    -- [{parte_id, nombre, incluida}]
  checklist_devolucion jsonb,
  notas_salida        text,
  notas_devolucion    text,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_inventario_prestamos_equipo on public.inventario_prestamos (equipo_id, created_at desc);
create index if not exists idx_inventario_prestamos_responsable on public.inventario_prestamos (responsable_id);
create index if not exists idx_inventario_prestamos_estado on public.inventario_prestamos (estado);

-- ─────────────── Novedades (accidentes, daños, mantenimiento…) ───────────────
create table if not exists public.inventario_novedades (
  id            uuid primary key default gen_random_uuid(),
  equipo_id     uuid not null references public.inventario_equipos(id) on delete cascade,
  prestamo_id   uuid references public.inventario_prestamos(id) on delete set null,
  tipo          text not null default 'nota'
    check (tipo in ('accidente','dano','mantenimiento','perdida','reparacion','nota')),
  severidad     text not null default 'media' check (severidad in ('baja','media','alta','critica')),
  descripcion   text not null,
  costo         numeric(14,2),
  resuelto      boolean not null default false,
  reportado_por uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint inventario_novedades_desc_no_vacia check (length(btrim(descripcion)) > 0)
);
create index if not exists idx_inventario_novedades_equipo on public.inventario_novedades (equipo_id, created_at desc);

-- ─────────────── Evidencias (foto/video de entrega y recepción) ───────────────
create table if not exists public.inventario_evidencias (
  id           uuid primary key default gen_random_uuid(),
  equipo_id    uuid not null references public.inventario_equipos(id) on delete cascade,
  prestamo_id  uuid references public.inventario_prestamos(id) on delete set null,
  novedad_id   uuid references public.inventario_novedades(id) on delete set null,
  momento      text not null default 'general'
    check (momento in ('entrega','recepcion','accidente','general')),
  tipo_media   text not null default 'video' check (tipo_media in ('video','foto')),
  storage_path text not null,
  url          text,
  mime         text,
  descripcion  text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_inventario_evidencias_equipo on public.inventario_evidencias (equipo_id, created_at desc);
create index if not exists idx_inventario_evidencias_prestamo on public.inventario_evidencias (prestamo_id);

-- ─────────────── updated_at ───────────────
drop trigger if exists trg_inventario_equipos_updated on public.inventario_equipos;
create trigger trg_inventario_equipos_updated before update on public.inventario_equipos
  for each row execute function public.set_updated_at();

drop trigger if exists trg_inventario_prestamos_updated on public.inventario_prestamos;
create trigger trg_inventario_prestamos_updated before update on public.inventario_prestamos
  for each row execute function public.set_updated_at();

drop trigger if exists trg_inventario_novedades_updated on public.inventario_novedades;
create trigger trg_inventario_novedades_updated before update on public.inventario_novedades
  for each row execute function public.set_updated_at();

-- ─────────────── Auditoría: movimientos de bienes ───────────────
drop trigger if exists trg_inventario_equipos_audit on public.inventario_equipos;
create trigger trg_inventario_equipos_audit
  after insert or update or delete on public.inventario_equipos
  for each row execute function public.log_audit_event();

drop trigger if exists trg_inventario_prestamos_audit on public.inventario_prestamos;
create trigger trg_inventario_prestamos_audit
  after insert or update or delete on public.inventario_prestamos
  for each row execute function public.log_audit_event();

-- ═══════════════════════ RLS ═══════════════════════
alter table public.inventario_equipos    enable row level security;
alter table public.inventario_equipos    force  row level security;
alter table public.inventario_partes      enable row level security;
alter table public.inventario_partes      force  row level security;
alter table public.inventario_prestamos   enable row level security;
alter table public.inventario_prestamos   force  row level security;
alter table public.inventario_novedades   enable row level security;
alter table public.inventario_novedades   force  row level security;
alter table public.inventario_evidencias  enable row level security;
alter table public.inventario_evidencias  force  row level security;

-- Equipos: lee todo el staff; gestiona quien administra inventario.
drop policy if exists inventario_equipos_read on public.inventario_equipos;
create policy inventario_equipos_read on public.inventario_equipos
  for select to authenticated using (public.is_staff());
drop policy if exists inventario_equipos_write on public.inventario_equipos;
create policy inventario_equipos_write on public.inventario_equipos
  for all to authenticated
  using (public.can_manage_inventario()) with check (public.can_manage_inventario());

-- Partes: igual que el equipo.
drop policy if exists inventario_partes_read on public.inventario_partes;
create policy inventario_partes_read on public.inventario_partes
  for select to authenticated using (public.is_staff());
drop policy if exists inventario_partes_write on public.inventario_partes;
create policy inventario_partes_write on public.inventario_partes
  for all to authenticated
  using (public.can_manage_inventario()) with check (public.can_manage_inventario());

-- Préstamos: lee todo el staff. Un gestor registra entregas y devoluciones; el
-- resto del staff solo puede crear su propia SOLICITUD (estado 'solicitado').
drop policy if exists inventario_prestamos_read on public.inventario_prestamos;
create policy inventario_prestamos_read on public.inventario_prestamos
  for select to authenticated using (public.is_staff());
drop policy if exists inventario_prestamos_insert on public.inventario_prestamos;
create policy inventario_prestamos_insert on public.inventario_prestamos
  for insert to authenticated
  with check (
    public.can_manage_inventario()
    or (responsable_id = auth.uid() and estado = 'solicitado')
  );
drop policy if exists inventario_prestamos_update on public.inventario_prestamos;
create policy inventario_prestamos_update on public.inventario_prestamos
  for update to authenticated
  using (public.can_manage_inventario()) with check (public.can_manage_inventario());
drop policy if exists inventario_prestamos_delete on public.inventario_prestamos;
create policy inventario_prestamos_delete on public.inventario_prestamos
  for delete to authenticated using (public.can_manage_inventario());

-- Novedades: lee el staff; cualquiera del staff puede reportar (a su nombre);
-- editar/cerrar y borrar solo gestores.
drop policy if exists inventario_novedades_read on public.inventario_novedades;
create policy inventario_novedades_read on public.inventario_novedades
  for select to authenticated using (public.is_staff());
drop policy if exists inventario_novedades_insert on public.inventario_novedades;
create policy inventario_novedades_insert on public.inventario_novedades
  for insert to authenticated
  with check (public.is_staff() and (reportado_por = auth.uid() or public.can_manage_inventario()));
drop policy if exists inventario_novedades_update on public.inventario_novedades;
create policy inventario_novedades_update on public.inventario_novedades
  for update to authenticated
  using (public.can_manage_inventario()) with check (public.can_manage_inventario());
drop policy if exists inventario_novedades_delete on public.inventario_novedades;
create policy inventario_novedades_delete on public.inventario_novedades
  for delete to authenticated using (public.can_manage_inventario());

-- Evidencias: lee el staff; sube el staff (a su nombre); borra solo gestores.
drop policy if exists inventario_evidencias_read on public.inventario_evidencias;
create policy inventario_evidencias_read on public.inventario_evidencias
  for select to authenticated using (public.is_staff());
drop policy if exists inventario_evidencias_insert on public.inventario_evidencias;
create policy inventario_evidencias_insert on public.inventario_evidencias
  for insert to authenticated
  with check (public.is_staff() and (created_by = auth.uid() or public.can_manage_inventario()));
drop policy if exists inventario_evidencias_delete on public.inventario_evidencias;
create policy inventario_evidencias_delete on public.inventario_evidencias
  for delete to authenticated using (public.can_manage_inventario());

-- ─────────────── Storage: bucket de evidencias ───────────────
-- Público como `coberturas`: guarda video pesado y la app lo incrusta directo.
-- La ruta lleva timestamp único, así que no es adivinable.
insert into storage.buckets (id, name, public, file_size_limit)
values ('inventario','inventario', true, 104857600)  -- 100 MB
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

drop policy if exists "utl read inventario" on storage.objects;
create policy "utl read inventario" on storage.objects
  for select to public using (bucket_id = 'inventario');
drop policy if exists "utl write inventario" on storage.objects;
create policy "utl write inventario" on storage.objects
  for insert to authenticated with check (bucket_id = 'inventario');
drop policy if exists "utl delete inventario" on storage.objects;
create policy "utl delete inventario" on storage.objects
  for delete to authenticated using (bucket_id = 'inventario');

-- ─────────────── Permisos por rol (matriz) ───────────────
-- can_view para todo el staff (todos pueden ver y solicitar préstamos)…
insert into public.role_permissions (role_key, module, can_view)
select key, 'inventario', true from public.roles_catalog where is_system
on conflict (role_key, module) do nothing;

-- …y gestión (crear/editar) solo para quien administra inventario.
update public.role_permissions set can_create = true, can_edit = true
where module = 'inventario'
  and role_key in ('super_admin','administrador','direccion_general','coordinador_utl','comunicaciones');

update public.role_permissions set can_delete = true
where module = 'inventario' and role_key in ('super_admin','administrador');
