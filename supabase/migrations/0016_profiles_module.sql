-- ============================================================================
-- UTL 360 · 0016_profiles_module.sql
-- Módulo de Perfil de usuario: datos personales ampliados, foto (bucket público
-- 'avatars') y auditoría de cambios. Cada usuario edita su propia ficha; el
-- admin tiene registro y control de todos (RLS existente en 0003).
-- Ejecuta DESPUÉS de 0015. Idempotente.
-- ============================================================================

-- ─────────────── Campos adicionales del perfil ───────────────
alter table public.profiles
  add column if not exists cargo         text,   -- cargo/rol funcional en la UTL
  add column if not exists documento     text,   -- documento de identidad
  add column if not exists bio           text,   -- breve descripción
  add column if not exists direccion     text,
  add column if not exists fecha_ingreso date;

-- ─────────────── Auditoría de cambios de perfil ───────────────
drop trigger if exists trg_profiles_audit on public.profiles;
create trigger trg_profiles_audit
  after insert or update or delete on public.profiles
  for each row execute function public.log_audit_event();

-- ─────────────── Bucket público de avatares ───────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars','avatars', true, 5242880)   -- 5 MB, público (se muestran en la UI)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

drop policy if exists "utl read avatars" on storage.objects;
create policy "utl read avatars" on storage.objects for select to public
  using (bucket_id = 'avatars');

drop policy if exists "utl write avatars" on storage.objects;
create policy "utl write avatars" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars');

drop policy if exists "utl update avatars" on storage.objects;
create policy "utl update avatars" on storage.objects for update to authenticated
  using (bucket_id = 'avatars');

drop policy if exists "utl delete avatars" on storage.objects;
create policy "utl delete avatars" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars');
