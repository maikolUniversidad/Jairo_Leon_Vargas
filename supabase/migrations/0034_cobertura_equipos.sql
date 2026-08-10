-- ============================================================================
-- UTL 360 · 0034_cobertura_equipos.sql
-- Catálogo de equipos de grabación/fotos y atribución del material de una
-- cobertura: qué equipo lo produjo, con qué dispositivo y de qué tipo es.
-- Ejecuta DESPUÉS de 0033. Idempotente.
-- ============================================================================

-- ─────────────── Catálogo de equipos ───────────────
create table if not exists public.equipos_cobertura (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  tipo       text not null default 'mixto' check (tipo in ('grabacion','fotos','mixto')),
  activo     boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipos_cobertura_nombre_no_vacio check (length(btrim(nombre)) > 0)
);

-- Impide que "Equipo A", "equipo a" y "EquipoA" convivan como tres equipos.
create unique index if not exists idx_equipos_cobertura_nombre
  on public.equipos_cobertura (lower(btrim(nombre)));

alter table public.equipos_cobertura enable row level security;
alter table public.equipos_cobertura force row level security;

drop policy if exists equipos_cobertura_read on public.equipos_cobertura;
create policy equipos_cobertura_read on public.equipos_cobertura
  for select to authenticated using (public.is_staff());

drop policy if exists equipos_cobertura_write on public.equipos_cobertura;
create policy equipos_cobertura_write on public.equipos_cobertura
  for all to authenticated
  using (public.can_manage_comunicaciones())
  with check (public.can_manage_comunicaciones());

drop trigger if exists trg_equipos_cobertura_updated on public.equipos_cobertura;
create trigger trg_equipos_cobertura_updated before update on public.equipos_cobertura
  for each row execute function public.set_updated_at();

-- ─────────────── Atribución del material ───────────────
-- `on delete set null` en equipo_id: borrar un equipo del catálogo no puede
-- llevarse por delante el material que grabó.
alter table public.cobertura_files
  add column if not exists equipo_id      uuid references public.equipos_cobertura(id) on delete set null,
  add column if not exists dispositivo    text,
  add column if not exists tipo_contenido text not null default 'otro';

-- El check va aparte para que la migración se pueda reejecutar sin chocar.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cobertura_files_tipo_contenido_check'
  ) then
    alter table public.cobertura_files
      add constraint cobertura_files_tipo_contenido_check
      check (tipo_contenido in ('foto','video','audio','documento','otro'));
  end if;
end $$;

create index if not exists idx_cobertura_files_equipo
  on public.cobertura_files (cobertura_id, equipo_id);
create index if not exists idx_cobertura_files_tipo
  on public.cobertura_files (cobertura_id, tipo_contenido);

-- ─────────────── Reclasificar lo que ya existe ───────────────
-- Las filas anteriores entraron con el default 'otro'; se derivan del mime.
-- El orden de los CASE importa: 'application/pdf' antes que el comodín de word.
update public.cobertura_files set tipo_contenido = case
  when mime like 'image/%'      then 'foto'
  when mime like 'video/%'      then 'video'
  when mime like 'audio/%'      then 'audio'
  when mime = 'application/pdf' then 'documento'
  when mime like 'text/%'       then 'documento'
  when mime like '%word%' or mime like '%sheet%' or mime like '%presentation%' then 'documento'
  else 'otro'
end
where tipo_contenido = 'otro';
