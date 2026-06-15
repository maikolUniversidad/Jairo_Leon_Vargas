-- ============================================================================
-- UTL 360 · 0013_documents_module.sql
-- Módulo de Documentos: carpetas jerárquicas + archivos con visibilidad por rol.
--   · document_folders: carpetas en árbol, cada una con allowed_roles (qué roles la ven).
--   · documents: se extiende con folder_id + metadatos de archivo en Storage privado.
--   · Acceso por rol: admin/dirección ven todo; el resto ve según los roles de la carpeta.
--   · Bucket privado 'documentos' (descarga por URL firmada generada en el servidor).
-- Ejecuta DESPUÉS de 0012. Idempotente.
-- ============================================================================

-- ─────────────── Carpetas ───────────────
create table if not exists public.document_folders (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  descripcion   text,
  parent_id     uuid references public.document_folders(id) on delete cascade,
  -- Roles que pueden VER la carpeta y sus documentos. Vacío/NULL = visible a todo el staff.
  allowed_roles app_role[] not null default '{}',
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index if not exists idx_doc_folders_parent on public.document_folders(parent_id);

-- ─────────────── Extender documents ───────────────
alter table public.documents
  add column if not exists folder_id     uuid references public.document_folders(id) on delete set null,
  add column if not exists descripcion   text,
  add column if not exists storage_path  text,            -- ruta dentro del bucket privado
  add column if not exists original_name text,
  add column if not exists mime          text,
  add column if not exists size          bigint;
create index if not exists idx_documents_folder on public.documents(folder_id);

-- ─────────────── Helpers de permisos ───────────────
-- ¿Puede el usuario crear/editar carpetas y documentos (gestor documental)?
create or replace function public.can_manage_documents()
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_admin()
    or public.has_role('direccion_general'::app_role)
    or public.has_role('coordinador_utl'::app_role)
    or public.has_role('juridico_legislativo'::app_role)
    or public.has_role('comunicaciones'::app_role);
$$;

-- ¿Puede el usuario VER esta carpeta? (admin/dirección todo; resto por allowed_roles)
create or replace function public.can_access_folder(p_folder uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_admin()
    or public.has_role('direccion_general'::app_role)
    or p_folder is null   -- documentos sin carpeta = visibles a todo el staff
    or exists (
      select 1 from public.document_folders f
      where f.id = p_folder and f.deleted_at is null and (
        cardinality(f.allowed_roles) = 0
        or f.created_by = auth.uid()
        or exists (
          select 1 from public.user_roles ur
          where ur.user_id = auth.uid() and ur.role = any (f.allowed_roles)
        )
      )
    );
$$;

-- ─────────────── RLS: document_folders ───────────────
alter table public.document_folders enable row level security;
alter table public.document_folders force row level security;

drop policy if exists doc_folders_read on public.document_folders;
create policy doc_folders_read on public.document_folders for select to authenticated
  using (public.is_staff() and deleted_at is null and public.can_access_folder(id));

-- IMPORTANTE: la escritura se define POR COMANDO (no FOR ALL), porque una
-- política FOR ALL también rige el SELECT (se combina con OR) y dejaría ver
-- TODAS las carpetas a los gestores. Así la visibilidad la rige solo *_read.
drop policy if exists doc_folders_write on public.document_folders;
drop policy if exists doc_folders_insert on public.document_folders;
create policy doc_folders_insert on public.document_folders for insert to authenticated
  with check (public.can_manage_documents());
drop policy if exists doc_folders_update on public.document_folders;
create policy doc_folders_update on public.document_folders for update to authenticated
  using (public.can_manage_documents()) with check (public.can_manage_documents());
drop policy if exists doc_folders_delete on public.document_folders;
create policy doc_folders_delete on public.document_folders for delete to authenticated
  using (public.can_manage_documents());

-- ─────────────── RLS: documents (reescrita con acceso por carpeta) ───────────────
drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents for select to authenticated
  using (
    public.is_staff()
    and deleted_at is null
    and (
      public.is_admin()
      or public.has_role('direccion_general'::app_role)
      or creado_por = auth.uid()
      or (
        public.can_access_folder(folder_id)
        and (
          confidencialidad <> 'reservado'
          or public.has_role('juridico_legislativo'::app_role)
        )
      )
    )
  );

-- Escritura por comando (ver nota arriba): el SELECT lo rige solo documents_read.
drop policy if exists documents_write on public.documents;
drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents for insert to authenticated
  with check (public.is_staff() and (public.can_manage_documents() or creado_por = auth.uid()));
drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents for update to authenticated
  using (public.can_manage_documents() or creado_por = auth.uid())
  with check (public.is_staff() and (public.can_manage_documents() or creado_por = auth.uid()));
drop policy if exists documents_delete on public.documents;
create policy documents_delete on public.documents for delete to authenticated
  using (public.can_manage_documents() or creado_por = auth.uid());

-- ─────────────── Triggers: updated_at + auditoría ───────────────
drop trigger if exists trg_document_folders_updated on public.document_folders;
create trigger trg_document_folders_updated
  before update on public.document_folders
  for each row execute function public.set_updated_at();

drop trigger if exists trg_document_folders_audit on public.document_folders;
create trigger trg_document_folders_audit
  after insert or update or delete on public.document_folders
  for each row execute function public.log_audit_event();

-- ─────────────── Bucket privado de Storage ───────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos','documentos', false, 52428800)   -- 50 MB, PRIVADO
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

-- Subida/borrado por staff autenticado. La LECTURA es solo por URL firmada
-- (se genera en el servidor tras validar RLS), por eso no hay policy de select público.
drop policy if exists "utl write documentos" on storage.objects;
create policy "utl write documentos" on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and public.is_staff());

drop policy if exists "utl delete documentos" on storage.objects;
create policy "utl delete documentos" on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and public.can_manage_documents());
