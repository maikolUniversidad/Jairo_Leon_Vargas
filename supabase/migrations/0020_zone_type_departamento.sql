-- ============================================================================
-- UTL 360 · 0020_zone_type_departamento.sql
-- Agrega el nivel 'departamento' al enum zone_type (mapa de Colombia).
-- Debe ir en su propio archivo: ADD VALUE no puede usarse en la misma
-- transacción donde se consume. Ejecuta ANTES de 0021.
-- ============================================================================
alter type zone_type add value if not exists 'departamento';
