-- ============================================================================
-- UTL 360 · 0006_solicitudes_gestion.sql
-- Gestión integral de solicitudes (modelo BASE SOLICITUDES) + historial
-- auditable de solicitudes y tareas + soporte para el tablero Kanban.
-- Ejecuta DESPUÉS de 0005_notifications.sql.
-- ============================================================================

-- ─────────────────────────── SEMÁFORO ───────────────────────────
do $$ begin
  create type semaforo as enum ('verde','amarillo','rojo');
exception when duplicate_object then null; end $$;

-- ─────────────── Campos del modelo "BASE SOLICITUDES" en requests ───────────────
-- Datos de contacto del solicitante (cuando no hay citizen_id vinculado)
alter table public.requests add column if not exists nombre_solicitante text;
alter table public.requests add column if not exists documento         text;
alter table public.requests add column if not exists telefono          text;
alter table public.requests add column if not exists email             text;
alter table public.requests add column if not exists direccion         text;

-- Campos específicos por categoría (salud / hoja de vida / entidad / general)
alter table public.requests add column if not exists edad              int;
alter table public.requests add column if not exists eps               text;
alter table public.requests add column if not exists diagnostico       text;
alter table public.requests add column if not exists entidad           text;
alter table public.requests add column if not exists nivel_academico   text;
alter table public.requests add column if not exists perfil            text;
alter table public.requests add column if not exists organizacion      text;

-- Gestión / seguimiento del trámite
alter table public.requests add column if not exists tramite           text;
alter table public.requests add column if not exists fecha_gestion     date;
alter table public.requests add column if not exists observaciones     text;
alter table public.requests add column if not exists persona_remite    text;
alter table public.requests add column if not exists persona_encargada text;
alter table public.requests add column if not exists persona_recibe    text;
alter table public.requests add column if not exists semaforo          semaforo not null default 'verde';
alter table public.requests add column if not exists seguimiento       boolean not null default false;
alter table public.requests add column if not exists alerta            text;

create index if not exists idx_requests_semaforo on public.requests(semaforo);
create index if not exists idx_requests_tipo on public.requests(tipo_solicitud);

-- ─────────────── Historial auditable de solicitudes ───────────────
create table if not exists public.request_history (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references public.requests(id) on delete cascade,
  tipo            text not null default 'nota',  -- nota | cambio_estado | semaforo | gestion | sistema
  descripcion     text,
  estado_anterior text,
  estado_nuevo    text,
  author_id       uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists idx_request_history_req on public.request_history(request_id, created_at desc);

-- Registra automáticamente los cambios de estado y de semáforo
create or replace function public.log_request_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.estado is distinct from old.estado then
      insert into public.request_history(request_id, tipo, descripcion, estado_anterior, estado_nuevo, author_id)
      values (new.id, 'cambio_estado',
              'Estado: ' || old.estado || ' → ' || new.estado,
              old.estado::text, new.estado::text, auth.uid());
    end if;
    if new.semaforo is distinct from old.semaforo then
      insert into public.request_history(request_id, tipo, descripcion, estado_anterior, estado_nuevo, author_id)
      values (new.id, 'semaforo',
              'Semáforo: ' || old.semaforo || ' → ' || new.semaforo,
              old.semaforo::text, new.semaforo::text, auth.uid());
    end if;
  elsif tg_op = 'INSERT' then
    insert into public.request_history(request_id, tipo, descripcion, estado_nuevo, author_id)
    values (new.id, 'sistema', 'Solicitud radicada ('||new.radicado||')', new.estado::text, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists trg_requests_history on public.requests;
create trigger trg_requests_history
  after insert or update on public.requests
  for each row execute function public.log_request_change();

-- ─────────────── Tareas: orden para Kanban + historial ───────────────
alter table public.tasks add column if not exists orden int not null default 0;

create table if not exists public.task_history (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references public.tasks(id) on delete cascade,
  tipo            text not null default 'cambio_estado',  -- cambio_estado | nota | sistema
  descripcion     text,
  estado_anterior text,
  estado_nuevo    text,
  author_id       uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists idx_task_history_task on public.task_history(task_id, created_at desc);

create or replace function public.log_task_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    insert into public.task_history(task_id, tipo, descripcion, estado_anterior, estado_nuevo, author_id)
    values (new.id, 'cambio_estado',
            'Estado: ' || old.estado || ' → ' || new.estado,
            old.estado::text, new.estado::text, auth.uid());
  elsif tg_op = 'INSERT' then
    insert into public.task_history(task_id, tipo, descripcion, estado_nuevo, author_id)
    values (new.id, 'sistema', 'Tarea creada', new.estado::text, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists trg_tasks_history on public.tasks;
create trigger trg_tasks_history
  after insert or update on public.tasks
  for each row execute function public.log_task_change();

-- ─────────────────────────── RLS ───────────────────────────
alter table public.request_history enable row level security;
alter table public.request_history force row level security;
alter table public.task_history    enable row level security;
alter table public.task_history    force row level security;

drop policy if exists request_history_staff on public.request_history;
create policy request_history_staff on public.request_history for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists task_history_staff on public.task_history;
create policy task_history_staff on public.task_history for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
