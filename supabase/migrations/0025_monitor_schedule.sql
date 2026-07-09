-- ============================================================================
-- UTL 360 · 0025_monitor_schedule.sql
-- Programación automática del monitoreo por persona: frecuencia y hora.
-- El cron (/api/cron/monitoreo) revisa cada hora quién está "vencido" y
-- ejecuta la recolección desde todas las APIs conectadas.
-- Ejecuta DESPUÉS de 0024. Idempotente.
-- ============================================================================

alter table public.monitor_persons
  add column if not exists auto_activo     boolean not null default false,
  add column if not exists auto_frecuencia text not null default 'manual',  -- manual|cada_hora|cada_6h|cada_12h|diario
  add column if not exists auto_hora        int not null default 8;         -- 0-23, hora Colombia para 'diario'
