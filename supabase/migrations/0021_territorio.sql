-- ============================================================================
-- UTL 360 · 0021_territorio.sql
-- Soporte del mapa de territorio enlazado al Kanban:
--   · zones.codigo_geo: código del polígono (GeoJSON) para emparejar el mapa.
--   · ensure_zone(): busca o crea una zona por nombre+tipo (security definer),
--     para que cualquier staff pueda asociar tareas a un área desde el mapa.
-- Ejecuta DESPUÉS de 0020. Idempotente.
-- ============================================================================

alter table public.zones
  add column if not exists codigo_geo text;

-- Busca o crea una zona y devuelve su id. SECURITY DEFINER: permite que
-- cualquier miembro del staff vincule tareas a un área aunque la creación de
-- zonas esté restringida a coordinación.
create or replace function public.ensure_zone(
  p_nombre text,
  p_tipo   zone_type default 'localidad',
  p_codigo text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  zid uuid;
begin
  if not public.is_staff() then
    raise exception 'No autorizado';
  end if;

  select id into zid
  from public.zones
  where lower(nombre_zona) = lower(p_nombre)
    and tipo_zona = p_tipo
    and deleted_at is null
  limit 1;

  if zid is null then
    insert into public.zones (nombre_zona, tipo_zona, codigo_geo, created_by)
    values (p_nombre, p_tipo, p_codigo, auth.uid())
    returning id into zid;
  elsif p_codigo is not null then
    update public.zones set codigo_geo = coalesce(codigo_geo, p_codigo) where id = zid;
  end if;

  return zid;
end $$;

revoke all on function public.ensure_zone(text, zone_type, text) from public, anon;
grant execute on function public.ensure_zone(text, zone_type, text) to authenticated;
