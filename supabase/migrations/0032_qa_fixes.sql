-- ============================================================================
-- UTL 360 · 0032_qa_fixes.sql
-- Correcciones de los hallazgos rojos del QA automatizado (scripts/db-qa.mjs).
--
-- 1) task_due_pings quedó sin RLS → expuesta a la Data API (anon podía leerla,
--    insertarla y borrarla, y con ello silenciar los avisos de vencimiento).
-- 2) match_kb_chunks es SECURITY DEFINER y Postgres concede EXECUTE a PUBLIC por
--    defecto → cualquier anónimo con la clave publicable podía consultar la base
--    de conocimiento saltándose la RLS de kb_chunks.
-- 3) handle_new_user inserta user_roles sin `role_key`, y can_view_module() une
--    por role_key → todo usuario nuevo entra a un dashboard vacío.
-- 4) Backfill del role_key de los 12 usuarios ya creados con ese defecto.
-- 5) Políticas de storage heredadas de otro proyecto, apuntando a buckets que no
--    existen aquí (documentos-sst, galeria-fotos, productos-fotos, avatares).
-- 6) Índice duplicado en content_posts.
--
-- Idempotente. Ejecutar con:
--   node --env-file=.env.local scripts/db-exec.mjs supabase/migrations/0032_qa_fixes.sql
-- y verificar después con `npm run qa:db`.
-- ============================================================================

-- ─────────── 1) RLS en la tabla de control del cron de vencimientos ───────────
-- Sin políticas a propósito: es una tabla interna del job. notify_due_tasks()
-- es SECURITY DEFINER, así que sigue escribiéndola sin problema. Mismo patrón
-- que app_secrets.
alter table public.task_due_pings enable row level security;
alter table public.task_due_pings force row level security;

-- ─────────── 2) Cerrar el RPC de la base de conocimiento a anónimos ───────────
revoke all on function public.match_kb_chunks(vector, integer, double precision)
  from public, anon;
grant execute on function public.match_kb_chunks(vector, integer, double precision)
  to authenticated, service_role;

-- ─────────── 3) Alta de usuarios: poblar también role_key ───────────
-- Mantiene lo corregido en 0029 y añade role_key, que es la columna por la que
-- une can_view_module() y src/lib/auth.ts para resolver los módulos visibles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;

  -- Rol mínimo por defecto: 'consulta'. Un admin debe elevar manualmente.
  -- role_key debe ir siempre: sin él la matriz de permisos no aplica.
  insert into public.user_roles (user_id, role, role_key)
  values (new.id, 'consulta', 'consulta')
  on conflict (user_id, role) do update set role_key = excluded.role_key;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────── 4) Backfill de los usuarios ya afectados ───────────
update public.user_roles ur
set role_key = ur.role::text
where ur.role_key is null
  and exists (select 1 from public.roles_catalog rc where rc.key = ur.role::text);

-- ─────────── 5) Limpiar políticas de storage de otro proyecto ───────────
drop policy if exists "Authenticated upload documentos-sst" on storage.objects;
drop policy if exists "Authenticated delete documentos-sst" on storage.objects;
drop policy if exists "Public read documentos-sst"          on storage.objects;
drop policy if exists "Authenticated upload galeria-fotos"  on storage.objects;
drop policy if exists "Authenticated delete galeria-fotos"  on storage.objects;
drop policy if exists "Public read galeria-fotos"           on storage.objects;
drop policy if exists "Authenticated upload productos-fotos" on storage.objects;
drop policy if exists "Authenticated delete productos-fotos" on storage.objects;
drop policy if exists "Public read productos-fotos"          on storage.objects;
drop policy if exists "Public read avatares"                 on storage.objects;
drop policy if exists "Self upload avatar"                   on storage.objects;
drop policy if exists "Self delete avatar"                   on storage.objects;

-- ─────────── 6) Índice duplicado ───────────
-- content_posts_slug_key (UNIQUE sobre slug) ya cubre lo que hace idx_content_slug.
drop index if exists public.idx_content_slug;
