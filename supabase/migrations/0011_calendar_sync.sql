-- ============================================================================
-- UTL 360 · 0011_calendar_sync.sql
-- Token por usuario para suscribir su calendario (ICS) en Google/iPhone.
-- Ejecuta DESPUÉS de 0010.
-- ============================================================================

alter table public.profiles add column if not exists calendar_token text;

-- Único cuando no es nulo
create unique index if not exists idx_profiles_calendar_token
  on public.profiles(calendar_token) where calendar_token is not null;
