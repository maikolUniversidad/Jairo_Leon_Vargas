-- ============================================================================
-- UTL 360 · 0040_asistentes_vinculo.sql
-- Quiénes estuvieron en una cobertura deja de ser una lista plana:
--   · se puede vincular a un USUARIO de la plataforma, no solo a contactos y
--     ciudadanos, que es como se sabe quién del equipo estuvo;
--   · cada asistente dice a qué título fue (equipo / aliado / otro);
--   · los aliados guardan su organización, para nombrar personas y no solo
--     entidades sueltas.
-- Ejecuta DESPUÉS de 0039. Idempotente.
-- ============================================================================

alter table public.cobertura_asistentes
  add column if not exists user_id      uuid references auth.users(id) on delete set null,
  add column if not exists organizacion text,
  add column if not exists vinculo      text not null default 'otro';

-- `equipo`  → gente de la UTL que cubrió la jornada.
-- `aliado`  → personas de organizaciones o instituciones que acompañaron.
-- `otro`    → asistentes que no son ninguna de las dos.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cobertura_asistentes_vinculo_check'
  ) then
    alter table public.cobertura_asistentes
      add constraint cobertura_asistentes_vinculo_check
      check (vinculo in ('equipo','aliado','otro'));
  end if;
end $$;

-- Un usuario no se registra dos veces en la misma cobertura. Índice parcial:
-- los asistentes escritos a mano tienen user_id nulo y no deben chocar entre sí.
create unique index if not exists idx_cobertura_asistentes_usuario
  on public.cobertura_asistentes (cobertura_id, user_id)
  where user_id is not null;

create index if not exists idx_cobertura_asistentes_vinculo
  on public.cobertura_asistentes (cobertura_id, vinculo);

-- Los que ya estaban vinculados a un contacto se marcan como aliados: un
-- contacto en el CRM es, por definición, alguien de fuera del equipo.
update public.cobertura_asistentes
set vinculo = 'aliado'
where vinculo = 'otro' and contacto_id is not null;
