-- ============================================================================
-- UTL 360 · 0024_asistente_ia.sql
-- Asistente IA conversacional (chat con historial):
--   · ia_carpetas       : carpetas para organizar conversaciones (por usuario).
--   · ia_conversaciones : hilos de chat (título, modelo, fijada, carpeta).
--   · ia_mensajes       : mensajes de cada conversación (role, content, metadata).
-- Datos PERSONALES por usuario: RLS restringe cada fila a su dueño (auth.uid()).
-- Ejecuta DESPUÉS de 0023. Idempotente.
-- ============================================================================

-- ─────────────── Carpetas ───────────────
create table if not exists public.ia_carpetas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  nombre     text not null,
  color      text not null default 'green',
  orden      int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_ia_carpetas_user on public.ia_carpetas(user_id, orden);

-- ─────────────── Conversaciones ───────────────
create table if not exists public.ia_conversaciones (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  carpeta_id uuid references public.ia_carpetas(id) on delete set null,
  titulo     text not null default 'Nueva conversación',
  modelo     text not null default 'deepseek-chat',
  fijada     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_ia_conversaciones_user on public.ia_conversaciones(user_id, updated_at desc);
create index if not exists idx_ia_conversaciones_carpeta on public.ia_conversaciones(carpeta_id);

-- ─────────────── Mensajes ───────────────
create table if not exists public.ia_mensajes (
  id              uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.ia_conversaciones(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null default 'user',      -- user | assistant
  content         text not null default '',
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists idx_ia_mensajes_conv on public.ia_mensajes(conversacion_id, created_at);

-- ─────────────── RLS: cada quien ve/gestiona SOLO lo suyo ───────────────
alter table public.ia_carpetas       enable row level security;
alter table public.ia_carpetas       force row level security;
alter table public.ia_conversaciones enable row level security;
alter table public.ia_conversaciones force row level security;
alter table public.ia_mensajes       enable row level security;
alter table public.ia_mensajes       force row level security;

drop policy if exists ia_carpetas_own on public.ia_carpetas;
create policy ia_carpetas_own on public.ia_carpetas for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists ia_conversaciones_own on public.ia_conversaciones;
create policy ia_conversaciones_own on public.ia_conversaciones for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists ia_mensajes_own on public.ia_mensajes;
create policy ia_mensajes_own on public.ia_mensajes for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────── Trigger updated_at ───────────────
drop trigger if exists trg_ia_conversaciones_updated on public.ia_conversaciones;
create trigger trg_ia_conversaciones_updated before update on public.ia_conversaciones
  for each row execute function public.set_updated_at();
