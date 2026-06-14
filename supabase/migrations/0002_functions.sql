-- ============================================================================
-- UTL 360 · 0002_functions.sql
-- Funciones helper de autorización, radicado, auditoría y alta de usuarios.
-- Ejecuta DESPUÉS de 0001_schema.sql.
-- ============================================================================

-- ───────────── Helpers de roles (SECURITY DEFINER para usarse en políticas RLS) ─────────────

create or replace function public.get_my_role()
returns app_role
language sql stable security definer set search_path = public as $$
  select role from public.user_roles where user_id = auth.uid() limit 1;
$$;

create or replace function public.has_role(role_name app_role)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = role_name
  );
$$;

-- Sobrecarga por texto (cómoda desde el cliente)
create or replace function public.has_role(role_name text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role::text = role_name
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role in ('super_admin','administrador')
  );
$$;

-- ¿El usuario puede gestionar un área? (admins, dirección, coordinación o su propia área)
create or replace function public.can_manage_area(target_area uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.is_admin()
    or public.has_role('direccion_general'::app_role)
    or public.has_role('coordinador_utl'::app_role)
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.area_id = target_area
    );
$$;

-- ¿Tiene alguno de los roles de "staff" con acceso de lectura operativa?
create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid());
$$;

-- ───────────── Radicado: JLV-YYYY-NNNNNN ─────────────
create sequence if not exists public.radicado_seq start 1;

create or replace function public.generate_radicado()
returns text
language plpgsql volatile as $$
declare
  n bigint;
begin
  n := nextval('public.radicado_seq');
  return 'JLV-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 6, '0');
end $$;

-- Asigna radicado automáticamente si viene nulo/vacío
create or replace function public.set_request_radicado()
returns trigger language plpgsql as $$
begin
  if new.radicado is null or new.radicado = '' then
    new.radicado := public.generate_radicado();
  end if;
  return new;
end $$;

drop trigger if exists trg_requests_radicado on public.requests;
create trigger trg_requests_radicado
  before insert on public.requests
  for each row execute function public.set_request_radicado();

-- ───────────── Auditoría genérica ─────────────
create or replace function public.log_audit_event()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_before jsonb;
  v_after  jsonb;
  v_id     text;
begin
  if tg_op = 'INSERT' then
    v_after := to_jsonb(new); v_id := (new.id)::text;
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old); v_after := to_jsonb(new); v_id := (new.id)::text;
  elsif tg_op = 'DELETE' then
    v_before := to_jsonb(old); v_id := (old.id)::text;
  end if;

  insert into public.audit_logs(actor_id, accion, entidad, entidad_id, antes, despues)
  values (auth.uid(), tg_op, tg_table_name, v_id, v_before, v_after);

  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'citizens','requests','tasks','zones','events','documents','content_posts','user_roles'
  ] loop
    execute format(
      'drop trigger if exists trg_%1$s_audit on public.%1$s;
       create trigger trg_%1$s_audit
       after insert or update or delete on public.%1$s
       for each row execute function public.log_audit_event();', t);
  end loop;
end $$;

-- ───────────── Alta automática de perfil al registrar usuario ─────────────
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
