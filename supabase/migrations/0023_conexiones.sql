-- ============================================================================
-- UTL 360 · 0023_conexiones.sql
-- Conexiones de redes/fuentes para el monitoreo (X, NewsAPI, YouTube, Meta…).
-- Los SECRETOS (tokens/keys) se guardan en app_secrets (solo service role, key
-- 'conexion:<proveedor>'). El ESTADO público (conectado/probado) va en settings
-- key 'conexiones' para poder mostrarlo en la UI sin exponer credenciales.
-- Ejecuta DESPUÉS de 0022. Idempotente.
-- ============================================================================

insert into public.settings (key, value, descripcion)
values ('conexiones', '{}'::jsonb, 'Estado público de las conexiones de redes y fuentes de datos')
on conflict (key) do nothing;
