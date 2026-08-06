-- ============================================================================
-- UTL 360 · 0029_fix_handle_new_user.sql
-- Repara el trigger de alta de usuarios.
--
-- Problema detectado: en la base de datos en producción la función
-- public.handle_new_user() había quedado sobrescrita por una versión ajena
-- que insertaba en `public.usuarios` (tabla que NO existe en este esquema;
-- aquí el perfil vive en `public.profiles`). Como el trigger corre AFTER
-- INSERT sobre auth.users, cualquier alta de usuario abortaba con
-- "Database error creating new user" (HTTP 500 / unexpected_failure).
--
-- Esta migración restaura la definición original de 0002_functions.sql.
-- Idempotente.
-- ============================================================================

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
  insert into public.user_roles (user_id, role)
  values (new.id, 'consulta')
  on conflict (user_id, role) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
