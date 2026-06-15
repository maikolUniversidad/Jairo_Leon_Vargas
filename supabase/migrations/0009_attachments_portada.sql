-- ============================================================================
-- UTL 360 · 0009_attachments_portada.sql
-- Adjuntos acumulativos (archivos + enlaces) en tareas + portada de workspace.
-- Crea buckets de Storage y sus políticas. Ejecuta DESPUÉS de 0008.
-- ============================================================================

-- ─────────────── Portada de workspace ───────────────
alter table public.workspaces add column if not exists portada_url text;

-- ─────────────── Adjuntos de tarea (acumulativo) ───────────────
create table if not exists public.task_attachments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  tipo        text not null default 'archivo' check (tipo in ('archivo','link')),
  nombre      text not null,
  url         text not null,
  storage_path text,            -- ruta dentro del bucket (para poder borrar el objeto)
  mime        text,
  size        bigint,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_task_attachments_task on public.task_attachments(task_id, created_at desc);

alter table public.task_attachments enable row level security;
alter table public.task_attachments force row level security;

drop policy if exists task_attachments_read on public.task_attachments;
create policy task_attachments_read on public.task_attachments for select to authenticated
  using (public.is_staff());

drop policy if exists task_attachments_write on public.task_attachments;
create policy task_attachments_write on public.task_attachments for all to authenticated
  using (public.can_edit_task(task_id))
  with check (public.can_edit_task(task_id));

-- ─────────────── Buckets de Storage ───────────────
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('task-files','task-files', true, 26214400),          -- 25 MB
  ('workspace-covers','workspace-covers', true, 6291456) -- 6 MB
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

-- Políticas sobre storage.objects (lectura pública; escritura autenticada)
drop policy if exists "utl read task-files" on storage.objects;
create policy "utl read task-files" on storage.objects for select to public
  using (bucket_id = 'task-files');
drop policy if exists "utl write task-files" on storage.objects;
create policy "utl write task-files" on storage.objects for insert to authenticated
  with check (bucket_id = 'task-files');
drop policy if exists "utl delete task-files" on storage.objects;
create policy "utl delete task-files" on storage.objects for delete to authenticated
  using (bucket_id = 'task-files');

drop policy if exists "utl read covers" on storage.objects;
create policy "utl read covers" on storage.objects for select to public
  using (bucket_id = 'workspace-covers');
drop policy if exists "utl write covers" on storage.objects;
create policy "utl write covers" on storage.objects for insert to authenticated
  with check (bucket_id = 'workspace-covers');
drop policy if exists "utl delete covers" on storage.objects;
create policy "utl delete covers" on storage.objects for delete to authenticated
  using (bucket_id = 'workspace-covers');
