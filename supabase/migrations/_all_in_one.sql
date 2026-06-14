-- UTL 360 · Migración completa (0001..0005). Pega TODO en Supabase SQL Editor y ejecuta.

-- ============================================================
-- 0001_schema.sql
-- ============================================================
-- ============================================================================
-- UTL 360 · 0001_schema.sql
-- Esquema base: extensiones, enums, tablas, índices y triggers updated_at.
-- Ejecuta este archivo PRIMERO en el SQL Editor de Supabase.
-- ============================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";        -- búsqueda por similitud

-- ─────────────────────────── ENUMS ───────────────────────────
do $$ begin
  create type app_role as enum (
    'super_admin','administrador','direccion_general','coordinador_utl',
    'juridico_legislativo','comunicaciones','coordinador_territorial',
    'gestor_territorial','atencion_ciudadana','analitica_reportes',
    'voluntario','consulta'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type contexto_operativo as enum (
    'institucional','campana','comunitario','interno','comunicacional'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type priority as enum ('baja','media','alta','urgente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_status as enum (
    'recibida','clasificada','asignada','en_gestion','respondida','cerrada','archivada'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum (
    'pendiente','en_proceso','bloqueada','en_revision','aprobada','finalizada','cancelada'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_status as enum (
    'borrador','confirmado','reprogramado','realizado','cancelado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type content_status as enum (
    'idea','borrador','en_revision','aprobado','programado','publicado','archivado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type document_status as enum (
    'borrador','aprobado','archivado','reservado','eliminado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type confidentiality as enum ('publico','interno','reservado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type zone_type as enum ('localidad','barrio','upz','municipio','vereda');
exception when duplicate_object then null; end $$;

do $$ begin
  create type visibility as enum ('publica','interna');
exception when duplicate_object then null; end $$;

-- ─────────────────────────── IDENTIDAD / ORG ───────────────────────────
create table if not exists public.areas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  descripcion text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  phone       text,
  avatar_url  text,
  area_id     uuid references public.areas(id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.roles (
  role        app_role primary key,
  descripcion text not null
);

create table if not exists public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       app_role not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (user_id, role)
);
create index if not exists idx_user_roles_user on public.user_roles(user_id);

-- ─────────────────────────── CIUDADANÍA ───────────────────────────
create table if not exists public.citizens (
  id                   uuid primary key default gen_random_uuid(),
  nombre               text not null,
  apellido             text,
  tipo_documento       text,
  documento            text,
  email                text,
  telefono             text,
  whatsapp             text,
  localidad            text,
  barrio               text,
  direccion            text,
  intereses            text[] default '{}',
  etiquetas            text[] default '{}',
  fuente_registro      text default 'landing',
  consentimiento_datos boolean not null default false,
  fecha_consentimiento timestamptz,
  estado               text not null default 'nuevo',
  contexto_operativo   contexto_operativo not null default 'comunitario',
  observaciones        text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid references auth.users(id) on delete set null,
  updated_by           uuid references auth.users(id) on delete set null,
  deleted_at           timestamptz
);
create index if not exists idx_citizens_localidad on public.citizens(localidad);
create index if not exists idx_citizens_estado on public.citizens(estado);
create index if not exists idx_citizens_nombre_trgm on public.citizens using gin (nombre gin_trgm_ops);

create table if not exists public.citizen_tags (
  id         uuid primary key default gen_random_uuid(),
  citizen_id uuid not null references public.citizens(id) on delete cascade,
  tag        text not null,
  created_at timestamptz not null default now(),
  unique (citizen_id, tag)
);

-- ─────────────────────────── SOLICITUDES ───────────────────────────
create table if not exists public.requests (
  id                 uuid primary key default gen_random_uuid(),
  radicado           text not null unique,
  citizen_id         uuid references public.citizens(id) on delete set null,
  tipo_solicitud     text not null,
  asunto             text not null,
  descripcion        text not null,
  localidad          text,
  barrio             text,
  prioridad          priority not null default 'media',
  estado             request_status not null default 'recibida',
  responsable_id     uuid references auth.users(id) on delete set null,
  fecha_recepcion    timestamptz not null default now(),
  fecha_limite       timestamptz,
  canal              text default 'landing',
  archivos           text[] default '{}',
  respuesta          text,
  fecha_cierre       timestamptz,
  contexto_operativo contexto_operativo not null default 'institucional',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references auth.users(id) on delete set null,
  updated_by         uuid references auth.users(id) on delete set null,
  deleted_at         timestamptz
);
create index if not exists idx_requests_estado on public.requests(estado);
create index if not exists idx_requests_responsable on public.requests(responsable_id);
create index if not exists idx_requests_localidad on public.requests(localidad);
create index if not exists idx_requests_fecha on public.requests(fecha_recepcion desc);

create table if not exists public.request_comments (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,
  comentario text not null,
  interno    boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_request_comments_req on public.request_comments(request_id);

-- ─────────────────────────── TAREAS ───────────────────────────
create table if not exists public.tasks (
  id                 uuid primary key default gen_random_uuid(),
  titulo             text not null,
  descripcion        text,
  area_id            uuid references public.areas(id) on delete set null,
  responsable_id     uuid references auth.users(id) on delete set null,
  creador_id         uuid references auth.users(id) on delete set null,
  prioridad          priority not null default 'media',
  estado             task_status not null default 'pendiente',
  fecha_inicio       timestamptz,
  fecha_limite       timestamptz,
  solicitud_id       uuid references public.requests(id) on delete set null,
  evento_id          uuid,
  zona_id            uuid,
  etiquetas          text[] default '{}',
  contexto_operativo contexto_operativo not null default 'interno',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references auth.users(id) on delete set null,
  updated_by         uuid references auth.users(id) on delete set null,
  deleted_at         timestamptz
);
create index if not exists idx_tasks_responsable on public.tasks(responsable_id);
create index if not exists idx_tasks_estado on public.tasks(estado);
create index if not exists idx_tasks_fecha_limite on public.tasks(fecha_limite);

create table if not exists public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,
  comentario text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.task_checklist (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  texto      text not null,
  completado boolean not null default false,
  orden      int not null default 0,
  created_at timestamptz not null default now()
);

-- ─────────────────────────── ZONAS / TERRITORIO ───────────────────────────
create table if not exists public.zones (
  id             uuid primary key default gen_random_uuid(),
  nombre_zona    text not null,
  tipo_zona      zone_type not null default 'localidad',
  descripcion    text,
  responsable_id uuid references auth.users(id) on delete set null,
  prioridad      priority not null default 'media',
  problematicas  text[] default '{}',
  mapa_url       text,
  estado         text not null default 'activa',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references auth.users(id) on delete set null,
  updated_by     uuid references auth.users(id) on delete set null,
  deleted_at     timestamptz
);
create index if not exists idx_zones_tipo on public.zones(tipo_zona);

create table if not exists public.zone_leaders (
  id         uuid primary key default gen_random_uuid(),
  zone_id    uuid not null references public.zones(id) on delete cascade,
  nombre     text not null,
  rol        text,
  telefono   text,
  email      text,
  created_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  tipo         text,
  zona_id      uuid references public.zones(id) on delete set null,
  contacto     text,
  telefono     text,
  email        text,
  influencia   text,
  estado       text not null default 'activo',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- ─────────────────────────── EVENTOS / AGENDA ───────────────────────────
create table if not exists public.events (
  id                 uuid primary key default gen_random_uuid(),
  titulo             text not null,
  descripcion        text,
  tipo               text not null default 'evento_comunitario',
  fecha_inicio       timestamptz not null,
  fecha_fin          timestamptz,
  lugar              text,
  modalidad          text default 'presencial',
  responsable_id     uuid references auth.users(id) on delete set null,
  zona_id            uuid references public.zones(id) on delete set null,
  visibilidad        visibility not null default 'interna',
  estado             event_status not null default 'borrador',
  link_reunion       text,
  contexto_operativo contexto_operativo not null default 'comunitario',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references auth.users(id) on delete set null,
  updated_by         uuid references auth.users(id) on delete set null,
  deleted_at         timestamptz
);
create index if not exists idx_events_fecha on public.events(fecha_inicio);
create index if not exists idx_events_visibilidad on public.events(visibilidad);

create table if not exists public.event_attendees (
  id                   uuid primary key default gen_random_uuid(),
  event_id             uuid not null references public.events(id) on delete cascade,
  citizen_id           uuid references public.citizens(id) on delete set null,
  nombre               text not null,
  telefono             text,
  email                text,
  barrio               text,
  consentimiento_datos boolean not null default false,
  created_at           timestamptz not null default now()
);
create index if not exists idx_event_attendees_event on public.event_attendees(event_id);

-- FK diferidas de tasks → events/zones
alter table public.tasks
  drop constraint if exists tasks_evento_id_fkey,
  add constraint tasks_evento_id_fkey
    foreign key (evento_id) references public.events(id) on delete set null;
alter table public.tasks
  drop constraint if exists tasks_zona_id_fkey,
  add constraint tasks_zona_id_fkey
    foreign key (zona_id) references public.zones(id) on delete set null;

-- ─────────────────────────── DOCUMENTOS ───────────────────────────
create table if not exists public.documents (
  id                 uuid primary key default gen_random_uuid(),
  titulo             text not null,
  tipo_documento     text not null default 'general',
  archivo_url        text,
  version            int not null default 1,
  estado             document_status not null default 'borrador',
  confidencialidad   confidentiality not null default 'interno',
  tags               text[] default '{}',
  contexto_operativo contexto_operativo not null default 'institucional',
  creado_por         uuid references auth.users(id) on delete set null,
  aprobado_por       uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);
create index if not exists idx_documents_tipo on public.documents(tipo_documento);
create index if not exists idx_documents_confid on public.documents(confidencialidad);

-- ─────────────────────────── CONTENIDO / COMUNICACIONES ───────────────────────────
create table if not exists public.content_posts (
  id                 uuid primary key default gen_random_uuid(),
  titulo             text not null,
  slug               text unique,
  tipo               text not null default 'noticia',
  categoria          text,
  resumen            text,
  cuerpo             text,
  imagen_url         text,
  estado             content_status not null default 'borrador',
  visibilidad        visibility not null default 'interna',
  contexto_operativo contexto_operativo not null default 'comunicacional',
  fecha_publicacion  timestamptz,
  autor_id           uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references auth.users(id) on delete set null,
  updated_by         uuid references auth.users(id) on delete set null,
  deleted_at         timestamptz
);
create index if not exists idx_content_estado on public.content_posts(estado);
create index if not exists idx_content_slug on public.content_posts(slug);

create table if not exists public.content_calendar (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid references public.content_posts(id) on delete cascade,
  titulo          text not null,
  canal           text,
  fecha_programada timestamptz,
  estado          content_status not null default 'idea',
  responsable_id  uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─────────────────────────── IA / SISTEMA ───────────────────────────
create table if not exists public.ai_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  tarea_ia    text not null,
  prompt      text,
  resultado   text,
  fuente      text,
  aprobado_por uuid references auth.users(id) on delete set null,
  estado      text not null default 'generado',
  created_at  timestamptz not null default now()
);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  titulo     text not null,
  cuerpo     text,
  tipo       text default 'info',
  leida      boolean not null default false,
  url        text,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, leida);

create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users(id) on delete set null,
  accion      text not null,
  entidad     text not null,
  entidad_id  text,
  antes       jsonb,
  despues     jsonb,
  motivo      text,
  ip          text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_entidad on public.audit_logs(entidad, entidad_id);
create index if not exists idx_audit_actor on public.audit_logs(actor_id);

create table if not exists public.settings (
  key         text primary key,
  value       jsonb not null default '{}',
  descripcion text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

-- ─────────────────────────── TRIGGER updated_at ───────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'areas','profiles','citizens','requests','tasks','zones','organizations',
    'events','documents','content_posts','content_calendar'
  ] loop
    execute format(
      'drop trigger if exists trg_%1$s_updated on public.%1$s;
       create trigger trg_%1$s_updated before update on public.%1$s
       for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- ============================================================
-- 0002_functions.sql
-- ============================================================
-- ============================================================================
-- UTL 360 · 0002_functions.sql
-- Funciones helper de autorización, radicado, auditoría y alta de usuarios.
-- Ejecuta DESPUÉS de 0001_schema.sql.
-- ============================================================================

-- ───────────── Helpers de roles (SECURITY DEFINER para usarse en políticas RLS) ─────────────

create or replace function public.get_my_role()
returns app_role
language sql stable security definer set search_path = public as $$
  select role from public.user_roles where user_id = auth.uid() limit 1;
$$;

create or replace function public.has_role(role_name app_role)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = role_name
  );
$$;

-- Sobrecarga por texto (cómoda desde el cliente)
create or replace function public.has_role(role_name text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role::text = role_name
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role in ('super_admin','administrador')
  );
$$;

-- ¿El usuario puede gestionar un área? (admins, dirección, coordinación o su propia área)
create or replace function public.can_manage_area(target_area uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.is_admin()
    or public.has_role('direccion_general'::app_role)
    or public.has_role('coordinador_utl'::app_role)
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.area_id = target_area
    );
$$;

-- ¿Tiene alguno de los roles de "staff" con acceso de lectura operativa?
create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid());
$$;

-- ───────────── Radicado: JLV-YYYY-NNNNNN ─────────────
create sequence if not exists public.radicado_seq start 1;

create or replace function public.generate_radicado()
returns text
language plpgsql volatile as $$
declare
  n bigint;
begin
  n := nextval('public.radicado_seq');
  return 'JLV-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 6, '0');
end $$;

-- Asigna radicado automáticamente si viene nulo/vacío
create or replace function public.set_request_radicado()
returns trigger language plpgsql as $$
begin
  if new.radicado is null or new.radicado = '' then
    new.radicado := public.generate_radicado();
  end if;
  return new;
end $$;

drop trigger if exists trg_requests_radicado on public.requests;
create trigger trg_requests_radicado
  before insert on public.requests
  for each row execute function public.set_request_radicado();

-- ───────────── Auditoría genérica ─────────────
create or replace function public.log_audit_event()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_before jsonb;
  v_after  jsonb;
  v_id     text;
begin
  if tg_op = 'INSERT' then
    v_after := to_jsonb(new); v_id := (new.id)::text;
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old); v_after := to_jsonb(new); v_id := (new.id)::text;
  elsif tg_op = 'DELETE' then
    v_before := to_jsonb(old); v_id := (old.id)::text;
  end if;

  insert into public.audit_logs(actor_id, accion, entidad, entidad_id, antes, despues)
  values (auth.uid(), tg_op, tg_table_name, v_id, v_before, v_after);

  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'citizens','requests','tasks','zones','events','documents','content_posts','user_roles'
  ] loop
    execute format(
      'drop trigger if exists trg_%1$s_audit on public.%1$s;
       create trigger trg_%1$s_audit
       after insert or update or delete on public.%1$s
       for each row execute function public.log_audit_event();', t);
  end loop;
end $$;

-- ───────────── Alta automática de perfil al registrar usuario ─────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;

  -- Rol mínimo por defecto: 'consulta'. Un admin debe elevar manualmente.
  insert into public.user_roles (user_id, role)
  values (new.id, 'consulta')
  on conflict (user_id, role) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 0003_rls.sql
-- ============================================================
-- ============================================================================
-- UTL 360 · 0003_rls.sql
-- Row Level Security: habilitación + políticas por rol.
-- Principio: DENY BY DEFAULT. Nada es legible sin política explícita.
-- Ejecuta DESPUÉS de 0002_functions.sql.
-- ============================================================================

-- Habilitar RLS en TODAS las tablas
do $$
declare t text;
begin
  foreach t in array array[
    'areas','profiles','roles','user_roles','citizens','citizen_tags','requests',
    'request_comments','tasks','task_comments','task_checklist','zones','zone_leaders',
    'organizations','events','event_attendees','documents','content_posts',
    'content_calendar','ai_logs','notifications','audit_logs','settings'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
  end loop;
end $$;

-- ───────────── Catálogos (lectura autenticada, escritura admin) ─────────────
drop policy if exists areas_read on public.areas;
create policy areas_read on public.areas for select to authenticated using (true);
drop policy if exists areas_admin on public.areas;
create policy areas_admin on public.areas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists roles_read on public.roles;
create policy roles_read on public.roles for select to authenticated using (true);
drop policy if exists roles_admin on public.roles;
create policy roles_admin on public.roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select to authenticated using (true);
-- Lectura pública SOLO de claves no sensibles (perfil/contacto de la landing)
drop policy if exists settings_public_read on public.settings;
create policy settings_public_read on public.settings for select to anon
  using (key in ('perfil_publico','contacto'));
drop policy if exists settings_admin on public.settings;
create policy settings_admin on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ───────────── profiles ─────────────
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
drop policy if exists profiles_admin on public.profiles;
create policy profiles_admin on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ───────────── user_roles (solo admin gestiona; cada quien ve los suyos) ─────────────
drop policy if exists user_roles_self_read on public.user_roles;
create policy user_roles_self_read on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists user_roles_admin on public.user_roles;
create policy user_roles_admin on public.user_roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ───────────── citizens (CRM) ─────────────
-- INSERT público controlado desde formularios de la landing (requiere consentimiento)
drop policy if exists citizens_public_insert on public.citizens;
create policy citizens_public_insert on public.citizens for insert to anon
  with check (consentimiento_datos = true);
-- Staff de atención/territorio + admins leen y gestionan
drop policy if exists citizens_staff_read on public.citizens;
create policy citizens_staff_read on public.citizens for select to authenticated
  using (
    public.is_admin()
    or public.has_role('direccion_general'::app_role)
    or public.has_role('coordinador_utl'::app_role)
    or public.has_role('atencion_ciudadana'::app_role)
    or public.has_role('coordinador_territorial'::app_role)
    or public.has_role('gestor_territorial'::app_role)
    or public.has_role('analitica_reportes'::app_role)
  );
drop policy if exists citizens_staff_write on public.citizens;
create policy citizens_staff_write on public.citizens for insert to authenticated
  with check (
    public.is_admin()
    or public.has_role('atencion_ciudadana'::app_role)
    or public.has_role('coordinador_territorial'::app_role)
    or public.has_role('gestor_territorial'::app_role)
  );
drop policy if exists citizens_staff_update on public.citizens;
create policy citizens_staff_update on public.citizens for update to authenticated
  using (
    public.is_admin()
    or public.has_role('atencion_ciudadana'::app_role)
    or public.has_role('coordinador_territorial'::app_role)
    or public.has_role('gestor_territorial'::app_role)
  ) with check (true);

-- ───────────── requests (solicitudes) ─────────────
drop policy if exists requests_public_insert on public.requests;
create policy requests_public_insert on public.requests for insert to anon
  with check (estado = 'recibida');
drop policy if exists requests_staff_read on public.requests;
create policy requests_staff_read on public.requests for select to authenticated
  using (
    public.is_admin()
    or public.has_role('direccion_general'::app_role)
    or public.has_role('coordinador_utl'::app_role)
    or public.has_role('juridico_legislativo'::app_role)
    or public.has_role('atencion_ciudadana'::app_role)
    or public.has_role('coordinador_territorial'::app_role)
    or public.has_role('gestor_territorial'::app_role)
    or public.has_role('analitica_reportes'::app_role)
    or responsable_id = auth.uid()
  );
drop policy if exists requests_staff_insert on public.requests;
create policy requests_staff_insert on public.requests for insert to authenticated
  with check (public.is_staff());
drop policy if exists requests_staff_update on public.requests;
create policy requests_staff_update on public.requests for update to authenticated
  using (
    public.is_admin()
    or public.has_role('coordinador_utl'::app_role)
    or public.has_role('juridico_legislativo'::app_role)
    or public.has_role('atencion_ciudadana'::app_role)
    or public.has_role('coordinador_territorial'::app_role)
    or responsable_id = auth.uid()
  ) with check (true);

drop policy if exists request_comments_staff on public.request_comments;
create policy request_comments_staff on public.request_comments for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ───────────── tasks ─────────────
drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks for select to authenticated
  using (public.is_staff());
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.is_staff());
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
  using (
    public.is_admin()
    or public.has_role('coordinador_utl'::app_role)
    or responsable_id = auth.uid()
    or creador_id = auth.uid()
  ) with check (true);
drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.is_admin() or public.has_role('coordinador_utl'::app_role));

drop policy if exists task_comments_staff on public.task_comments;
create policy task_comments_staff on public.task_comments for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists task_checklist_staff on public.task_checklist;
create policy task_checklist_staff on public.task_checklist for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ───────────── zones / territorio ─────────────
drop policy if exists zones_read on public.zones;
create policy zones_read on public.zones for select to authenticated using (public.is_staff());
drop policy if exists zones_write on public.zones;
create policy zones_write on public.zones for all to authenticated
  using (
    public.is_admin()
    or public.has_role('coordinador_territorial'::app_role)
    or public.has_role('coordinador_utl'::app_role)
  ) with check (
    public.is_admin()
    or public.has_role('coordinador_territorial'::app_role)
    or public.has_role('coordinador_utl'::app_role)
  );

drop policy if exists zone_leaders_staff on public.zone_leaders;
create policy zone_leaders_staff on public.zone_leaders for all to authenticated
  using (public.is_staff())
  with check (public.is_admin() or public.has_role('coordinador_territorial'::app_role)
    or public.has_role('gestor_territorial'::app_role));

drop policy if exists organizations_staff on public.organizations;
create policy organizations_staff on public.organizations for all to authenticated
  using (public.is_staff())
  with check (public.is_admin() or public.has_role('coordinador_territorial'::app_role));

-- ───────────── events / agenda ─────────────
-- Público: solo eventos públicos confirmados/realizados (para la agenda de la landing)
drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events for select to anon
  using (visibilidad = 'publica' and estado in ('confirmado','reprogramado','realizado')
         and deleted_at is null);
drop policy if exists events_staff_read on public.events;
create policy events_staff_read on public.events for select to authenticated
  using (public.is_staff());
drop policy if exists events_write on public.events;
create policy events_write on public.events for all to authenticated
  using (
    public.is_admin()
    or public.has_role('coordinador_utl'::app_role)
    or public.has_role('coordinador_territorial'::app_role)
    or public.has_role('comunicaciones'::app_role)
    or responsable_id = auth.uid()
  ) with check (public.is_staff());

-- Inscripción pública a eventos (INSERT controlado, sin SELECT público)
drop policy if exists event_attendees_public_insert on public.event_attendees;
create policy event_attendees_public_insert on public.event_attendees for insert to anon
  with check (consentimiento_datos = true);
drop policy if exists event_attendees_staff on public.event_attendees;
create policy event_attendees_staff on public.event_attendees for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ───────────── documents ─────────────
drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents for select to authenticated
  using (
    public.is_staff() and (
      confidencialidad <> 'reservado'
      or public.is_admin()
      or public.has_role('direccion_general'::app_role)
      or public.has_role('juridico_legislativo'::app_role)
      or creado_por = auth.uid()
    )
  );
drop policy if exists documents_write on public.documents;
create policy documents_write on public.documents for all to authenticated
  using (
    public.is_admin()
    or public.has_role('juridico_legislativo'::app_role)
    or public.has_role('comunicaciones'::app_role)
    or public.has_role('coordinador_utl'::app_role)
    or creado_por = auth.uid()
  ) with check (public.is_staff());

-- ───────────── content_posts / comunicaciones ─────────────
-- Público: solo publicaciones públicas y publicadas (noticias de la landing)
drop policy if exists content_public_read on public.content_posts;
create policy content_public_read on public.content_posts for select to anon
  using (visibilidad = 'publica' and estado = 'publicado' and deleted_at is null);
drop policy if exists content_staff_read on public.content_posts;
create policy content_staff_read on public.content_posts for select to authenticated
  using (public.is_staff());
drop policy if exists content_write on public.content_posts;
create policy content_write on public.content_posts for all to authenticated
  using (
    public.is_admin()
    or public.has_role('comunicaciones'::app_role)
    or public.has_role('coordinador_utl'::app_role)
  ) with check (
    public.is_admin()
    or public.has_role('comunicaciones'::app_role)
    or public.has_role('coordinador_utl'::app_role)
  );

drop policy if exists content_calendar_staff on public.content_calendar;
create policy content_calendar_staff on public.content_calendar for all to authenticated
  using (public.is_staff())
  with check (public.is_admin() or public.has_role('comunicaciones'::app_role)
    or public.has_role('coordinador_utl'::app_role));

-- ───────────── ai_logs / notifications ─────────────
drop policy if exists ai_logs_owner on public.ai_logs;
create policy ai_logs_owner on public.ai_logs for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists notifications_owner on public.notifications;
create policy notifications_owner on public.notifications for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────── audit_logs (solo lectura admin/dirección/control) ─────────────
drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select to authenticated
  using (
    public.is_admin()
    or public.has_role('direccion_general'::app_role)
  );
-- Sin política de INSERT para clientes: los inserta el trigger (SECURITY DEFINER).

-- ============================================================
-- 0004_seed.sql
-- ============================================================
-- ============================================================================
-- UTL 360 · 0004_seed.sql
-- Datos iniciales: catálogo de roles, áreas, settings y placeholders de contenido.
-- Ejecuta DESPUÉS de 0003_rls.sql. Idempotente.
-- ============================================================================

-- Catálogo de roles (descripciones)
insert into public.roles (role, descripcion) values
  ('super_admin','Acceso total al sistema y configuraciones críticas'),
  ('administrador','Gestión total excepto configuraciones críticas'),
  ('direccion_general','Lectura total y aprobación estratégica'),
  ('coordinador_utl','Coordinación de áreas, tareas, agenda y reportes'),
  ('juridico_legislativo','Documentos, solicitudes formales y respuestas'),
  ('comunicaciones','Contenidos, noticias, piezas y calendario editorial'),
  ('coordinador_territorial','Zonas, eventos, líderes y solicitudes territoriales'),
  ('gestor_territorial','Gestión limitada por zona asignada'),
  ('atencion_ciudadana','CRM ciudadano y solicitudes'),
  ('analitica_reportes','Lectura y reportes'),
  ('voluntario','Acceso limitado a tareas asignadas y eventos'),
  ('consulta','Solo lectura')
on conflict (role) do update set descripcion = excluded.descripcion;

-- Áreas base
insert into public.areas (nombre, descripcion) values
  ('Dirección General','Despacho y dirección política'),
  ('Coordinación UTL','Coordinación de la Unidad de Trabajo Legislativo'),
  ('Jurídico / Legislativo','Soporte jurídico y legislativo'),
  ('Comunicaciones','Estrategia, contenidos y prensa'),
  ('Territorial','Gestión territorial y comunitaria'),
  ('Atención Ciudadana','Atención y CRM'),
  ('Analítica','Reportes y datos')
on conflict (nombre) do nothing;

-- Settings / placeholders editables del perfil público (NO inventar biografía)
insert into public.settings (key, value, descripcion) values
  ('perfil_publico',
   jsonb_build_object(
     'nombre','Jairo León Vargas',
     'cargo_aspiracion','Candidato a Cámara por Bogotá D.C.',
     'movimiento','Pacto Histórico / Colombia Humana',
     'renglon','106',
     'lema','Una voz desde el territorio para construir con la gente',
     'subtitulo','Gestión social, participación ciudadana y trabajo comunitario para Bogotá y Colombia.',
     'biografia_corta','[Pendiente de edición en el CMS] Trayectoria pública con experiencia territorial y social en Bogotá y en programas de articulación de oferta social.',
     'foto_url','',
     'redes', jsonb_build_object('facebook','','instagram','','x','','tiktok','','youtube','')
   ),
   'Datos públicos editables del perfil de la landing'),
  ('contacto',
   jsonb_build_object('email','', 'telefono','', 'direccion',''),
   'Datos de contacto públicos'),
  ('contexto_operativo_default', '"institucional"'::jsonb,
   'Contexto operativo por defecto para nuevos registros')
on conflict (key) do nothing;

-- Trayectoria verificada (placeholders basados SOLO en datos públicos confirmados)
insert into public.content_posts (titulo, slug, tipo, categoria, resumen, estado, visibilidad, contexto_operativo, fecha_publicacion)
values
  ('Alcalde Local de San Cristóbal','trayectoria-san-cristobal','trayectoria','Gestión territorial',
   'Experiencia como Alcalde Local de San Cristóbal, con gestión territorial y social.',
   'borrador','interna','institucional', null),
  ('Director de Oferta Social – Prosperidad Social','trayectoria-prosperidad-social','trayectoria','Articulación institucional',
   'Director de Oferta Social / Director de Gestión y Articulación de la Oferta Social en Prosperidad Social.',
   'borrador','interna','institucional', null),
  ('Candidato a Cámara por Bogotá D.C. – Renglón 106','trayectoria-candidatura','trayectoria','Participación',
   'Candidatura a la Cámara de Representantes por Bogotá D.C. en el entorno del Pacto Histórico.',
   'borrador','interna','campana', null)
on conflict (slug) do nothing;

-- ============================================================
-- 0005_notifications.sql
-- ============================================================
-- ============================================================================
-- UTL 360 · 0005_notifications.sql
-- Sistema de notificaciones multiplataforma y auditable.
-- Ejecuta DESPUÉS de 0004_seed.sql (idempotente).
-- ============================================================================

-- ── Extender notifications para multicanal + trazabilidad ──
alter table public.notifications
  add column if not exists canal        text not null default 'in_app',  -- in_app|email|push|whatsapp
  add column if not exists estado_envio text not null default 'enviado', -- enviado|pendiente|fallido
  add column if not exists batch_id     uuid,
  add column if not exists created_by   uuid references auth.users(id) on delete set null;

create index if not exists idx_notifications_batch on public.notifications(batch_id);

-- ── Batches: una fila por envío del administrador (auditoría) ──
create table if not exists public.notification_batches (
  id                  uuid primary key default gen_random_uuid(),
  titulo              text not null,
  cuerpo              text,
  tipo                text not null default 'info',     -- info|exito|advertencia|alerta
  url                 text,
  canales             text[] not null default '{in_app}',
  audiencia_tipo      text not null default 'todos',    -- todos|rol|usuario
  audiencia_valor     text,                             -- rol o user_id según el tipo
  total_destinatarios int not null default 0,
  resultado_canales   jsonb not null default '{}',      -- {email: "no_configurado", ...}
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index if not exists idx_notif_batches_fecha on public.notification_batches(created_at desc);

-- ── RLS ──
alter table public.notification_batches enable row level security;
alter table public.notification_batches force row level security;

-- ¿Quién puede emitir notificaciones masivas?
create or replace function public.can_send_notifications()
returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.is_admin()
    or public.has_role('direccion_general'::app_role)
    or public.has_role('coordinador_utl'::app_role)
    or public.has_role('comunicaciones'::app_role);
$$;

-- notifications: reescribir políticas (cada quien las suyas; emisores insertan a terceros)
drop policy if exists notifications_owner on public.notifications;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Insert: el destinatario para sí mismo (sistema) o un emisor autorizado para terceros
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert to authenticated
  with check (user_id = auth.uid() or public.can_send_notifications());

-- batches: emisores crean y leen; admin/dirección ven todo (auditoría)
drop policy if exists notif_batches_insert on public.notification_batches;
create policy notif_batches_insert on public.notification_batches for insert to authenticated
  with check (public.can_send_notifications());

drop policy if exists notif_batches_read on public.notification_batches;
create policy notif_batches_read on public.notification_batches for select to authenticated
  using (public.can_send_notifications());

-- ── Auditoría del envío (queda en audit_logs) ──
drop trigger if exists trg_notif_batches_audit on public.notification_batches;
create trigger trg_notif_batches_audit
  after insert or update or delete on public.notification_batches
  for each row execute function public.log_audit_event();
