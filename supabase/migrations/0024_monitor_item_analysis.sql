-- ============================================================================
-- UTL 360 · 0024_monitor_item_analysis.sql
-- Análisis por mención: resumen, si habla directamente de la persona, etiquetas
-- de tema y un análisis breve (generados por IA sobre el titular/contenido).
-- Ejecuta DESPUÉS de 0023. Idempotente.
-- ============================================================================

alter table public.monitor_items
  add column if not exists resumen     text,
  add column if not exists es_directo  boolean,
  add column if not exists etiquetas   text[] not null default '{}',
  add column if not exists analisis    text,
  add column if not exists analizado_at timestamptz;
