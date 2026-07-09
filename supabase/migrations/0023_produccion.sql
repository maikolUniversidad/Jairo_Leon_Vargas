-- ============================================================================
-- UTL 360 · 0023_produccion.sql
-- Submódulo de Comunicaciones: Producción de video (IA).
--   · video_projects     : tablero de videos (idea → guión → producción → publicado).
--   · video_research     : notas de investigación de temas por proyecto.
--   · video_generations  : trabajos de imagen/video en Higgsfield (asíncronos).
--   · video_virality     : análisis de viralidad + recomendaciones por proyecto.
-- Generación real: texto con la IA ya configurada (DeepSeek/OpenAI); imagen/video
-- con Higgsfield Cloud API; investigación con una API de búsqueda web. Sin llave,
-- cada capacidad cae a modo mock (igual que el Asistente IA).
-- Ejecuta DESPUÉS de 0022. Idempotente.
-- ============================================================================

do $$ begin
  create type video_fase as enum
    ('idea','investigacion','guion','produccion','edicion','aprobado','publicado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type generation_kind as enum ('imagen','video');
exception when duplicate_object then null; end $$;

do $$ begin
  create type generation_status as enum ('pending','processing','completed','failed');
exception when duplicate_object then null; end $$;

-- ─────────────── Proyectos de video (el hub del tablero) ───────────────
create table if not exists public.video_projects (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  descripcion   text,
  fase          video_fase not null default 'idea',
  objetivo      text,                                 -- mensaje / objetivo del video
  plataformas   text[] not null default '{}',         -- TikTok, Reels, YouTube Shorts, ...
  -- Artefactos de texto canónicos del proyecto (borradores editables por humano).
  guion             text,
  copy_text         text,
  descripcion_video text,
  titulos           jsonb not null default '[]'::jsonb, -- opciones de título
  hashtags          text[] not null default '{}',
  portada_url       text,                              -- portada elegida (de una generación)
  -- Enlaces opcionales a otros módulos (sin duplicarlos).
  post_id       uuid references public.content_posts(id) on delete set null,
  cobertura_id  uuid references public.coberturas(id) on delete set null,
  responsable_id uuid references auth.users(id) on delete set null,
  contexto_operativo text not null default 'comunicacional',
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index if not exists idx_video_projects_fase on public.video_projects(fase);
create index if not exists idx_video_projects_created on public.video_projects(created_at desc);

-- ─────────────── Investigación de temas ───────────────
create table if not exists public.video_research (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.video_projects(id) on delete cascade,
  tema        text not null,
  contenido   text,                                   -- síntesis de IA (ángulos, ganchos)
  fuentes     jsonb not null default '[]'::jsonb,     -- [{title,url,snippet}]
  fuente_ia   text,                                   -- proveedor usado (deepseek/openai/mock)
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_video_research_project on public.video_research(project_id, created_at desc);

-- ─────────────── Generaciones visuales (Higgsfield) ───────────────
create table if not exists public.video_generations (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.video_projects(id) on delete cascade,
  kind        generation_kind not null default 'imagen',
  prompt      text not null,
  status      generation_status not null default 'pending',
  provider    text not null default 'higgsfield',
  external_id text,                                   -- id del job en Higgsfield
  result_url  text,                                   -- URL del asset generado
  error       text,
  params      jsonb not null default '{}'::jsonb,     -- {model,width,height,duration,image_url,...}
  is_portada  boolean not null default false,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_video_generations_project on public.video_generations(project_id, created_at desc);
create index if not exists idx_video_generations_status on public.video_generations(status);

-- ─────────────── Análisis de viralidad + recomendaciones ───────────────
create table if not exists public.video_virality (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.video_projects(id) on delete cascade,
  target         text not null default 'idea',        -- idea|guion|portada|video
  input_ref      text,                                -- texto o URL analizada
  score          int,                                 -- 0..100
  veredicto      text,
  fortalezas     text[] not null default '{}',
  riesgos        text[] not null default '{}',
  recomendaciones text[] not null default '{}',
  raw            jsonb not null default '{}'::jsonb,
  fuente         text,                                -- proveedor (deepseek/openai/higgsfield/mock)
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists idx_video_virality_project on public.video_virality(project_id, created_at desc);

-- ─────────────── ¿Quién gestiona producción de video? ───────────────
create or replace function public.can_manage_produccion()
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_admin()
    or public.has_role('direccion_general'::app_role)
    or public.has_role('coordinador_utl'::app_role)
    or public.has_role('comunicaciones'::app_role);
$$;

-- ─────────────── RLS ───────────────
alter table public.video_projects    enable row level security;
alter table public.video_projects    force row level security;
alter table public.video_research     enable row level security;
alter table public.video_research     force row level security;
alter table public.video_generations  enable row level security;
alter table public.video_generations  force row level security;
alter table public.video_virality     enable row level security;
alter table public.video_virality     force row level security;

drop policy if exists video_projects_read on public.video_projects;
create policy video_projects_read on public.video_projects for select to authenticated
  using (public.is_staff() and deleted_at is null);
drop policy if exists video_projects_write on public.video_projects;
create policy video_projects_write on public.video_projects for all to authenticated
  using (public.can_manage_produccion()) with check (public.can_manage_produccion());

drop policy if exists video_research_read on public.video_research;
create policy video_research_read on public.video_research for select to authenticated
  using (public.is_staff());
drop policy if exists video_research_write on public.video_research;
create policy video_research_write on public.video_research for all to authenticated
  using (public.can_manage_produccion()) with check (public.can_manage_produccion());

drop policy if exists video_generations_read on public.video_generations;
create policy video_generations_read on public.video_generations for select to authenticated
  using (public.is_staff());
drop policy if exists video_generations_write on public.video_generations;
create policy video_generations_write on public.video_generations for all to authenticated
  using (public.can_manage_produccion()) with check (public.can_manage_produccion());

drop policy if exists video_virality_read on public.video_virality;
create policy video_virality_read on public.video_virality for select to authenticated
  using (public.is_staff());
drop policy if exists video_virality_write on public.video_virality;
create policy video_virality_write on public.video_virality for all to authenticated
  using (public.can_manage_produccion()) with check (public.can_manage_produccion());

-- ─────────────── Triggers updated_at + auditoría ───────────────
drop trigger if exists trg_video_projects_updated on public.video_projects;
create trigger trg_video_projects_updated before update on public.video_projects
  for each row execute function public.set_updated_at();

drop trigger if exists trg_video_generations_updated on public.video_generations;
create trigger trg_video_generations_updated before update on public.video_generations
  for each row execute function public.set_updated_at();

drop trigger if exists trg_video_projects_audit on public.video_projects;
create trigger trg_video_projects_audit
  after insert or update or delete on public.video_projects
  for each row execute function public.log_audit_event();
