-- ============================================================================
-- UTL 360 · 0019_ubicaciones_extras.sql
--   (a) Notificación de indicaciones por TRIGGER (confiable, security definer).
--   (b) Historial de recorrido (location_history) alimentado por trigger.
-- Ejecuta DESPUÉS de 0018. Idempotente.
-- ============================================================================

-- ─────────────── (a) Notificar al destinatario de una indicación ───────────────
create or replace function public.notify_directive()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, titulo, cuerpo, tipo, url, canal, created_by)
  values (
    new.user_id,
    'Nueva indicación de destino',
    case
      when new.destino_nombre is not null and new.destino_nombre <> ''
        then new.titulo || ' · ' || new.destino_nombre
      else new.titulo
    end,
    'info', '/dashboard/ubicaciones', 'in_app', new.created_by
  );
  return new;
end $$;

drop trigger if exists trg_directive_notify on public.location_directives;
create trigger trg_directive_notify
  after insert on public.location_directives
  for each row execute function public.notify_directive();

-- ─────────────── (b) Historial de recorrido ───────────────
create table if not exists public.location_history (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  accuracy    double precision,
  recorded_at timestamptz not null default now()
);
create index if not exists idx_loc_history_user on public.location_history(user_id, recorded_at desc);

alter table public.location_history enable row level security;
alter table public.location_history force row level security;

drop policy if exists loc_history_read on public.location_history;
create policy loc_history_read on public.location_history for select to authenticated
  using (user_id = auth.uid() or public.can_coordinate_location());

drop policy if exists loc_history_insert on public.location_history;
create policy loc_history_insert on public.location_history for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists loc_history_delete on public.location_history;
create policy loc_history_delete on public.location_history for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Cada posición nueva (o que cambió) se agrega al historial.
create or replace function public.append_location_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_sharing and new.lat is not null and new.lng is not null
     and (tg_op = 'INSERT' or new.lat is distinct from old.lat or new.lng is distinct from old.lng) then
    insert into public.location_history (user_id, lat, lng, accuracy)
    values (new.user_id, new.lat, new.lng, new.accuracy);
  end if;
  return new;
end $$;

drop trigger if exists trg_user_locations_history on public.user_locations;
create trigger trg_user_locations_history
  after insert or update on public.user_locations
  for each row execute function public.append_location_history();
