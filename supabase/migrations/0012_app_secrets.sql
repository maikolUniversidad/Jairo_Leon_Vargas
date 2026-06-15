-- ============================================================================
-- UTL 360 · 0012_app_secrets.sql
-- Almacén de secretos de integraciones (p. ej. refresh token de Google Drive).
-- RLS habilitado y SIN políticas: nadie autenticado puede leerlo; solo el
-- service role (server) accede. Ejecuta DESPUÉS de 0011.
-- ============================================================================

create table if not exists public.app_secrets (
  key        text primary key,
  value      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.app_secrets enable row level security;
alter table public.app_secrets force row level security;
-- Intencionalmente sin políticas: inaccesible para anon/authenticated.

-- Config pública de Drive (NO sensible) para mostrar estado en la UI.
insert into public.settings (key, value, descripcion)
values ('google_drive', '{"connected": false}'::jsonb, 'Estado de la integración con Google Drive')
on conflict (key) do nothing;
