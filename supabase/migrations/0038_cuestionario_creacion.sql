-- ============================================================================
-- UTL 360 · 0038_cuestionario_creacion.sql
-- El cuestionario por voz también se responde al crear la cobertura, no solo al
-- editarla. Eso obliga a dos cosas:
--   1) que una pregunta pueda apuntar a los campos básicos (nombre, fecha,
--      lugar, descripción), no solo a los nueve de la ficha;
--   2) saber qué preguntas tienen sentido ANTES del evento y cuáles solo
--      después, porque una cobertura se puede crear para planear o al volver.
-- Ejecuta DESPUÉS de 0037. Idempotente.
-- ============================================================================

-- ─────────────── 1) El campo destino admite los básicos ───────────────
alter table public.cobertura_preguntas
  drop constraint if exists cobertura_preguntas_campo_check;

alter table public.cobertura_preguntas
  add constraint cobertura_preguntas_campo_check check (campo in (
    -- Básicos, del diálogo de creación
    'nombre','descripcion','fecha','lugar',
    -- Ficha ampliada (0033)
    'objetivo','resumen','mensajes_clave','temas','resultados',
    'compromisos','aliados','publico_estimado','hashtags'
  ));

-- ─────────────── 2) Cuándo tiene sentido preguntarlo ───────────────
-- `siempre`   → sirve antes y después (cómo se llama, a qué vamos).
-- `posterior` → solo tiene sentido con el evento ya hecho (qué pasó, cuánta
--               gente llegó, qué compromisos quedaron).
-- Al abrir el cuestionario se pregunta si la jornada ya ocurrió y se filtra con
-- esto, para que nadie tenga que saltar preguntas sin sentido.
alter table public.cobertura_preguntas
  add column if not exists momento text not null default 'posterior';

alter table public.cobertura_preguntas
  drop constraint if exists cobertura_preguntas_momento_check;
alter table public.cobertura_preguntas
  add constraint cobertura_preguntas_momento_check
  check (momento in ('siempre','posterior'));

-- ─────────────── 3) Preguntas de los campos básicos ───────────────
-- Van con orden negativo para que abran el carrusel: primero identificar la
-- jornada, después contarla.
insert into public.cobertura_preguntas (pregunta, ayuda, campo, orden, momento) values
  ('¿Cómo llamamos esta jornada?', 'Un nombre corto que la identifique. Ej. «Recorrido Kennedy 14 jun».', 'nombre',      -4, 'siempre'),
  ('¿Dónde fue?',                  'Barrio, localidad o dirección.',                                      'lugar',       -3, 'siempre'),
  ('¿Qué día fue?',                'La fecha de la jornada.',                                             'fecha',       -2, 'siempre'),
  ('¿De qué se trata?',            'Una descripción breve, para ubicar a quien la lea después.',          'descripcion', -1, 'siempre')
on conflict do nothing;

-- ─────────────── 4) Momento de las nueve que ya existían ───────────────
-- El objetivo y los hashtags se pueden definir antes de salir; el resto habla
-- de lo que pasó y solo aplica al volver.
update public.cobertura_preguntas set momento = 'siempre'
  where campo in ('objetivo','hashtags');
update public.cobertura_preguntas set momento = 'posterior'
  where campo in ('resumen','mensajes_clave','temas','resultados','compromisos','aliados','publico_estimado');
