-- ============================================================================
-- UTL 360 · 0036_cobertura_cuestionario.sql
-- Cuestionario por voz de la ficha de una cobertura: catálogo de preguntas
-- (una por campo de la ficha) y respuestas grabadas.
-- Ejecuta DESPUÉS de 0035. Idempotente.
-- ============================================================================

-- ─────────────── Catálogo de preguntas ───────────────
-- `campo` amarra cada pregunta al campo de la ficha que llena. Sin eso, no se
-- sabría dónde volcar la respuesta. Debe coincidir con las columnas de 0033.
create table if not exists public.cobertura_preguntas (
  id         uuid primary key default gen_random_uuid(),
  pregunta   text not null,
  ayuda      text,
  campo      text not null check (campo in (
               'objetivo','resumen','mensajes_clave','temas','resultados',
               'compromisos','aliados','publico_estimado','hashtags')),
  orden      int  not null default 0,
  activa     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cobertura_preguntas_no_vacia check (length(btrim(pregunta)) > 0)
);

create index if not exists idx_cobertura_preguntas_orden
  on public.cobertura_preguntas (activa, orden);

-- ─────────────── Respuestas ───────────────
-- El unique hace que volver a grabar una pregunta REEMPLACE su respuesta en vez
-- de acumular: es lo que sostiene el «ya respondí esta» entre sesiones.
--
-- `audio_path` apunta al bucket `coberturas` bajo {cobertura_id}/respuestas/.
-- A propósito NO es un `cobertura_files`: una nota de voz sobre el evento no la
-- grabó ningún equipo de grabación, y el tablero exige atribución.
create table if not exists public.cobertura_respuestas (
  id            uuid primary key default gen_random_uuid(),
  cobertura_id  uuid not null references public.coberturas(id) on delete cascade,
  pregunta_id   uuid not null references public.cobertura_preguntas(id) on delete cascade,
  transcripcion text not null,
  audio_path    text,
  duracion_seg  int,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (cobertura_id, pregunta_id)
);

create index if not exists idx_cobertura_respuestas_cob
  on public.cobertura_respuestas (cobertura_id);

-- ─────────────── RLS ───────────────
alter table public.cobertura_preguntas  enable row level security;
alter table public.cobertura_preguntas  force  row level security;
alter table public.cobertura_respuestas enable row level security;
alter table public.cobertura_respuestas force  row level security;

drop policy if exists cobertura_preguntas_read on public.cobertura_preguntas;
create policy cobertura_preguntas_read on public.cobertura_preguntas
  for select to authenticated using (public.is_staff());
drop policy if exists cobertura_preguntas_write on public.cobertura_preguntas;
create policy cobertura_preguntas_write on public.cobertura_preguntas
  for all to authenticated
  using (public.can_manage_comunicaciones()) with check (public.can_manage_comunicaciones());

drop policy if exists cobertura_respuestas_read on public.cobertura_respuestas;
create policy cobertura_respuestas_read on public.cobertura_respuestas
  for select to authenticated using (public.is_staff());
drop policy if exists cobertura_respuestas_write on public.cobertura_respuestas;
create policy cobertura_respuestas_write on public.cobertura_respuestas
  for all to authenticated
  using (public.can_manage_comunicaciones()) with check (public.can_manage_comunicaciones());

drop trigger if exists trg_cobertura_preguntas_updated on public.cobertura_preguntas;
create trigger trg_cobertura_preguntas_updated before update on public.cobertura_preguntas
  for each row execute function public.set_updated_at();

drop trigger if exists trg_cobertura_respuestas_updated on public.cobertura_respuestas;
create trigger trg_cobertura_respuestas_updated before update on public.cobertura_respuestas
  for each row execute function public.set_updated_at();

-- ─────────────── Semilla: una pregunta por campo de la ficha ───────────────
-- Redactadas para que se respondan hablando, no escribiendo: quien las contesta
-- acaba de salir de una jornada en calle.
insert into public.cobertura_preguntas (pregunta, ayuda, campo, orden) values
  ('¿A qué fuimos?',                    'El objetivo de la jornada, en una frase.',                    'objetivo',         1),
  ('¿Qué se hizo?',                     'Cuenta cómo estuvo: qué pasó, quién habló, cómo respondió la gente.', 'resumen',  2),
  ('¿Qué se dijo que hay que repetir?', 'Los mensajes que valen la pena sostener en redes y en prensa.', 'mensajes_clave', 3),
  ('¿De qué se habló?',                 'Los temas que salieron. Puedes nombrar varios.',              'temas',            4),
  ('¿Qué salió de ahí?',                'Resultados concretos de la jornada.',                         'resultados',       5),
  ('¿Qué compromisos quedaron?',        'Acuerdos concretos: con quién y para cuándo.',                'compromisos',      6),
  ('¿Quiénes acompañaron?',             'Aliados, organizaciones o instituciones presentes.',          'aliados',          7),
  ('¿Cuánta gente llegó?',              'Un número aproximado está bien.',                             'publico_estimado', 8),
  ('¿Qué etiquetas usamos?',            'Hashtags para publicar esto.',                                'hashtags',         9)
on conflict do nothing;
