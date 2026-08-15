-- ============================================================================
-- UTL 360 · 0042_territorio_noticias.sql
-- Caché de lo que dice la prensa sobre cada zona del país.
--
-- Colombia tiene 1.122 municipios: recolectarlos todos de antemano sería
-- absurdo (nadie mira la mayoría) y consultarlos en cada clic, lento y caro.
-- Se consulta al seleccionar la zona y se guarda unas horas.
-- Ejecuta DESPUÉS de 0041. Idempotente.
-- ============================================================================

create table if not exists public.territorio_noticias (
  id             uuid primary key default gen_random_uuid(),
  -- `nivel:codigo` (divipola). El código, no el nombre: hay ocho «San Antonio».
  zona_key       text not null unique,
  nivel          text not null check (nivel in ('nacion','departamento','municipio')),
  codigo         text not null,
  nombre         text not null,
  departamento   text,
  /** Titulares tal como llegaron de la fuente. */
  items          jsonb not null default '[]'::jsonb,
  total          int not null default 0,
  consulta       text,
  recolectado_en timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create index if not exists idx_territorio_noticias_nivel
  on public.territorio_noticias (nivel, recolectado_en desc);

alter table public.territorio_noticias enable row level security;
alter table public.territorio_noticias force  row level security;

-- Lectura para cualquier staff: el mapa lo usa todo el equipo territorial.
drop policy if exists territorio_noticias_read on public.territorio_noticias;
create policy territorio_noticias_read on public.territorio_noticias
  for select to authenticated using (public.is_staff());

-- La escritura la hace la recolección desde el servidor, no la gente.
drop policy if exists territorio_noticias_write on public.territorio_noticias;
create policy territorio_noticias_write on public.territorio_noticias
  for all to authenticated
  using (public.can_coordinate_location())
  with check (public.can_coordinate_location());
