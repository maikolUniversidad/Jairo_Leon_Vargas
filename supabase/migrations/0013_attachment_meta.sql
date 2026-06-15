-- ============================================================================
-- UTL 360 · 0013_attachment_meta.sql
-- Metadatos en adjuntos de tareas: etiqueta, estado, requisito y descripción.
-- Ejecuta DESPUÉS de 0012.
-- ============================================================================

alter table public.task_attachments add column if not exists etiqueta     text;
alter table public.task_attachments add column if not exists estado       text not null default 'entregado';
alter table public.task_attachments add column if not exists es_requisito boolean not null default false;
alter table public.task_attachments add column if not exists descripcion  text;

create index if not exists idx_task_attachments_estado on public.task_attachments(estado);
create index if not exists idx_task_attachments_req on public.task_attachments(es_requisito);
