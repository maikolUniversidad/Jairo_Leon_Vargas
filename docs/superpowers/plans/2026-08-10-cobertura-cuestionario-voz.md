# Cuestionario por voz — Plan de implementación

> Spec: `docs/superpowers/specs/2026-08-10-cobertura-cuestionario-voz-design.md`
> Los pasos usan casillas (`- [ ]`) para ir marcando.

**Meta:** responder por voz las preguntas de la ficha de una cobertura, en carrusel, y volcar lo dicho a los nueve campos tras una revisión lado a lado.

**Arquitectura:** la grabación y la extracción viven en `src/lib/` sin saber de coberturas y se prueban solas. Se reutiliza `/api/ia/transcribe`, que ya está en producción. El avance se guarda respuesta a respuesta, no al final.

**Orden:** 1 (datos) → 2-3 (lógica pura, con pruebas) → 4 (servidor) → 5-7 (interfaz) → 8 (cierre).

---

## Task 1 · Migración 0036

**Archivos:** Crear `supabase/migrations/0036_cobertura_cuestionario.sql`

- [ ] Las dos tablas del spec, con RLS (`is_staff()` lectura, `can_manage_comunicaciones()` escritura), trigger `set_updated_at` y el `unique (cobertura_id, pregunta_id)`.
- [ ] Semilla de las nueve preguntas, una por campo de la ficha, con `on conflict do nothing` para que sea idempotente.
- [ ] Aplicar: `node --env-file=.env.local scripts/db-exec.mjs supabase/migrations/0036_cobertura_cuestionario.sql`
- [ ] Verificar con `npm run qa:db -- --quiet` que ninguna tabla nueva aparezca sin RLS.

## Task 2 · `src/lib/audio-recorder.ts`

Hook `useGrabadora()`: pide permiso, graba con `MediaRecorder`, devuelve el blob y su duración. Expone `soportado`, `permisoDenegado`, `grabando`.

- [ ] Prueba: el estado inicial es correcto y `soportado` es false cuando no hay `MediaRecorder` (se simula en el entorno de Node).
- [ ] Implementar, copiando el patrón de `ChatComposer.tsx:46-64`.
- [ ] Liberar el `MediaStream` al terminar: si no, el indicador de micrófono del navegador se queda encendido.

## Task 3 · `src/lib/ia/extraer-ficha.ts`

- [ ] Prueba primero: transcripciones → campos; respuestas vacías se ignoran; `publico_estimado` que llega como `"unas 300 personas"` sale como `300`; `temas`/`hashtags` salen como arreglo; si la IA no aporta un campo, ese campo no se propone.
- [ ] Implementar con `completeWithTools`, con el catálogo de campos importado de un módulo compartido para que no se desincronice del `check` de la migración.

## Task 4 · Acciones

**`src/actions/cuestionario.ts`** — `listPreguntas()`, `getRespuestas(coberturaId)`, `guardarRespuesta({cobertura_id, pregunta_id, transcripcion, audio_path, duracion_seg})` (upsert por el `unique`), `subirAudioRespuesta()` al bucket `coberturas` bajo `{id}/respuestas/`, `extraerFicha(coberturaId)`.

**`src/actions/preguntas.ts`** — CRUD del catálogo, errores por campo con `zodToFieldErrors`.

- [ ] Tipos y catálogos en `src/lib/cuestionario-shared.ts`: los archivos `"use server"` solo pueden exportar funciones async. *(Esto ya costó un build roto en la función anterior.)*
- [ ] `npm run typecheck`

## Task 5 · El carrusel

**Crear** `src/components/dashboard/cobertura-cuestionario.tsx`

- [ ] Navegación anterior/siguiente, teclas ← →, puntos clicables, scroll.
- [ ] Abre en la primera pendiente.
- [ ] Transcripción editable; se guarda al avanzar, no al terminar.
- [ ] Sin micrófono o con permiso negado: campo de texto, el cuestionario no se bloquea.
- [ ] Whisper falla: conservar el audio y ofrecer reintentar sin volver a grabar.

## Task 6 · La revisión lado a lado

**Crear** `src/components/dashboard/cobertura-extraccion-review.tsx`

- [ ] Campo por campo: actual vs. propuesto, con radio.
- [ ] Preselección: propuesto si el campo estaba vacío, **actual si ya tenía texto** — sobrescribir tiene que ser deliberado.
- [ ] `publico_estimado` como número; `temas`/`hashtags` como fichas.

## Task 7 · Entrada desde la ficha y catálogo

- [ ] `cobertura-ficha-form.tsx`: botón «Cuestionario por voz — N de M respondidas».
- [ ] `preguntas-manager.tsx` + pestaña en Configuración (`configuracion-tabs.tsx`, `page.tsx` y `nav.ts` — los submódulos están en los tres sitios).

## Task 8 · Cierre

- [ ] `equipos_cobertura` ya está en `TABLAS_NUCLEO`; agregar `cobertura_preguntas`.
- [ ] `npm run preflight` en verde.
- [ ] Commit. Consultar antes de subir y desplegar.
