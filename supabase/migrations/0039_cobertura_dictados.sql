-- ============================================================================
-- UTL 360 · 0039_cobertura_dictados.sql
-- El cuestionario pasa de una grabación por pregunta a UN audio largo: se habla
-- seguido mientras se ojean las preguntas como guion, y la IA reparte después.
-- Quedan dos cosas: la transcripción completa (aquí) y lo clasificado por
-- pregunta (en `cobertura_respuestas`, como hasta ahora).
-- Ejecuta DESPUÉS de 0038. Idempotente.
-- ============================================================================

create table if not exists public.cobertura_dictados (
  id            uuid primary key default gen_random_uuid(),
  cobertura_id  uuid not null references public.coberturas(id) on delete cascade,
  transcripcion text not null,
  audio_path    text,
  duracion_seg  int,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint cobertura_dictados_no_vacio check (length(btrim(transcripcion)) > 0)
);

-- Se conservan todos los dictados de una cobertura, no solo el último: si
-- alguien vuelve a grabar, lo dicho antes sigue siendo el registro de lo que se
-- contó ese día. El más reciente es el que manda al repartir.
create index if not exists idx_cobertura_dictados_cob
  on public.cobertura_dictados (cobertura_id, created_at desc);

alter table public.cobertura_dictados enable row level security;
alter table public.cobertura_dictados force  row level security;

drop policy if exists cobertura_dictados_read on public.cobertura_dictados;
create policy cobertura_dictados_read on public.cobertura_dictados
  for select to authenticated using (public.is_staff());

drop policy if exists cobertura_dictados_write on public.cobertura_dictados;
create policy cobertura_dictados_write on public.cobertura_dictados
  for all to authenticated
  using (public.can_manage_comunicaciones()) with check (public.can_manage_comunicaciones());
