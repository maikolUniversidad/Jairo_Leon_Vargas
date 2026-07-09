-- ============================================================================
-- UTL 360 · 0026_monitor_run_tipo.sql
-- Distingue el tipo de corrida de recolección: 'reciente' (incremental/programada)
-- o 'barrido' (búsqueda amplia/histórica). Ejecuta DESPUÉS de 0025. Idempotente.
-- ============================================================================

alter table public.monitor_runs
  add column if not exists tipo text not null default 'reciente';   -- reciente|barrido
