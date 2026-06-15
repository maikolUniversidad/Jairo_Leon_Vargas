-- ============================================================================
-- UTL 360 · 0018_contenido_bucket.sql
-- Bucket público para imágenes de publicaciones (noticias/comunicados/piezas).
-- Ejecuta DESPUÉS de 0017.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('contenido','contenido', true, 10485760)  -- 10 MB
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

drop policy if exists "utl read contenido" on storage.objects;
create policy "utl read contenido" on storage.objects for select to public using (bucket_id = 'contenido');
drop policy if exists "utl write contenido" on storage.objects;
create policy "utl write contenido" on storage.objects for insert to authenticated with check (bucket_id = 'contenido');
drop policy if exists "utl delete contenido" on storage.objects;
create policy "utl delete contenido" on storage.objects for delete to authenticated using (bucket_id = 'contenido');
