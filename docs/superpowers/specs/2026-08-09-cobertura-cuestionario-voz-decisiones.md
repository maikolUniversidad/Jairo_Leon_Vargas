# Cuestionario por voz — decisiones previas (SUPERADO)

> **Este documento quedó superado.** El spec completo está en
> [`2026-08-10-cobertura-cuestionario-voz-design.md`](2026-08-10-cobertura-cuestionario-voz-design.md).
>
> Se conserva por dos correcciones que dejó el camino y vale la pena recordar:
>
> 1. **La transcripción no había que construirla.** Este documento la daba por
>    trabajo pendiente; `/api/ia/transcribe` ya existía y estaba en producción
>    para el Asistente IA. Media función estaba hecha.
> 2. **El audio de las respuestas NO va al tablero.** Aquí se decidió guardarlo
>    como archivo de la cobertura; para entonces todavía no existía la regla de
>    que todo archivo exige un equipo de grabación. Una nota de voz sobre el
>    evento no la grabó ningún equipo, así que vive en `cobertura_respuestas`.
