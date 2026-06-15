-- ============================================================================
-- UTL 360 · 0015_documents_drive.sql
-- Vincula el módulo de Documentos con Google Drive: cada carpeta documental
-- espeja una carpeta en Drive (bajo "03 Documentos") y los documentos no
-- reservados se guardan ahí. El control por roles sigue rigiendo en la app (RLS).
-- Ejecuta DESPUÉS de 0014.
-- ============================================================================

alter table public.document_folders add column if not exists drive_folder_id text;
alter table public.documents add column if not exists drive_file_id text;
