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
