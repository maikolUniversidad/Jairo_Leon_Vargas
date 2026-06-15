-- ============================================================================
-- UTL 360 · 0012_task_notifications.sql
-- Notificaciones automáticas de tareas:
--   1) Cambio de estado  → avisa a responsables, participantes y creador.
--   2) Nueva asignación  → avisa a la persona recién agregada.
--   3) Vencimiento cercano (3 días / 1 día / vencida) → job vía notify_due_tasks().
-- Patrón: triggers SECURITY DEFINER (igual que log_task_change / handle_new_user),
-- por lo que pueden insertar notificaciones para terceros sin chocar con RLS.
-- Ejecuta DESPUÉS de 0011. Idempotente.
-- ============================================================================

-- ─────────────── 1) Notificar al cambiar el estado de una tarea ───────────────
create or replace function public.notify_task_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor  uuid := auth.uid();   -- quién hizo el cambio (no se autonotifica)
  cuerpo text;
  recip  uuid;
begin
  if tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    cuerpo := new.titulo || ': ' || old.estado || ' → ' || new.estado;

    for recip in
      select distinct uid from (
        select user_id as uid from public.task_assignees where task_id = new.id
        union select new.responsable_id
        union select new.creador_id
      ) s
      where uid is not null and uid is distinct from actor
    loop
      insert into public.notifications (user_id, titulo, cuerpo, tipo, url, canal, created_by)
      values (recip, 'Novedad en una tarea', cuerpo, 'info', '/dashboard/tareas', 'in_app', actor);
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists trg_tasks_notify_status on public.tasks;
create trigger trg_tasks_notify_status
  after update on public.tasks
  for each row execute function public.notify_task_status_change();

-- ─────────────── 2) Notificar a quien es asignado a una tarea ───────────────
create or replace function public.notify_task_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor  uuid := auth.uid();
  titulo text;
begin
  if new.user_id is distinct from actor then
    select t.titulo into titulo from public.tasks t where t.id = new.task_id;
    insert into public.notifications (user_id, titulo, cuerpo, tipo, url, canal, created_by)
    values (
      new.user_id,
      'Te asignaron a una tarea',
      coalesce(titulo, 'Tarea') || ' · como ' || new.rol,
      'info', '/dashboard/tareas', 'in_app', actor
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_task_assignees_notify on public.task_assignees;
create trigger trg_task_assignees_notify
  after insert on public.task_assignees
  for each row execute function public.notify_task_assignment();

-- ─────────────── 3) Vencimiento cercano (job idempotente) ───────────────
-- Tabla de control: una notificación por tarea y umbral (evita repetir cada corrida).
create table if not exists public.task_due_pings (
  task_id    uuid not null references public.tasks(id) on delete cascade,
  umbral     text not null,            -- 'prox_3d' | 'prox_1d' | 'vencida'
  created_at timestamptz not null default now(),
  primary key (task_id, umbral)
);

-- Recorre las tareas activas con fecha límite próxima/vencida y notifica a su gente.
-- Devuelve cuántas notificaciones in-app creó. Llamar desde el cron (service role).
create or replace function public.notify_due_tasks()
returns integer language plpgsql security definer set search_path = public as $$
declare
  creadas int := 0;
  tk      record;
  umbral  text;
  tipo    text;
  cuerpo  text;
  recip   uuid;
begin
  for tk in
    select t.id, t.titulo, t.fecha_limite, t.responsable_id, t.creador_id
    from public.tasks t
    where t.deleted_at is null
      and t.fecha_limite is not null
      and t.estado not in ('finalizada','cancelada','aprobada')
      and t.fecha_limite <= now() + interval '3 days'
  loop
    if tk.fecha_limite < now() then
      umbral := 'vencida'; tipo := 'alerta';
      cuerpo := tk.titulo || ' venció el ' || to_char(tk.fecha_limite, 'DD/MM/YYYY');
    elsif tk.fecha_limite <= now() + interval '1 day' then
      umbral := 'prox_1d'; tipo := 'advertencia';
      cuerpo := tk.titulo || ' vence en menos de 24 horas';
    else
      umbral := 'prox_3d'; tipo := 'advertencia';
      cuerpo := tk.titulo || ' vence el ' || to_char(tk.fecha_limite, 'DD/MM/YYYY');
    end if;

    -- Dedupe por (tarea, umbral): si ya se notificó ese umbral, saltar.
    insert into public.task_due_pings (task_id, umbral) values (tk.id, umbral)
    on conflict do nothing;
    if not found then continue; end if;

    for recip in
      select distinct uid from (
        select user_id as uid from public.task_assignees where task_id = tk.id
        union select tk.responsable_id
        union select tk.creador_id
      ) s
      where uid is not null
    loop
      insert into public.notifications (user_id, titulo, cuerpo, tipo, url, canal)
      values (recip, 'Vencimiento de tarea', cuerpo, tipo, '/dashboard/tareas', 'in_app');
      creadas := creadas + 1;
    end loop;
  end loop;

  return creadas;
end $$;

-- Solo el service role (cron) puede ejecutar el job; nadie más.
revoke all on function public.notify_due_tasks() from public, anon, authenticated;
