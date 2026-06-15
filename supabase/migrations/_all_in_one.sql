-- UTL 360 · Migración completa (0001..0010).

-- ===== 0001_schema.sql =====
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

-- ===== 0002_functions.sql =====
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

-- ===== 0003_rls.sql =====
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

-- ===== 0004_seed.sql =====
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

-- ===== 0005_notifications.sql =====
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

-- ===== 0006_solicitudes_gestion.sql =====
-- ============================================================================
-- UTL 360 · 0006_solicitudes_gestion.sql
-- Gestión integral de solicitudes (modelo BASE SOLICITUDES) + historial
-- auditable de solicitudes y tareas + soporte para el tablero Kanban.
-- Ejecuta DESPUÉS de 0005_notifications.sql.
-- ============================================================================

-- ─────────────────────────── SEMÁFORO ───────────────────────────
do $$ begin
  create type semaforo as enum ('verde','amarillo','rojo');
exception when duplicate_object then null; end $$;

-- ─────────────── Campos del modelo "BASE SOLICITUDES" en requests ───────────────
-- Datos de contacto del solicitante (cuando no hay citizen_id vinculado)
alter table public.requests add column if not exists nombre_solicitante text;
alter table public.requests add column if not exists documento         text;
alter table public.requests add column if not exists telefono          text;
alter table public.requests add column if not exists email             text;
alter table public.requests add column if not exists direccion         text;

-- Campos específicos por categoría (salud / hoja de vida / entidad / general)
alter table public.requests add column if not exists edad              int;
alter table public.requests add column if not exists eps               text;
alter table public.requests add column if not exists diagnostico       text;
alter table public.requests add column if not exists entidad           text;
alter table public.requests add column if not exists nivel_academico   text;
alter table public.requests add column if not exists perfil            text;
alter table public.requests add column if not exists organizacion      text;

-- Gestión / seguimiento del trámite
alter table public.requests add column if not exists tramite           text;
alter table public.requests add column if not exists fecha_gestion     date;
alter table public.requests add column if not exists observaciones     text;
alter table public.requests add column if not exists persona_remite    text;
alter table public.requests add column if not exists persona_encargada text;
alter table public.requests add column if not exists persona_recibe    text;
alter table public.requests add column if not exists semaforo          semaforo not null default 'verde';
alter table public.requests add column if not exists seguimiento       boolean not null default false;
alter table public.requests add column if not exists alerta            text;

create index if not exists idx_requests_semaforo on public.requests(semaforo);
create index if not exists idx_requests_tipo on public.requests(tipo_solicitud);

-- ─────────────── Historial auditable de solicitudes ───────────────
create table if not exists public.request_history (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references public.requests(id) on delete cascade,
  tipo            text not null default 'nota',  -- nota | cambio_estado | semaforo | gestion | sistema
  descripcion     text,
  estado_anterior text,
  estado_nuevo    text,
  author_id       uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists idx_request_history_req on public.request_history(request_id, created_at desc);

-- Registra automáticamente los cambios de estado y de semáforo
create or replace function public.log_request_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.estado is distinct from old.estado then
      insert into public.request_history(request_id, tipo, descripcion, estado_anterior, estado_nuevo, author_id)
      values (new.id, 'cambio_estado',
              'Estado: ' || old.estado || ' → ' || new.estado,
              old.estado::text, new.estado::text, auth.uid());
    end if;
    if new.semaforo is distinct from old.semaforo then
      insert into public.request_history(request_id, tipo, descripcion, estado_anterior, estado_nuevo, author_id)
      values (new.id, 'semaforo',
              'Semáforo: ' || old.semaforo || ' → ' || new.semaforo,
              old.semaforo::text, new.semaforo::text, auth.uid());
    end if;
  elsif tg_op = 'INSERT' then
    insert into public.request_history(request_id, tipo, descripcion, estado_nuevo, author_id)
    values (new.id, 'sistema', 'Solicitud radicada ('||new.radicado||')', new.estado::text, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists trg_requests_history on public.requests;
create trigger trg_requests_history
  after insert or update on public.requests
  for each row execute function public.log_request_change();

-- ─────────────── Tareas: orden para Kanban + historial ───────────────
alter table public.tasks add column if not exists orden int not null default 0;

create table if not exists public.task_history (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references public.tasks(id) on delete cascade,
  tipo            text not null default 'cambio_estado',  -- cambio_estado | nota | sistema
  descripcion     text,
  estado_anterior text,
  estado_nuevo    text,
  author_id       uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists idx_task_history_task on public.task_history(task_id, created_at desc);

create or replace function public.log_task_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    insert into public.task_history(task_id, tipo, descripcion, estado_anterior, estado_nuevo, author_id)
    values (new.id, 'cambio_estado',
            'Estado: ' || old.estado || ' → ' || new.estado,
            old.estado::text, new.estado::text, auth.uid());
  elsif tg_op = 'INSERT' then
    insert into public.task_history(task_id, tipo, descripcion, estado_nuevo, author_id)
    values (new.id, 'sistema', 'Tarea creada', new.estado::text, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists trg_tasks_history on public.tasks;
create trigger trg_tasks_history
  after insert or update on public.tasks
  for each row execute function public.log_task_change();

-- ─────────────────────────── RLS ───────────────────────────
alter table public.request_history enable row level security;
alter table public.request_history force row level security;
alter table public.task_history    enable row level security;
alter table public.task_history    force row level security;

drop policy if exists request_history_staff on public.request_history;
create policy request_history_staff on public.request_history for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists task_history_staff on public.task_history;
create policy task_history_staff on public.task_history for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ===== 0007_workspaces_permisos.sql =====
-- ============================================================================
-- UTL 360 · 0007_workspaces_permisos.sql
-- 1) Workspaces de tareas con permisos por persona + asignación a usuarios.
-- 2) Roles dinámicos (roles_catalog) + permisos por módulo (role_permissions).
-- Ejecuta DESPUÉS de 0006. Idempotente.
-- ============================================================================

-- ─────────────────────────── WORKSPACES ───────────────────────────
create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  descripcion text,
  color       text not null default '#E30613',
  archivado   boolean not null default false,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  rol_workspace text not null default 'viewer' check (rol_workspace in ('owner','editor','viewer')),
  created_at    timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index if not exists idx_ws_members_ws on public.workspace_members(workspace_id);
create index if not exists idx_ws_members_user on public.workspace_members(user_id);

-- Vincular tareas a un workspace
alter table public.tasks add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
create index if not exists idx_tasks_workspace on public.tasks(workspace_id);

drop trigger if exists trg_workspaces_updated on public.workspaces;
create trigger trg_workspaces_updated before update on public.workspaces
  for each row execute function public.set_updated_at();

-- Helpers de pertenencia
create or replace function public.is_workspace_member(p_ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.workspace_members
    where workspace_id = p_ws and user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_editor(p_ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.workspace_members
    where workspace_id = p_ws and user_id = auth.uid()
      and rol_workspace in ('owner','editor')
  );
$$;

create or replace function public.is_workspace_owner(p_ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.workspace_members
    where workspace_id = p_ws and user_id = auth.uid() and rol_workspace = 'owner'
  );
$$;

-- ─────────────── RLS workspaces ───────────────
alter table public.workspaces enable row level security;
alter table public.workspaces force row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_members force row level security;

drop policy if exists ws_select on public.workspaces;
create policy ws_select on public.workspaces for select to authenticated
  using (public.is_workspace_member(id) or created_by = auth.uid());

drop policy if exists ws_insert on public.workspaces;
create policy ws_insert on public.workspaces for insert to authenticated
  with check (public.is_staff() and created_by = auth.uid());

drop policy if exists ws_update on public.workspaces;
create policy ws_update on public.workspaces for update to authenticated
  using (public.is_workspace_owner(id)) with check (public.is_workspace_owner(id));

drop policy if exists ws_delete on public.workspaces;
create policy ws_delete on public.workspaces for delete to authenticated
  using (public.is_workspace_owner(id));

drop policy if exists ws_members_select on public.workspace_members;
create policy ws_members_select on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id) or user_id = auth.uid());

drop policy if exists ws_members_manage on public.workspace_members;
create policy ws_members_manage on public.workspace_members for all to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

-- ─────────────── tasks: RLS sensible a workspace ───────────────
drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks for select to authenticated
  using (
    public.is_admin()
    or (workspace_id is null and public.is_staff())
    or responsable_id = auth.uid()
    or creador_id = auth.uid()
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated
  with check (
    public.is_staff()
    and (workspace_id is null or public.is_workspace_editor(workspace_id))
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
  using (
    public.is_admin()
    or public.has_role('coordinador_utl'::app_role)
    or responsable_id = auth.uid()
    or creador_id = auth.uid()
    or (workspace_id is not null and public.is_workspace_editor(workspace_id))
  ) with check (true);

-- ═══════════════════════ ROLES Y PERMISOS DINÁMICOS ═══════════════════════
-- Catálogo de roles: sistema (12) + personalizados que cree el admin.
-- base_role (enum) define el nivel de SEGURIDAD de datos (RLS); role_key es
-- el rol "visible" que controla qué módulos ve cada quien en el panel.
create table if not exists public.roles_catalog (
  key         text primary key,
  label       text not null,
  descripcion text,
  is_system   boolean not null default false,
  base_role   app_role not null default 'consulta',
  created_at  timestamptz not null default now()
);

create table if not exists public.role_permissions (
  id         uuid primary key default gen_random_uuid(),
  role_key   text not null references public.roles_catalog(key) on delete cascade,
  module     text not null,
  can_view   boolean not null default false,
  can_create boolean not null default false,
  can_edit   boolean not null default false,
  can_delete boolean not null default false,
  unique (role_key, module)
);
create index if not exists idx_role_perms_key on public.role_permissions(role_key);

-- Rol "visible" asignado al usuario (sistema o personalizado)
alter table public.user_roles add column if not exists role_key text;

-- ─────────────── Helper de permiso por módulo (para nav/acceso) ───────────────
create or replace function public.can_view_module(p_module text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.user_roles ur
    join public.role_permissions rp on rp.role_key = ur.role_key
    where ur.user_id = auth.uid() and rp.module = p_module and rp.can_view
  );
$$;

-- ─────────────── RLS roles/permisos ───────────────
alter table public.roles_catalog enable row level security;
alter table public.roles_catalog force row level security;
alter table public.role_permissions enable row level security;
alter table public.role_permissions force row level security;

drop policy if exists roles_catalog_read on public.roles_catalog;
create policy roles_catalog_read on public.roles_catalog for select to authenticated using (true);
drop policy if exists roles_catalog_admin on public.roles_catalog;
create policy roles_catalog_admin on public.roles_catalog for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists role_perms_read on public.role_permissions;
create policy role_perms_read on public.role_permissions for select to authenticated using (true);
drop policy if exists role_perms_admin on public.role_permissions;
create policy role_perms_admin on public.role_permissions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─────────────── Seed: roles del sistema ───────────────
insert into public.roles_catalog (key, label, is_system, base_role, descripcion) values
  ('super_admin','Super Administrador',true,'super_admin','Acceso total al sistema'),
  ('administrador','Administrador',true,'administrador','Gestión total excepto config crítica'),
  ('direccion_general','Dirección General',true,'direccion_general','Lectura total y aprobación'),
  ('coordinador_utl','Coordinador UTL',true,'coordinador_utl','Coordinación de áreas y agenda'),
  ('juridico_legislativo','Jurídico / Legislativo',true,'juridico_legislativo','Documentos y solicitudes formales'),
  ('comunicaciones','Comunicaciones',true,'comunicaciones','Contenidos y calendario editorial'),
  ('coordinador_territorial','Coordinador Territorial',true,'coordinador_territorial','Zonas, eventos y líderes'),
  ('gestor_territorial','Gestor Territorial',true,'gestor_territorial','Gestión por zona asignada'),
  ('atencion_ciudadana','Atención Ciudadana',true,'atencion_ciudadana','CRM y solicitudes'),
  ('analitica_reportes','Analítica / Reportes',true,'analitica_reportes','Lectura y reportes'),
  ('voluntario','Voluntario',true,'voluntario','Tareas asignadas y eventos'),
  ('consulta','Consulta',true,'consulta','Solo lectura')
on conflict (key) do update set label = excluded.label, base_role = excluded.base_role;

-- Backfill role_key en user_roles existentes
update public.user_roles set role_key = role::text where role_key is null;

-- ─────────────── Seed: permisos (can_view) por módulo ───────────────
-- Módulos visibles para todos los roles del sistema
insert into public.role_permissions (role_key, module, can_view)
select key, m, true from public.roles_catalog, unnest(array['panel','tareas','calendario']) m
where is_system on conflict (role_key, module) do nothing;

-- Módulos restringidos: (módulo, roles permitidos)
insert into public.role_permissions (role_key, module, can_view)
select r.key, x.module, true
from (values
  ('ciudadanos', array['super_admin','administrador','direccion_general','coordinador_utl','atencion_ciudadana','coordinador_territorial','gestor_territorial','analitica_reportes']),
  ('solicitudes', array['super_admin','administrador','direccion_general','coordinador_utl','juridico_legislativo','atencion_ciudadana','coordinador_territorial','gestor_territorial','analitica_reportes']),
  ('territorio', array['super_admin','administrador','direccion_general','coordinador_utl','coordinador_territorial','gestor_territorial','analitica_reportes']),
  ('comunicaciones', array['super_admin','administrador','direccion_general','coordinador_utl','comunicaciones']),
  ('documentos', array['super_admin','administrador','direccion_general','coordinador_utl','juridico_legislativo','comunicaciones']),
  ('reportes', array['super_admin','administrador','direccion_general','coordinador_utl','analitica_reportes']),
  ('ia', array['super_admin','administrador','direccion_general','coordinador_utl','comunicaciones','juridico_legislativo']),
  ('notificaciones', array['super_admin','administrador','direccion_general','coordinador_utl','comunicaciones']),
  ('configuracion', array['super_admin','administrador'])
) as x(module, roles)
join public.roles_catalog r on r.key = any(x.roles)
on conflict (role_key, module) do nothing;

-- can_create / can_edit para roles operativos (no solo-lectura)
update public.role_permissions set can_create = true, can_edit = true
where can_view = true
  and role_key not in ('consulta','analitica_reportes','voluntario','direccion_general');

-- can_delete solo para administradores
update public.role_permissions set can_delete = true
where role_key in ('super_admin','administrador');

-- ===== 0008_task_assignees.sql =====
-- ============================================================================
-- UTL 360 · 0008_task_assignees.sql
-- Responsables y participantes (varios) por tarea + helper de edición.
-- Ejecuta DESPUÉS de 0007. Idempotente.
-- ============================================================================

create table if not exists public.task_assignees (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  rol        text not null default 'participante' check (rol in ('responsable','participante')),
  created_at timestamptz not null default now(),
  unique (task_id, user_id)
);
create index if not exists idx_task_assignees_task on public.task_assignees(task_id);
create index if not exists idx_task_assignees_user on public.task_assignees(user_id);

-- ¿Puede el usuario editar/gestionar esta tarea?
create or replace function public.can_edit_task(p_task uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.tasks t
    where t.id = p_task and (
      t.creador_id = auth.uid()
      or t.responsable_id = auth.uid()
      or public.has_role('coordinador_utl'::app_role)
      or (t.workspace_id is not null and public.is_workspace_editor(t.workspace_id))
      or exists (
        select 1 from public.task_assignees ta
        where ta.task_id = t.id and ta.user_id = auth.uid() and ta.rol = 'responsable'
      )
    )
  );
$$;

-- ─────────────── RLS ───────────────
alter table public.task_assignees enable row level security;
alter table public.task_assignees force row level security;

drop policy if exists task_assignees_read on public.task_assignees;
create policy task_assignees_read on public.task_assignees for select to authenticated
  using (public.is_staff());

drop policy if exists task_assignees_write on public.task_assignees;
create policy task_assignees_write on public.task_assignees for all to authenticated
  using (public.can_edit_task(task_id))
  with check (public.can_edit_task(task_id));

-- ─────────────── Backfill: responsable_id actual → responsable ───────────────
insert into public.task_assignees (task_id, user_id, rol)
select id, responsable_id, 'responsable'
from public.tasks
where responsable_id is not null
on conflict (task_id, user_id) do nothing;

-- ===== 0009_attachments_portada.sql =====
-- ============================================================================
-- UTL 360 · 0009_attachments_portada.sql
-- Adjuntos acumulativos (archivos + enlaces) en tareas + portada de workspace.
-- Crea buckets de Storage y sus políticas. Ejecuta DESPUÉS de 0008.
-- ============================================================================

-- ─────────────── Portada de workspace ───────────────
alter table public.workspaces add column if not exists portada_url text;

-- ─────────────── Adjuntos de tarea (acumulativo) ───────────────
create table if not exists public.task_attachments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  tipo        text not null default 'archivo' check (tipo in ('archivo','link')),
  nombre      text not null,
  url         text not null,
  storage_path text,            -- ruta dentro del bucket (para poder borrar el objeto)
  mime        text,
  size        bigint,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_task_attachments_task on public.task_attachments(task_id, created_at desc);

alter table public.task_attachments enable row level security;
alter table public.task_attachments force row level security;

drop policy if exists task_attachments_read on public.task_attachments;
create policy task_attachments_read on public.task_attachments for select to authenticated
  using (public.is_staff());

drop policy if exists task_attachments_write on public.task_attachments;
create policy task_attachments_write on public.task_attachments for all to authenticated
  using (public.can_edit_task(task_id))
  with check (public.can_edit_task(task_id));

-- ─────────────── Buckets de Storage ───────────────
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('task-files','task-files', true, 26214400),          -- 25 MB
  ('workspace-covers','workspace-covers', true, 6291456) -- 6 MB
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

-- Políticas sobre storage.objects (lectura pública; escritura autenticada)
drop policy if exists "utl read task-files" on storage.objects;
create policy "utl read task-files" on storage.objects for select to public
  using (bucket_id = 'task-files');
drop policy if exists "utl write task-files" on storage.objects;
create policy "utl write task-files" on storage.objects for insert to authenticated
  with check (bucket_id = 'task-files');
drop policy if exists "utl delete task-files" on storage.objects;
create policy "utl delete task-files" on storage.objects for delete to authenticated
  using (bucket_id = 'task-files');

drop policy if exists "utl read covers" on storage.objects;
create policy "utl read covers" on storage.objects for select to public
  using (bucket_id = 'workspace-covers');
drop policy if exists "utl write covers" on storage.objects;
create policy "utl write covers" on storage.objects for insert to authenticated
  with check (bucket_id = 'workspace-covers');
drop policy if exists "utl delete covers" on storage.objects;
create policy "utl delete covers" on storage.objects for delete to authenticated
  using (bucket_id = 'workspace-covers');

-- ===== 0010_contactos.sql =====
-- ============================================================================
-- UTL 360 · 0010_contactos.sql
-- Módulo de contactos: red de contactos, vínculo con territorios, tareas y
-- ciudadanos referidos; fotos y documentos. Ejecuta DESPUÉS de 0009.
-- ============================================================================

create table if not exists public.contacts (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,
  apellido           text,
  foto_url           text,
  puesto             text,                 -- cargo / puesto
  organizacion       text,
  tipo               text not null default 'aliado',  -- lider|funcionario|aliado|medio|comunidad|institucion|otro
  telefono           text,
  whatsapp           text,
  email              text,
  direccion          text,
  localidad          text,
  barrio             text,
  zona_id            uuid references public.zones(id) on delete set null,
  influencia         text,                 -- alta|media|baja
  notas              text,
  etiquetas          text[] default '{}',
  estado             text not null default 'activo',
  contexto_operativo contexto_operativo not null default 'comunitario',
  created_by         uuid references auth.users(id) on delete set null,
  updated_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);
create index if not exists idx_contacts_zona on public.contacts(zona_id);
create index if not exists idx_contacts_tipo on public.contacts(tipo);
create index if not exists idx_contacts_nombre_trgm on public.contacts using gin (nombre gin_trgm_ops);

-- Red de contactos (grafo)
create table if not exists public.contact_relations (
  id                 uuid primary key default gen_random_uuid(),
  contact_id         uuid not null references public.contacts(id) on delete cascade,
  related_contact_id uuid not null references public.contacts(id) on delete cascade,
  tipo_relacion      text not null default 'aliado',
  nota               text,
  created_at         timestamptz not null default now(),
  check (contact_id <> related_contact_id),
  unique (contact_id, related_contact_id)
);
create index if not exists idx_contact_rel_a on public.contact_relations(contact_id);
create index if not exists idx_contact_rel_b on public.contact_relations(related_contact_id);

-- Documentos / archivos de un contacto (acumulativo)
create table if not exists public.contact_documents (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid not null references public.contacts(id) on delete cascade,
  tipo         text not null default 'archivo' check (tipo in ('archivo','link')),
  nombre       text not null,
  url          text not null,
  storage_path text,
  mime         text,
  size         bigint,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_contact_docs on public.contact_documents(contact_id, created_at desc);

-- Vínculos: tareas para un contacto + ciudadanos referidos por un contacto
alter table public.tasks add column if not exists contact_id uuid references public.contacts(id) on delete set null;
create index if not exists idx_tasks_contact on public.tasks(contact_id);

alter table public.citizens add column if not exists referido_por_contact_id uuid references public.contacts(id) on delete set null;
create index if not exists idx_citizens_referido on public.citizens(referido_por_contact_id);

-- updated_at + auditoría
drop trigger if exists trg_contacts_updated on public.contacts;
create trigger trg_contacts_updated before update on public.contacts
  for each row execute function public.set_updated_at();
drop trigger if exists trg_contacts_audit on public.contacts;
create trigger trg_contacts_audit after insert or update or delete on public.contacts
  for each row execute function public.log_audit_event();

-- ─────────────── Permisos / RLS ───────────────
create or replace function public.can_manage_contacts()
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_admin()
    or public.has_role('direccion_general'::app_role)
    or public.has_role('coordinador_utl'::app_role)
    or public.has_role('coordinador_territorial'::app_role)
    or public.has_role('gestor_territorial'::app_role)
    or public.has_role('atencion_ciudadana'::app_role);
$$;

do $$
declare t text;
begin
  foreach t in array array['contacts','contact_relations','contact_documents'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
  end loop;
end $$;

drop policy if exists contacts_read on public.contacts;
create policy contacts_read on public.contacts for select to authenticated using (public.is_staff());
drop policy if exists contacts_write on public.contacts;
create policy contacts_write on public.contacts for all to authenticated
  using (public.can_manage_contacts()) with check (public.can_manage_contacts());

drop policy if exists contact_rel_read on public.contact_relations;
create policy contact_rel_read on public.contact_relations for select to authenticated using (public.is_staff());
drop policy if exists contact_rel_write on public.contact_relations;
create policy contact_rel_write on public.contact_relations for all to authenticated
  using (public.can_manage_contacts()) with check (public.can_manage_contacts());

drop policy if exists contact_docs_read on public.contact_documents;
create policy contact_docs_read on public.contact_documents for select to authenticated using (public.is_staff());
drop policy if exists contact_docs_write on public.contact_documents;
create policy contact_docs_write on public.contact_documents for all to authenticated
  using (public.can_manage_contacts()) with check (public.can_manage_contacts());

-- ─────────────── Storage: archivos/fotos de contactos ───────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('contact-files','contact-files', true, 26214400)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

drop policy if exists "utl read contact-files" on storage.objects;
create policy "utl read contact-files" on storage.objects for select to public using (bucket_id = 'contact-files');
drop policy if exists "utl write contact-files" on storage.objects;
create policy "utl write contact-files" on storage.objects for insert to authenticated with check (bucket_id = 'contact-files');
drop policy if exists "utl delete contact-files" on storage.objects;
create policy "utl delete contact-files" on storage.objects for delete to authenticated using (bucket_id = 'contact-files');

-- ─────────────── Permisos de módulo 'contactos' ───────────────
insert into public.role_permissions (role_key, module, can_view, can_create, can_edit, can_delete)
select r.key, 'contactos', true,
  r.key in ('super_admin','administrador','coordinador_utl','coordinador_territorial','gestor_territorial','atencion_ciudadana'),
  r.key in ('super_admin','administrador','coordinador_utl','coordinador_territorial','gestor_territorial','atencion_ciudadana'),
  r.key in ('super_admin','administrador')
from public.roles_catalog r
where r.key in ('super_admin','administrador','direccion_general','coordinador_utl','coordinador_territorial','gestor_territorial','atencion_ciudadana','analitica_reportes')
on conflict (role_key, module) do nothing;

-- ─────────────── Seed demo ───────────────
insert into public.contacts (nombre, apellido, puesto, organizacion, tipo, telefono, localidad, zona_id, influencia, estado)
select x.nombre, x.apellido, x.puesto, x.org, x.tipo, x.tel, x.loc,
  (select id from public.zones z where z.nombre_zona = x.zona limit 1), x.inf, 'activo'
from (values
  ('Marta','Lozano','Presidenta JAC','JAC Patio Bonito','lider','3101112233','Kennedy','Kennedy','alta'),
  ('Hernán','Ruiz','Edil','JAL Ciudad Bolívar','funcionario','3102223344','Ciudad Bolívar','Ciudad Bolívar','media'),
  ('Colectivo Río Fucha','','Vocería ambiental','Mesa Ambiental','comunidad','3103334455','San Cristóbal','San Cristóbal','media'),
  ('Radio Comunitaria Suba','','Director','Emisora local','medio','3104445566','Suba','Suba','alta')
) as x(nombre, apellido, puesto, org, tipo, tel, loc, zona, inf)
on conflict do nothing;
