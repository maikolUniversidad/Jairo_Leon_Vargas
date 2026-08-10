-- ============================================================================
-- UTL 360 · 0033_cobertura_ficha.sql
-- Ficha ampliada de una cobertura (objetivo, bitácora, mensajes, cierre y
-- contexto) y registro de asistentes, vinculados o escritos a mano.
-- Ejecuta DESPUÉS de 0032. Idempotente.
-- ============================================================================

-- ─────────────── Campos de la ficha ───────────────
-- Todas nulas o con default: las coberturas existentes siguen siendo válidas.
alter table public.coberturas
  add column if not exists objetivo         text,
  add column if not exists resumen          text,
  add column if not exists mensajes_clave   text,
  add column if not exists temas            text[] not null default '{}',
  add column if not exists resultados       text,
  add column if not exists compromisos      text,
  add column if not exists aliados          text,
  add column if not exists publico_estimado int,
  add column if not exists hashtags         text[] not null default '{}';

-- ─────────────── Asistentes ───────────────
-- `nombre` se guarda siempre, también en los vinculados: si el contacto o el
-- ciudadano se borra, el registro histórico de la cobertura no se queda mudo.
create table if not exists public.cobertura_asistentes (
  id           uuid primary key default gen_random_uuid(),
  cobertura_id uuid not null references public.coberturas(id) on delete cascade,
  contacto_id  uuid references public.contacts(id) on delete set null,
  ciudadano_id uuid references public.citizens(id) on delete set null,
  nombre       text not null,
  rol          text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint cobertura_asistentes_nombre_no_vacio check (length(btrim(nombre)) > 0)
);

create index if not exists idx_cobertura_asistentes
  on public.cobertura_asistentes(cobertura_id, created_at);

-- Evita registrar dos veces a la misma persona vinculada en una cobertura.
create unique index if not exists idx_cobertura_asistentes_contacto
  on public.cobertura_asistentes(cobertura_id, contacto_id)
  where contacto_id is not null;
create unique index if not exists idx_cobertura_asistentes_ciudadano
  on public.cobertura_asistentes(cobertura_id, ciudadano_id)
  where ciudadano_id is not null;

-- ─────────────── RLS: igual que el resto del módulo ───────────────
alter table public.cobertura_asistentes enable row level security;
alter table public.cobertura_asistentes force row level security;

drop policy if exists cobertura_asistentes_read on public.cobertura_asistentes;
create policy cobertura_asistentes_read on public.cobertura_asistentes
  for select to authenticated using (public.is_staff());

drop policy if exists cobertura_asistentes_write on public.cobertura_asistentes;
create policy cobertura_asistentes_write on public.cobertura_asistentes
  for all to authenticated
  using (public.can_manage_comunicaciones())
  with check (public.can_manage_comunicaciones());
