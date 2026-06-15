-- ============================================================================
-- UTL 360 · 0018_ubicaciones.sql
-- Módulo de Ubicaciones en tiempo real + indicaciones de destino.
--   · user_locations: posición actual de cada usuario (1 fila por usuario).
--   · location_directives: indicaciones de "a dónde debe ir" una persona.
--   · Compartir ubicación es OPT-IN (is_sharing); cada quien controla la suya.
--   · Solo roles de coordinación ven a todos; cada quien ve lo suyo.
--   · Realtime habilitado para mapa en vivo.
-- Ejecuta DESPUÉS de 0017. Idempotente.
-- ============================================================================

-- ─────────────── Posición actual por usuario ───────────────
create table if not exists public.user_locations (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  lat        double precision,
  lng        double precision,
  accuracy   double precision,   -- metros
  heading    double precision,   -- grados
  speed      double precision,   -- m/s
  is_sharing boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists idx_user_locations_sharing on public.user_locations(is_sharing);
alter table public.user_locations replica identity full;

-- ─────────────── Indicaciones de destino ───────────────
create table if not exists public.location_directives (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,   -- destinatario
  created_by     uuid references auth.users(id) on delete set null,
  titulo         text not null,
  descripcion    text,
  destino_nombre text,
  destino_lat    double precision,
  destino_lng    double precision,
  estado         text not null default 'pendiente'
                 check (estado in ('pendiente','en_camino','llego','cancelada')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_directives_user on public.location_directives(user_id, estado);
alter table public.location_directives replica identity full;

-- ─────────────── Helper: ¿puede coordinar (ver a todos)? ───────────────
create or replace function public.can_coordinate_location()
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_admin()
    or public.has_role('direccion_general'::app_role)
    or public.has_role('coordinador_utl'::app_role)
    or public.has_role('coordinador_territorial'::app_role);
$$;

-- ─────────────── RLS: user_locations ───────────────
alter table public.user_locations enable row level security;
alter table public.user_locations force row level security;

drop policy if exists user_locations_read on public.user_locations;
create policy user_locations_read on public.user_locations for select to authenticated
  using (user_id = auth.uid() or public.can_coordinate_location());

drop policy if exists user_locations_insert on public.user_locations;
create policy user_locations_insert on public.user_locations for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists user_locations_update on public.user_locations;
create policy user_locations_update on public.user_locations for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists user_locations_delete on public.user_locations;
create policy user_locations_delete on public.user_locations for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ─────────────── RLS: location_directives ───────────────
alter table public.location_directives enable row level security;
alter table public.location_directives force row level security;

drop policy if exists directives_read on public.location_directives;
create policy directives_read on public.location_directives for select to authenticated
  using (user_id = auth.uid() or created_by = auth.uid() or public.can_coordinate_location());

drop policy if exists directives_insert on public.location_directives;
create policy directives_insert on public.location_directives for insert to authenticated
  with check (public.can_coordinate_location() and created_by = auth.uid());

drop policy if exists directives_update on public.location_directives;
create policy directives_update on public.location_directives for update to authenticated
  using (user_id = auth.uid() or public.can_coordinate_location())
  with check (user_id = auth.uid() or public.can_coordinate_location());

drop policy if exists directives_delete on public.location_directives;
create policy directives_delete on public.location_directives for delete to authenticated
  using (created_by = auth.uid() or public.can_coordinate_location());

-- ─────────────── Triggers updated_at ───────────────
drop trigger if exists trg_user_locations_updated on public.user_locations;
create trigger trg_user_locations_updated before update on public.user_locations
  for each row execute function public.set_updated_at();

drop trigger if exists trg_directives_updated on public.location_directives;
create trigger trg_directives_updated before update on public.location_directives
  for each row execute function public.set_updated_at();

-- ─────────────── Realtime (mapa en vivo) ───────────────
do $$
begin
  begin
    alter publication supabase_realtime add table public.user_locations;
  exception when others then null; end;
  begin
    alter publication supabase_realtime add table public.location_directives;
  exception when others then null; end;
end $$;
