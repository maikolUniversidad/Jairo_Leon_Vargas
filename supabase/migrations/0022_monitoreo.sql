-- ============================================================================
-- UTL 360 · 0022_monitoreo.sql
-- Submódulo de Comunicaciones: monitoreo de personas (inteligencia mediática).
--   · monitor_persons: personas fichadas (relación, cargo, redes, palabras clave).
--   · monitor_items: noticias / menciones / publicaciones recolectadas.
--   · monitor_runs: bitácora de cada recolección (auditoría).
-- Recolección real: noticias vía RSS de Google News (gratis) + X/otras redes por
-- clave (opcional). Análisis con la IA ya configurada.
-- Ejecuta DESPUÉS de 0021. Idempotente.
-- ============================================================================

do $$ begin
  create type monitor_relacion as enum ('propio','aliado','contraposicion','neutral','objetivo');
exception when duplicate_object then null; end $$;

-- ─────────────── Personas monitoreadas ───────────────
create table if not exists public.monitor_persons (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  alias         text[] not null default '{}',
  relacion      monitor_relacion not null default 'objetivo',
  cargo         text,
  partido       text,
  foto_url      text,
  etiquetas     text[] not null default '{}',
  handles       jsonb not null default '{}'::jsonb,   -- {x, facebook, instagram, tiktok, youtube}
  keywords      text[] not null default '{}',         -- términos de búsqueda
  notas         text,
  ultimo_analisis text,                               -- brief generado por IA
  analisis_at   timestamptz,
  ultima_recoleccion timestamptz,
  activo        boolean not null default true,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index if not exists idx_monitor_persons_relacion on public.monitor_persons(relacion);

-- ─────────────── Items recolectados ───────────────
create table if not exists public.monitor_items (
  id           uuid primary key default gen_random_uuid(),
  person_id    uuid not null references public.monitor_persons(id) on delete cascade,
  fuente       text not null default 'noticia',  -- noticia|x|facebook|instagram|tiktok|youtube|web|manual
  tipo         text not null default 'mencion',  -- noticia|post|mencion|video
  titulo       text,
  contenido    text,
  url          text,
  autor        text,
  autor_handle text,
  sentimiento  text,                             -- positivo|negativo|neutral (opcional)
  relevancia   int not null default 0,
  published_at timestamptz,
  fetched_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);
create index if not exists idx_monitor_items_person on public.monitor_items(person_id, published_at desc);
create index if not exists idx_monitor_items_fuente on public.monitor_items(fuente);

-- ─────────────── Bitácora de recolecciones ───────────────
create table if not exists public.monitor_runs (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references public.monitor_persons(id) on delete cascade,
  fuentes    text[] not null default '{}',
  total      int not null default 0,
  resultado  jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_monitor_runs_person on public.monitor_runs(person_id, created_at desc);

-- ─────────────── ¿Quién gestiona el monitoreo? ───────────────
create or replace function public.can_manage_monitoreo()
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_admin()
    or public.has_role('direccion_general'::app_role)
    or public.has_role('coordinador_utl'::app_role)
    or public.has_role('comunicaciones'::app_role);
$$;

-- ─────────────── RLS ───────────────
alter table public.monitor_persons enable row level security;
alter table public.monitor_persons force row level security;
alter table public.monitor_items   enable row level security;
alter table public.monitor_items   force row level security;
alter table public.monitor_runs    enable row level security;
alter table public.monitor_runs    force row level security;

drop policy if exists monitor_persons_read on public.monitor_persons;
create policy monitor_persons_read on public.monitor_persons for select to authenticated
  using (public.is_staff() and deleted_at is null);
drop policy if exists monitor_persons_write on public.monitor_persons;
create policy monitor_persons_write on public.monitor_persons for all to authenticated
  using (public.can_manage_monitoreo()) with check (public.can_manage_monitoreo());

drop policy if exists monitor_items_read on public.monitor_items;
create policy monitor_items_read on public.monitor_items for select to authenticated
  using (public.is_staff());
drop policy if exists monitor_items_write on public.monitor_items;
create policy monitor_items_write on public.monitor_items for all to authenticated
  using (public.can_manage_monitoreo()) with check (public.can_manage_monitoreo());

drop policy if exists monitor_runs_read on public.monitor_runs;
create policy monitor_runs_read on public.monitor_runs for select to authenticated
  using (public.is_staff());
drop policy if exists monitor_runs_write on public.monitor_runs;
create policy monitor_runs_write on public.monitor_runs for all to authenticated
  using (public.can_manage_monitoreo()) with check (public.can_manage_monitoreo());

-- ─────────────── Triggers updated_at + auditoría ───────────────
drop trigger if exists trg_monitor_persons_updated on public.monitor_persons;
create trigger trg_monitor_persons_updated before update on public.monitor_persons
  for each row execute function public.set_updated_at();

drop trigger if exists trg_monitor_persons_audit on public.monitor_persons;
create trigger trg_monitor_persons_audit
  after insert or update or delete on public.monitor_persons
  for each row execute function public.log_audit_event();

-- ─────────────── Seed: Jairo León Vargas (primera ficha) ───────────────
insert into public.monitor_persons (nombre, relacion, cargo, partido, keywords, handles, notas)
select
  'Jairo León Vargas', 'propio',
  'Candidato a Cámara por Bogotá D.C.', 'Pacto Histórico',
  array['Jairo León Vargas','Jairo Leon Vargas'],
  jsonb_build_object('x','','facebook','','instagram','','tiktok','','youtube',''),
  'Figura propia. Monitoreo de reputación, menciones y narrativa en medios y redes.'
where not exists (
  select 1 from public.monitor_persons where lower(nombre) = lower('Jairo León Vargas') and deleted_at is null
);
