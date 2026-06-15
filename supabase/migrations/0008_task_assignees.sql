-- ============================================================================
-- UTL 360 · 0008_task_assignees.sql
-- Responsables y participantes (varios) por tarea + helper de edición.
-- Ejecuta DESPUÉS de 0007. Idempotente.
-- ============================================================================

create table if not exists public.task_assignees (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  rol        text not null default 'participante' check (rol in ('responsable','participante')),
  created_at timestamptz not null default now(),
  unique (task_id, user_id)
);
create index if not exists idx_task_assignees_task on public.task_assignees(task_id);
create index if not exists idx_task_assignees_user on public.task_assignees(user_id);

-- ¿Puede el usuario editar/gestionar esta tarea?
create or replace function public.can_edit_task(p_task uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.tasks t
    where t.id = p_task and (
      t.creador_id = auth.uid()
      or t.responsable_id = auth.uid()
      or public.has_role('coordinador_utl'::app_role)
      or (t.workspace_id is not null and public.is_workspace_editor(t.workspace_id))
      or exists (
        select 1 from public.task_assignees ta
        where ta.task_id = t.id and ta.user_id = auth.uid() and ta.rol = 'responsable'
      )
    )
  );
$$;

-- ─────────────── RLS ───────────────
alter table public.task_assignees enable row level security;
alter table public.task_assignees force row level security;

drop policy if exists task_assignees_read on public.task_assignees;
create policy task_assignees_read on public.task_assignees for select to authenticated
  using (public.is_staff());

drop policy if exists task_assignees_write on public.task_assignees;
create policy task_assignees_write on public.task_assignees for all to authenticated
  using (public.can_edit_task(task_id))
  with check (public.can_edit_task(task_id));

-- ─────────────── Backfill: responsable_id actual → responsable ───────────────
insert into public.task_assignees (task_id, user_id, rol)
select id, responsable_id, 'responsable'
from public.tasks
where responsable_id is not null
on conflict (task_id, user_id) do nothing;
