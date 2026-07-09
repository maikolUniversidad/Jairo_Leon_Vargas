-- ============================================================================
-- UTL 360 · 0027_avatares.sql
-- Submódulo de Comunicaciones: AVATARES (personajes de marca para generar
-- contenido con personalidad, imagen y voz).
--   · avatars       : personajes de marca (personalidad, look, voz).
--   · avatar_models : catálogo de modelos de generación (imagen/video/voz/3d).
--   · avatar_jobs   : trabajos de generación (voz automática vía ElevenLabs;
--                     imagen/video vía Higgsfield — API REST o asistido).
-- Arquitectura HÍBRIDA:
--   - Voz: ElevenLabs REST (automático) cuando hay conexión configurada.
--   - Imagen/Video: se registran como "trabajo" y se completan por API de
--     Higgsfield (cuando hay clave) o de forma asistida (MCP) subiendo el asset.
-- Las CLAVES de ElevenLabs/Higgsfield se guardan como conexiones en app_secrets
-- (Configuración → Integraciones), NO en esta migración.
-- Ejecuta DESPUÉS de 0026. Idempotente.
-- ============================================================================

-- ─────────────── ¿Quién gestiona avatares? ───────────────
create or replace function public.can_manage_avatares()
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_admin()
    or public.has_role('direccion_general'::app_role)
    or public.has_role('coordinador_utl'::app_role)
    or public.has_role('comunicaciones'::app_role);
$$;

-- ─────────────── Avatares (personajes de marca) ───────────────
create table if not exists public.avatars (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  slug           text unique,
  arquetipo      text,                                  -- p. ej. "vocero", "reportero", "juvenil"
  descripcion    text,                                  -- pitch corto del personaje
  personalidad   text,                                  -- bio/personalidad (puede autogenerarse con IA)
  tono           text,                                  -- p. ej. "cercano, firme, esperanzador"
  valores        text[] not null default '{}',          -- valores/temas que encarna
  estilo_visual  text,                                  -- descripción del look (para prompts de imagen)
  foto_refs      text[] not null default '{}',          -- URLs de imágenes de referencia (consistencia)
  avatar_url     text,                                  -- retrato principal del personaje
  -- Voz
  voice_provider text not null default 'elevenlabs',    -- elevenlabs|higgsfield|otro
  voice_id       text,                                  -- id de la voz en el proveedor
  voice_name     text,
  voice_settings jsonb not null default '{}'::jsonb,     -- {stability, similarity_boost, style, model}
  -- Modelos preferidos por defecto (claves de avatar_models)
  modelo_imagen  text,
  modelo_video   text,
  activo         boolean not null default true,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index if not exists idx_avatars_activo on public.avatars(activo) where deleted_at is null;

-- ─────────────── Catálogo de modelos de generación ───────────────
create table if not exists public.avatar_models (
  clave         text primary key,                        -- id estable p. ej. 'hf-soul'
  proveedor     text not null,                           -- higgsfield|elevenlabs|otro
  tipo          text not null,                           -- imagen|video|voz|3d
  label         text not null,
  descripcion   text,
  params_schema jsonb not null default '{}'::jsonb,       -- pistas de parámetros para la UI
  activo        boolean not null default true,
  orden         int not null default 0
);

-- ─────────────── Trabajos de generación ───────────────
create table if not exists public.avatar_jobs (
  id           uuid primary key default gen_random_uuid(),
  avatar_id    uuid not null references public.avatars(id) on delete cascade,
  tipo         text not null default 'imagen',           -- imagen|video|voz|3d
  modelo       text,                                     -- clave de avatar_models
  proveedor    text,                                     -- higgsfield|elevenlabs|otro
  titulo       text,
  prompt       text,                                     -- prompt/guion de generación
  params       jsonb not null default '{}'::jsonb,        -- parámetros específicos del modelo
  input_refs   text[] not null default '{}',             -- imágenes/audio de entrada
  estado       text not null default 'pendiente',        -- pendiente|procesando|listo|error
  provider_job_id text,                                  -- id del job en el proveedor (para polling)
  output_url   text,                                     -- resultado final (imagen/video/mp3)
  output_meta  jsonb not null default '{}'::jsonb,        -- {duration, width, height, mime…}
  error_msg    text,
  -- Vínculos con otras herramientas de Comunicaciones
  post_id      uuid,                                     -- publicación a la que se adjuntó
  cobertura_id uuid,                                     -- cobertura (Drive) a la que se subió
  drive_file_id text,
  person_id    uuid,                                     -- persona de monitoreo usada como insumo
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_avatar_jobs_avatar on public.avatar_jobs(avatar_id, created_at desc);
create index if not exists idx_avatar_jobs_estado on public.avatar_jobs(estado);

-- ─────────────── RLS ───────────────
alter table public.avatars       enable row level security;
alter table public.avatars       force row level security;
alter table public.avatar_models enable row level security;
alter table public.avatar_models force row level security;
alter table public.avatar_jobs   enable row level security;
alter table public.avatar_jobs   force row level security;

drop policy if exists avatars_read on public.avatars;
create policy avatars_read on public.avatars for select to authenticated
  using (public.is_staff() and deleted_at is null);
drop policy if exists avatars_write on public.avatars;
create policy avatars_write on public.avatars for all to authenticated
  using (public.can_manage_avatares()) with check (public.can_manage_avatares());

drop policy if exists avatar_models_read on public.avatar_models;
create policy avatar_models_read on public.avatar_models for select to authenticated
  using (public.is_staff());
drop policy if exists avatar_models_write on public.avatar_models;
create policy avatar_models_write on public.avatar_models for all to authenticated
  using (public.can_manage_avatares()) with check (public.can_manage_avatares());

drop policy if exists avatar_jobs_read on public.avatar_jobs;
create policy avatar_jobs_read on public.avatar_jobs for select to authenticated
  using (public.is_staff());
drop policy if exists avatar_jobs_write on public.avatar_jobs;
create policy avatar_jobs_write on public.avatar_jobs for all to authenticated
  using (public.can_manage_avatares()) with check (public.can_manage_avatares());

-- ─────────────── Triggers updated_at + auditoría ───────────────
drop trigger if exists trg_avatars_updated on public.avatars;
create trigger trg_avatars_updated before update on public.avatars
  for each row execute function public.set_updated_at();

drop trigger if exists trg_avatar_jobs_updated on public.avatar_jobs;
create trigger trg_avatar_jobs_updated before update on public.avatar_jobs
  for each row execute function public.set_updated_at();

drop trigger if exists trg_avatars_audit on public.avatars;
create trigger trg_avatars_audit
  after insert or update or delete on public.avatars
  for each row execute function public.log_audit_event();

-- ─────────────── Bucket de assets de avatares (público) ───────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars','avatars', true, 26214400)  -- 25 MB (video corto/imagen/audio)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

drop policy if exists "utl read avatars" on storage.objects;
create policy "utl read avatars" on storage.objects for select to public using (bucket_id = 'avatars');
drop policy if exists "utl write avatars" on storage.objects;
create policy "utl write avatars" on storage.objects for insert to authenticated with check (bucket_id = 'avatars');
drop policy if exists "utl delete avatars" on storage.objects;
create policy "utl delete avatars" on storage.objects for delete to authenticated using (bucket_id = 'avatars');

-- ─────────────── Seed: catálogo de modelos (editable con `activo`) ───────────────
insert into public.avatar_models (clave, proveedor, tipo, label, descripcion, orden) values
  ('hf-soul',       'higgsfield', 'imagen', 'Higgsfield Soul',        'Imagen realista de alta fidelidad para retratos del personaje.', 10),
  ('hf-soul-id',    'higgsfield', 'imagen', 'Higgsfield Soul (ID)',   'Imagen con consistencia de personaje a partir de fotos de referencia.', 20),
  ('hf-image',      'higgsfield', 'imagen', 'Higgsfield Imagen',      'Generación de imagen general (escenas, piezas gráficas).', 30),
  ('hf-dop',        'higgsfield', 'video',  'Higgsfield DoP',         'Video cinematográfico a partir de texto o imagen.', 40),
  ('hf-speak',      'higgsfield', 'video',  'Higgsfield Speak',       'Avatar que habla (lip-sync) a partir de retrato + audio/guion.', 50),
  ('hf-video',      'higgsfield', 'video',  'Higgsfield Video',       'Video general (motion) del personaje.', 60),
  ('hf-3d',         'higgsfield', '3d',     'Higgsfield 3D',          'Genera una malla 3D (GLB) a partir de una imagen del personaje.', 70),
  ('el-multi-v2',   'elevenlabs', 'voz',    'ElevenLabs Multilingual v2', 'Voz multilingüe de alta calidad (español).', 80),
  ('el-turbo-v25',  'elevenlabs', 'voz',    'ElevenLabs Turbo v2.5',  'Voz rápida y económica para lotes de audio.', 90)
on conflict (clave) do nothing;

-- ─────────────── Seed: avatar de ejemplo ───────────────
insert into public.avatars (nombre, slug, arquetipo, descripcion, personalidad, tono, valores, estilo_visual, voice_provider, modelo_imagen, modelo_video)
select
  'La Voz del Barrio', 'la-voz-del-barrio', 'vocero comunitario',
  'Vocero digital cercano que traduce las propuestas de la campaña al lenguaje de la calle.',
  'Persona joven, empática y directa. Conoce los problemas del territorio y habla sin tecnicismos. Optimista pero sin prometer lo imposible.',
  'cercano, firme, esperanzador',
  array['participación','territorio','transparencia','oportunidades'],
  'Retrato de medio cuerpo, luz natural cálida, fondo urbano de Bogotá, estética documental, ropa casual.',
  'elevenlabs', 'hf-soul', 'hf-speak'
where not exists (
  select 1 from public.avatars where slug = 'la-voz-del-barrio'
);
