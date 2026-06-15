-- ============================================================================
-- UTL 360 · 0007_workspaces_permisos.sql
-- 1) Workspaces de tareas con permisos por persona + asignación a usuarios.
-- 2) Roles dinámicos (roles_catalog) + permisos por módulo (role_permissions).
-- Ejecuta DESPUÉS de 0006. Idempotente.
-- ============================================================================

-- ─────────────────────────── WORKSPACES ───────────────────────────
create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  descripcion text,
  color       text not null default '#E30613',
  archivado   boolean not null default false,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  rol_workspace text not null default 'viewer' check (rol_workspace in ('owner','editor','viewer')),
  created_at    timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index if not exists idx_ws_members_ws on public.workspace_members(workspace_id);
create index if not exists idx_ws_members_user on public.workspace_members(user_id);

-- Vincular tareas a un workspace
alter table public.tasks add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
create index if not exists idx_tasks_workspace on public.tasks(workspace_id);

drop trigger if exists trg_workspaces_updated on public.workspaces;
create trigger trg_workspaces_updated before update on public.workspaces
  for each row execute function public.set_updated_at();

-- Helpers de pertenencia
create or replace function public.is_workspace_member(p_ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.workspace_members
    where workspace_id = p_ws and user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_editor(p_ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.workspace_members
    where workspace_id = p_ws and user_id = auth.uid()
      and rol_workspace in ('owner','editor')
  );
$$;

create or replace function public.is_workspace_owner(p_ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.workspace_members
    where workspace_id = p_ws and user_id = auth.uid() and rol_workspace = 'owner'
  );
$$;

-- ─────────────── RLS workspaces ───────────────
alter table public.workspaces enable row level security;
alter table public.workspaces force row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_members force row level security;

drop policy if exists ws_select on public.workspaces;
create policy ws_select on public.workspaces for select to authenticated
  using (public.is_workspace_member(id) or created_by = auth.uid());

drop policy if exists ws_insert on public.workspaces;
create policy ws_insert on public.workspaces for insert to authenticated
  with check (public.is_staff() and created_by = auth.uid());

drop policy if exists ws_update on public.workspaces;
create policy ws_update on public.workspaces for update to authenticated
  using (public.is_workspace_owner(id)) with check (public.is_workspace_owner(id));

drop policy if exists ws_delete on public.workspaces;
create policy ws_delete on public.workspaces for delete to authenticated
  using (public.is_workspace_owner(id));

drop policy if exists ws_members_select on public.workspace_members;
create policy ws_members_select on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id) or user_id = auth.uid());

drop policy if exists ws_members_manage on public.workspace_members;
create policy ws_members_manage on public.workspace_members for all to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

-- ─────────────── tasks: RLS sensible a workspace ───────────────
drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks for select to authenticated
  using (
    public.is_admin()
    or (workspace_id is null and public.is_staff())
    or responsable_id = auth.uid()
    or creador_id = auth.uid()
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated
  with check (
    public.is_staff()
    and (workspace_id is null or public.is_workspace_editor(workspace_id))
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
  using (
    public.is_admin()
    or public.has_role('coordinador_utl'::app_role)
    or responsable_id = auth.uid()
    or creador_id = auth.uid()
    or (workspace_id is not null and public.is_workspace_editor(workspace_id))
  ) with check (true);

-- ═══════════════════════ ROLES Y PERMISOS DINÁMICOS ═══════════════════════
-- Catálogo de roles: sistema (12) + personalizados que cree el admin.
-- base_role (enum) define el nivel de SEGURIDAD de datos (RLS); role_key es
-- el rol "visible" que controla qué módulos ve cada quien en el panel.
create table if not exists public.roles_catalog (
  key         text primary key,
  label       text not null,
  descripcion text,
  is_system   boolean not null default false,
  base_role   app_role not null default 'consulta',
  created_at  timestamptz not null default now()
);

create table if not exists public.role_permissions (
  id         uuid primary key default gen_random_uuid(),
  role_key   text not null references public.roles_catalog(key) on delete cascade,
  module     text not null,
  can_view   boolean not null default false,
  can_create boolean not null default false,
  can_edit   boolean not null default false,
  can_delete boolean not null default false,
  unique (role_key, module)
);
create index if not exists idx_role_perms_key on public.role_permissions(role_key);

-- Rol "visible" asignado al usuario (sistema o personalizado)
alter table public.user_roles add column if not exists role_key text;

-- ─────────────── Helper de permiso por módulo (para nav/acceso) ───────────────
create or replace function public.can_view_module(p_module text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.user_roles ur
    join public.role_permissions rp on rp.role_key = ur.role_key
    where ur.user_id = auth.uid() and rp.module = p_module and rp.can_view
  );
$$;

-- ─────────────── RLS roles/permisos ───────────────
alter table public.roles_catalog enable row level security;
alter table public.roles_catalog force row level security;
alter table public.role_permissions enable row level security;
alter table public.role_permissions force row level security;

drop policy if exists roles_catalog_read on public.roles_catalog;
create policy roles_catalog_read on public.roles_catalog for select to authenticated using (true);
drop policy if exists roles_catalog_admin on public.roles_catalog;
create policy roles_catalog_admin on public.roles_catalog for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists role_perms_read on public.role_permissions;
create policy role_perms_read on public.role_permissions for select to authenticated using (true);
drop policy if exists role_perms_admin on public.role_permissions;
create policy role_perms_admin on public.role_permissions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─────────────── Seed: roles del sistema ───────────────
insert into public.roles_catalog (key, label, is_system, base_role, descripcion) values
  ('super_admin','Super Administrador',true,'super_admin','Acceso total al sistema'),
  ('administrador','Administrador',true,'administrador','Gestión total excepto config crítica'),
  ('direccion_general','Dirección General',true,'direccion_general','Lectura total y aprobación'),
  ('coordinador_utl','Coordinador UTL',true,'coordinador_utl','Coordinación de áreas y agenda'),
  ('juridico_legislativo','Jurídico / Legislativo',true,'juridico_legislativo','Documentos y solicitudes formales'),
  ('comunicaciones','Comunicaciones',true,'comunicaciones','Contenidos y calendario editorial'),
  ('coordinador_territorial','Coordinador Territorial',true,'coordinador_territorial','Zonas, eventos y líderes'),
  ('gestor_territorial','Gestor Territorial',true,'gestor_territorial','Gestión por zona asignada'),
  ('atencion_ciudadana','Atención Ciudadana',true,'atencion_ciudadana','CRM y solicitudes'),
  ('analitica_reportes','Analítica / Reportes',true,'analitica_reportes','Lectura y reportes'),
  ('voluntario','Voluntario',true,'voluntario','Tareas asignadas y eventos'),
  ('consulta','Consulta',true,'consulta','Solo lectura')
on conflict (key) do update set label = excluded.label, base_role = excluded.base_role;

-- Backfill role_key en user_roles existentes
update public.user_roles set role_key = role::text where role_key is null;

-- ─────────────── Seed: permisos (can_view) por módulo ───────────────
-- Módulos visibles para todos los roles del sistema
insert into public.role_permissions (role_key, module, can_view)
select key, m, true from public.roles_catalog, unnest(array['panel','tareas','calendario']) m
where is_system on conflict (role_key, module) do nothing;

-- Módulos restringidos: (módulo, roles permitidos)
insert into public.role_permissions (role_key, module, can_view)
select r.key, x.module, true
from (values
  ('ciudadanos', array['super_admin','administrador','direccion_general','coordinador_utl','atencion_ciudadana','coordinador_territorial','gestor_territorial','analitica_reportes']),
  ('solicitudes', array['super_admin','administrador','direccion_general','coordinador_utl','juridico_legislativo','atencion_ciudadana','coordinador_territorial','gestor_territorial','analitica_reportes']),
  ('territorio', array['super_admin','administrador','direccion_general','coordinador_utl','coordinador_territorial','gestor_territorial','analitica_reportes']),
  ('comunicaciones', array['super_admin','administrador','direccion_general','coordinador_utl','comunicaciones']),
  ('documentos', array['super_admin','administrador','direccion_general','coordinador_utl','juridico_legislativo','comunicaciones']),
  ('reportes', array['super_admin','administrador','direccion_general','coordinador_utl','analitica_reportes']),
  ('ia', array['super_admin','administrador','direccion_general','coordinador_utl','comunicaciones','juridico_legislativo']),
  ('notificaciones', array['super_admin','administrador','direccion_general','coordinador_utl','comunicaciones']),
  ('configuracion', array['super_admin','administrador'])
) as x(module, roles)
join public.roles_catalog r on r.key = any(x.roles)
on conflict (role_key, module) do nothing;

-- can_create / can_edit para roles operativos (no solo-lectura)
update public.role_permissions set can_create = true, can_edit = true
where can_view = true
  and role_key not in ('consulta','analitica_reportes','voluntario','direccion_general');

-- can_delete solo para administradores
update public.role_permissions set can_delete = true
where role_key in ('super_admin','administrador');
