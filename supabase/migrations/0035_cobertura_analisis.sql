-- ============================================================================
-- UTL 360 · 0035_cobertura_analisis.sql
-- Análisis automático del material de una cobertura: qué se ve en cada pieza,
-- para qué sirve y con qué etiquetas. Alimenta el brief que se le pasa a la IA.
-- Ejecuta DESPUÉS de 0034 (usa `tipo_contenido`). Idempotente.
-- ============================================================================

alter table public.cobertura_files
  add column if not exists analisis            text,
  add column if not exists analisis_etiquetas  text[] not null default '{}',
  add column if not exists analisis_estado     text not null default 'pendiente',
  add column if not exists analisis_error      text,
  add column if not exists analisis_modelo     text,
  add column if not exists analisis_at         timestamptz;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'cobertura_files_analisis_estado_check'
  ) then
    alter table public.cobertura_files
      add constraint cobertura_files_analisis_estado_check
      check (analisis_estado in ('pendiente','listo','error','omitido'));
  end if;
end $$;

-- El tablero pregunta «cuántos quedan por analizar en esta cobertura»: un índice
-- parcial sobre lo que NO está listo responde eso sin recorrer todo el material.
create index if not exists idx_cobertura_files_analisis_pendiente
  on public.cobertura_files (cobertura_id, analisis_estado)
  where analisis_estado <> 'listo';

-- El audio y los archivos sin clasificar no se analizan: no hay transcripción en
-- la plataforma. Se marcan de una vez para que no aparezcan como pendientes.
update public.cobertura_files
set analisis_estado = 'omitido',
    analisis_error  = 'Este tipo de archivo no se analiza automáticamente.'
where analisis_estado = 'pendiente'
  and tipo_contenido in ('audio','otro');
