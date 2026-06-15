-- ============================================================================
-- UTL 360 · 0010_contactos.sql
-- Módulo de contactos: red de contactos, vínculo con territorios, tareas y
-- ciudadanos referidos; fotos y documentos. Ejecuta DESPUÉS de 0009.
-- ============================================================================

create table if not exists public.contacts (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,
  apellido           text,
  foto_url           text,
  puesto             text,                 -- cargo / puesto
  organizacion       text,
  tipo               text not null default 'aliado',  -- lider|funcionario|aliado|medio|comunidad|institucion|otro
  telefono           text,
  whatsapp           text,
  email              text,
  direccion          text,
  localidad          text,
  barrio             text,
  zona_id            uuid references public.zones(id) on delete set null,
  influencia         text,                 -- alta|media|baja
  notas              text,
  etiquetas          text[] default '{}',
  estado             text not null default 'activo',
  contexto_operativo contexto_operativo not null default 'comunitario',
  created_by         uuid references auth.users(id) on delete set null,
  updated_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);
create index if not exists idx_contacts_zona on public.contacts(zona_id);
create index if not exists idx_contacts_tipo on public.contacts(tipo);
create index if not exists idx_contacts_nombre_trgm on public.contacts using gin (nombre gin_trgm_ops);

-- Red de contactos (grafo)
create table if not exists public.contact_relations (
  id                 uuid primary key default gen_random_uuid(),
  contact_id         uuid not null references public.contacts(id) on delete cascade,
  related_contact_id uuid not null references public.contacts(id) on delete cascade,
  tipo_relacion      text not null default 'aliado',
  nota               text,
  created_at         timestamptz not null default now(),
  check (contact_id <> related_contact_id),
  unique (contact_id, related_contact_id)
);
create index if not exists idx_contact_rel_a on public.contact_relations(contact_id);
create index if not exists idx_contact_rel_b on public.contact_relations(related_contact_id);

-- Documentos / archivos de un contacto (acumulativo)
create table if not exists public.contact_documents (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid not null references public.contacts(id) on delete cascade,
  tipo         text not null default 'archivo' check (tipo in ('archivo','link')),
  nombre       text not null,
  url          text not null,
  storage_path text,
  mime         text,
  size         bigint,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_contact_docs on public.contact_documents(contact_id, created_at desc);

-- Vínculos: tareas para un contacto + ciudadanos referidos por un contacto
alter table public.tasks add column if not exists contact_id uuid references public.contacts(id) on delete set null;
create index if not exists idx_tasks_contact on public.tasks(contact_id);

alter table public.citizens add column if not exists referido_por_contact_id uuid references public.contacts(id) on delete set null;
create index if not exists idx_citizens_referido on public.citizens(referido_por_contact_id);

-- updated_at + auditoría
drop trigger if exists trg_contacts_updated on public.contacts;
create trigger trg_contacts_updated before update on public.contacts
  for each row execute function public.set_updated_at();
drop trigger if exists trg_contacts_audit on public.contacts;
create trigger trg_contacts_audit after insert or update or delete on public.contacts
  for each row execute function public.log_audit_event();

-- ─────────────── Permisos / RLS ───────────────
create or replace function public.can_manage_contacts()
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_admin()
    or public.has_role('direccion_general'::app_role)
    or public.has_role('coordinador_utl'::app_role)
    or public.has_role('coordinador_territorial'::app_role)
    or public.has_role('gestor_territorial'::app_role)
    or public.has_role('atencion_ciudadana'::app_role);
$$;

do $$
declare t text;
begin
  foreach t in array array['contacts','contact_relations','contact_documents'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
  end loop;
end $$;

drop policy if exists contacts_read on public.contacts;
create policy contacts_read on public.contacts for select to authenticated using (public.is_staff());
drop policy if exists contacts_write on public.contacts;
create policy contacts_write on public.contacts for all to authenticated
  using (public.can_manage_contacts()) with check (public.can_manage_contacts());

drop policy if exists contact_rel_read on public.contact_relations;
create policy contact_rel_read on public.contact_relations for select to authenticated using (public.is_staff());
drop policy if exists contact_rel_write on public.contact_relations;
create policy contact_rel_write on public.contact_relations for all to authenticated
  using (public.can_manage_contacts()) with check (public.can_manage_contacts());

drop policy if exists contact_docs_read on public.contact_documents;
create policy contact_docs_read on public.contact_documents for select to authenticated using (public.is_staff());
drop policy if exists contact_docs_write on public.contact_documents;
create policy contact_docs_write on public.contact_documents for all to authenticated
  using (public.can_manage_contacts()) with check (public.can_manage_contacts());

-- ─────────────── Storage: archivos/fotos de contactos ───────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('contact-files','contact-files', true, 26214400)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

drop policy if exists "utl read contact-files" on storage.objects;
create policy "utl read contact-files" on storage.objects for select to public using (bucket_id = 'contact-files');
drop policy if exists "utl write contact-files" on storage.objects;
create policy "utl write contact-files" on storage.objects for insert to authenticated with check (bucket_id = 'contact-files');
drop policy if exists "utl delete contact-files" on storage.objects;
create policy "utl delete contact-files" on storage.objects for delete to authenticated using (bucket_id = 'contact-files');

-- ─────────────── Permisos de módulo 'contactos' ───────────────
insert into public.role_permissions (role_key, module, can_view, can_create, can_edit, can_delete)
select r.key, 'contactos', true,
  r.key in ('super_admin','administrador','coordinador_utl','coordinador_territorial','gestor_territorial','atencion_ciudadana'),
  r.key in ('super_admin','administrador','coordinador_utl','coordinador_territorial','gestor_territorial','atencion_ciudadana'),
  r.key in ('super_admin','administrador')
from public.roles_catalog r
where r.key in ('super_admin','administrador','direccion_general','coordinador_utl','coordinador_territorial','gestor_territorial','atencion_ciudadana','analitica_reportes')
on conflict (role_key, module) do nothing;

-- ─────────────── Seed demo ───────────────
insert into public.contacts (nombre, apellido, puesto, organizacion, tipo, telefono, localidad, zona_id, influencia, estado)
select x.nombre, x.apellido, x.puesto, x.org, x.tipo, x.tel, x.loc,
  (select id from public.zones z where z.nombre_zona = x.zona limit 1), x.inf, 'activo'
from (values
  ('Marta','Lozano','Presidenta JAC','JAC Patio Bonito','lider','3101112233','Kennedy','Kennedy','alta'),
  ('Hernán','Ruiz','Edil','JAL Ciudad Bolívar','funcionario','3102223344','Ciudad Bolívar','Ciudad Bolívar','media'),
  ('Colectivo Río Fucha','','Vocería ambiental','Mesa Ambiental','comunidad','3103334455','San Cristóbal','San Cristóbal','media'),
  ('Radio Comunitaria Suba','','Director','Emisora local','medio','3104445566','Suba','Suba','alta')
) as x(nombre, apellido, puesto, org, tipo, tel, loc, zona, inf)
on conflict do nothing;
