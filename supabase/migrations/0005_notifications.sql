-- ============================================================================
-- UTL 360 · 0005_notifications.sql
-- Sistema de notificaciones multiplataforma y auditable.
-- Ejecuta DESPUÉS de 0004_seed.sql (idempotente).
-- ============================================================================

-- ── Extender notifications para multicanal + trazabilidad ──
alter table public.notifications
  add column if not exists canal        text not null default 'in_app',  -- in_app|email|push|whatsapp
  add column if not exists estado_envio text not null default 'enviado', -- enviado|pendiente|fallido
  add column if not exists batch_id     uuid,
  add column if not exists created_by   uuid references auth.users(id) on delete set null;

create index if not exists idx_notifications_batch on public.notifications(batch_id);

-- ── Batches: una fila por envío del administrador (auditoría) ──
create table if not exists public.notification_batches (
  id                  uuid primary key default gen_random_uuid(),
  titulo              text not null,
  cuerpo              text,
  tipo                text not null default 'info',     -- info|exito|advertencia|alerta
  url                 text,
  canales             text[] not null default '{in_app}',
  audiencia_tipo      text not null default 'todos',    -- todos|rol|usuario
  audiencia_valor     text,                             -- rol o user_id según el tipo
  total_destinatarios int not null default 0,
  resultado_canales   jsonb not null default '{}',      -- {email: "no_configurado", ...}
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index if not exists idx_notif_batches_fecha on public.notification_batches(created_at desc);

-- ── RLS ──
alter table public.notification_batches enable row level security;
alter table public.notification_batches force row level security;

-- ¿Quién puede emitir notificaciones masivas?
create or replace function public.can_send_notifications()
returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.is_admin()
    or public.has_role('direccion_general'::app_role)
    or public.has_role('coordinador_utl'::app_role)
    or public.has_role('comunicaciones'::app_role);
$$;

-- notifications: reescribir políticas (cada quien las suyas; emisores insertan a terceros)
drop policy if exists notifications_owner on public.notifications;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Insert: el destinatario para sí mismo (sistema) o un emisor autorizado para terceros
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert to authenticated
  with check (user_id = auth.uid() or public.can_send_notifications());

-- batches: emisores crean y leen; admin/dirección ven todo (auditoría)
drop policy if exists notif_batches_insert on public.notification_batches;
create policy notif_batches_insert on public.notification_batches for insert to authenticated
  with check (public.can_send_notifications());

drop policy if exists notif_batches_read on public.notification_batches;
create policy notif_batches_read on public.notification_batches for select to authenticated
  using (public.can_send_notifications());

-- ── Auditoría del envío (queda en audit_logs) ──
drop trigger if exists trg_notif_batches_audit on public.notification_batches;
create trigger trg_notif_batches_audit
  after insert or update or delete on public.notification_batches
  for each row execute function public.log_audit_event();
