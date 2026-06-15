-- ============================================================================
-- UTL 360 · 0014_coberturas.sql
-- Sub-módulo de Comunicaciones: coberturas (eventos cubiertos), con carpeta en
-- Drive y fases Crudo/Editado/Aprobado. Ejecuta DESPUÉS de 0013.
-- ============================================================================

create table if not exists public.coberturas (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,
  descripcion        text,
  fecha              date,
  lugar              text,
  estado             text not null default 'planeada', -- planeada|en_curso|en_edicion|en_aprobacion|publicada|archivada
  responsable_id     uuid references auth.users(id) on delete set null,
  -- Carpetas en Google Drive (si está conectado)
  drive_folder_id    text,
  drive_crudo_id     text,
  drive_editado_id   text,
  drive_aprobado_id  text,
  drive_link         text,
  contexto_operativo contexto_operativo not null default 'comunicacional',
  created_by         uuid references auth.users(id) on delete set null,
  updated_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);
create index if not exists idx_coberturas_estado on public.coberturas(estado);
create index if not exists idx_coberturas_fecha on public.coberturas(fecha desc);

create table if not exists public.cobertura_files (
  id           uuid primary key default gen_random_uuid(),
  cobertura_id uuid not null references public.coberturas(id) on delete cascade,
  fase         text not null default 'crudo' check (fase in ('crudo','editado','aprobado')),
  nombre       text not null,
  url          text not null,
  drive_file_id text,
  storage_path text,
  mime         text,
  size         bigint,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_cobertura_files on public.cobertura_files(cobertura_id, fase, created_at desc);

drop trigger if exists trg_coberturas_updated on public.coberturas;
create trigger trg_coberturas_updated before update on public.coberturas
  for each row execute function public.set_updated_at();
drop trigger if exists trg_coberturas_audit on public.coberturas;
create trigger trg_coberturas_audit after insert or update or delete on public.coberturas
  for each row execute function public.log_audit_event();

-- ─────────────── Permisos / RLS ───────────────
create or replace function public.can_manage_comunicaciones()
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_admin()
    or public.has_role('direccion_general'::app_role)
    or public.has_role('coordinador_utl'::app_role)
    or public.has_role('comunicaciones'::app_role);
$$;

alter table public.coberturas enable row level security;
alter table public.coberturas force row level security;
alter table public.cobertura_files enable row level security;
alter table public.cobertura_files force row level security;

drop policy if exists coberturas_read on public.coberturas;
create policy coberturas_read on public.coberturas for select to authenticated using (public.is_staff());
drop policy if exists coberturas_write on public.coberturas;
create policy coberturas_write on public.coberturas for all to authenticated
  using (public.can_manage_comunicaciones()) with check (public.can_manage_comunicaciones());

drop policy if exists cobertura_files_read on public.cobertura_files;
create policy cobertura_files_read on public.cobertura_files for select to authenticated using (public.is_staff());
drop policy if exists cobertura_files_write on public.cobertura_files;
create policy cobertura_files_write on public.cobertura_files for all to authenticated
  using (public.can_manage_comunicaciones()) with check (public.can_manage_comunicaciones());

-- ─────────────── Storage: staging de coberturas ───────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('coberturas','coberturas', true, 104857600)  -- 100 MB (video/contenido pesado)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

drop policy if exists "utl read coberturas" on storage.objects;
create policy "utl read coberturas" on storage.objects for select to public using (bucket_id = 'coberturas');
drop policy if exists "utl write coberturas" on storage.objects;
create policy "utl write coberturas" on storage.objects for insert to authenticated with check (bucket_id = 'coberturas');
drop policy if exists "utl delete coberturas" on storage.objects;
create policy "utl delete coberturas" on storage.objects for delete to authenticated using (bucket_id = 'coberturas');
