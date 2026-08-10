-- ============================================================================
-- UTL 360 · 0037_equipo_integrantes.sql
-- Integrantes de cada equipo de cobertura y responsable del material subido.
--
-- Dos cosas distintas que conviene no confundir:
--   · `created_by`     — quién apretó el botón. Es auditoría, no se toca.
--   · `responsable_id` — a quién se le acredita el material. Arranca igual que
--                        `created_by` pero se puede cambiar, porque es normal
--                        que alguien suba lo que grabó otra persona.
-- Ejecuta DESPUÉS de 0036. Idempotente.
-- ============================================================================

create table if not exists public.equipo_integrantes (
  id         uuid primary key default gen_random_uuid(),
  equipo_id  uuid not null references public.equipos_cobertura(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  rol        text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Una persona no puede estar dos veces en el mismo equipo.
create unique index if not exists idx_equipo_integrantes_unico
  on public.equipo_integrantes (equipo_id, user_id);

-- Al subir se busca «¿a qué equipo pertenece quien entró?» para preseleccionarlo.
create index if not exists idx_equipo_integrantes_usuario
  on public.equipo_integrantes (user_id);

alter table public.equipo_integrantes enable row level security;
alter table public.equipo_integrantes force row level security;

drop policy if exists equipo_integrantes_read on public.equipo_integrantes;
create policy equipo_integrantes_read on public.equipo_integrantes
  for select to authenticated using (public.is_staff());

drop policy if exists equipo_integrantes_write on public.equipo_integrantes;
create policy equipo_integrantes_write on public.equipo_integrantes
  for all to authenticated
  using (public.can_manage_comunicaciones())
  with check (public.can_manage_comunicaciones());

-- ─────────────── Responsable del material ───────────────
alter table public.cobertura_files
  add column if not exists responsable_id uuid references auth.users(id) on delete set null;

create index if not exists idx_cobertura_files_responsable
  on public.cobertura_files (cobertura_id, responsable_id);

-- El material que ya existe se acredita a quien lo subió.
update public.cobertura_files
set responsable_id = created_by
where responsable_id is null and created_by is not null;
