-- ============================================================================
-- UTL 360 · 0031_cobertura_files_meta.sql
-- Galería multimedia de coberturas: ficha editable, orden manual dentro de cada
-- fase, derivación entre fases y control de versiones. Ejecuta DESPUÉS de 0030.
-- Todas las columnas traen default, así que las filas existentes siguen válidas.
-- ============================================================================

alter table public.cobertura_files
  add column if not exists descripcion    text,
  add column if not exists tags           text[] not null default '{}',
  add column if not exists destacado      boolean not null default false,
  add column if not exists orden          int not null default 0,
  add column if not exists origen_file_id uuid references public.cobertura_files(id) on delete set null,
  add column if not exists version        int not null default 1,
  add column if not exists updated_at     timestamptz not null default now();

-- El tablero lee por (cobertura, fase) y ordena por `orden` y luego por antigüedad.
create index if not exists idx_cobertura_files_orden
  on public.cobertura_files(cobertura_id, fase, orden, created_at desc);

drop trigger if exists trg_cobertura_files_updated on public.cobertura_files;
create trigger trg_cobertura_files_updated before update on public.cobertura_files
  for each row execute function public.set_updated_at();

-- Reordenar una columna del tablero en una sola sentencia. `security invoker`
-- para que sigan aplicando las políticas RLS de cobertura_files: sin permiso de
-- escritura en el módulo, el update no toca ninguna fila.
create or replace function public.reordenar_cobertura_files(p_ids uuid[])
returns void language sql security invoker set search_path = public as $$
  update public.cobertura_files f
  set orden = pos
  from unnest(p_ids) with ordinality as entrada(id, pos)
  where f.id = entrada.id;
$$;

grant execute on function public.reordenar_cobertura_files(uuid[]) to authenticated;

-- Las filas anteriores a esta migración comparten orden 0; les damos una posición
-- estable según su antigüedad para que el arrastre parta de un estado coherente.
with numerada as (
  select id, row_number() over (partition by cobertura_id, fase order by created_at) as pos
  from public.cobertura_files
)
update public.cobertura_files f
set orden = numerada.pos
from numerada
where numerada.id = f.id and f.orden = 0;
