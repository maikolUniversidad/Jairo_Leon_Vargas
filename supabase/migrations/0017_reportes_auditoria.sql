-- ============================================================================
-- UTL 360 · 0017_reportes_auditoria.sql
-- Registro de actividad explícita (subidas, descargas, accesos, vistas) para
-- reportes individuales + módulo de auditoría. Complementa a audit_logs (que ya
-- registra mutaciones de datos vía triggers). Ejecuta DESPUÉS de 0016.
-- ============================================================================

create table if not exists public.activity_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  accion     text not null,          -- login | subida | descarga | vista | exporta | ia | otro
  entidad    text,                   -- tarea | documento | contacto | cobertura | solicitud ...
  entidad_id text,
  detalle    text,
  ip         text,
  created_at timestamptz not null default now()
);
create index if not exists idx_activity_user on public.activity_log(user_id, created_at desc);
create index if not exists idx_activity_accion on public.activity_log(accion);
create index if not exists idx_activity_fecha on public.activity_log(created_at desc);

alter table public.activity_log enable row level security;
alter table public.activity_log force row level security;

-- ¿Quién puede ver reportes/auditoría?
create or replace function public.can_view_audit()
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_admin()
    or public.has_role('direccion_general'::app_role)
    or public.has_role('analitica_reportes'::app_role)
    or public.has_role('coordinador_utl'::app_role);
$$;

drop policy if exists activity_insert on public.activity_log;
create policy activity_insert on public.activity_log for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists activity_read on public.activity_log;
create policy activity_read on public.activity_log for select to authenticated
  using (user_id = auth.uid() or public.can_view_audit());

-- Lectura de audit_logs para analítica/coordinación además de admin/dirección (0003 ya cubre admin/dirección)
drop policy if exists audit_read_extra on public.audit_logs;
create policy audit_read_extra on public.audit_logs for select to authenticated
  using (public.can_view_audit());

-- Permisos de los nuevos módulos en la matriz (para que aparezcan en el panel)
insert into public.role_permissions (role_key, module, can_view, can_create, can_edit, can_delete)
select r.key, m.module, true, false, false, false
from public.roles_catalog r
cross join (values ('auditoria')) as m(module)
where r.key in ('super_admin','administrador','direccion_general','analitica_reportes','coordinador_utl')
on conflict (role_key, module) do nothing;
