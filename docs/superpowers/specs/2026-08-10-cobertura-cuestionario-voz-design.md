# Cuestionario por voz para la ficha de cobertura

**Fecha:** 2026-08-10
**Estado:** diseño aprobado, en implementación
**Sustituye a:** `2026-08-09-cobertura-cuestionario-voz-decisiones.md` (aquel era el registro de decisiones; este es el spec)

---

## El problema

La ficha ampliada (`0033_cobertura_ficha.sql`) tiene nueve campos de texto:
`objetivo`, `resumen`, `mensajes_clave`, `temas[]`, `resultados`, `compromisos`,
`aliados`, `publico_estimado`, `hashtags[]`.

Nadie los llena escribiendo después de un día de calle. Hablando, sí.

## Qué se construye

Un cuestionario que se responde grabando audio. Las preguntas se recorren en
carrusel —adelante, atrás y con scroll—, mostrando cuáles ya se respondieron. Al
terminar, la IA extrae la información a los campos de la ficha y se revisa lado a
lado antes de guardar.

**Se entra desde la ficha (editar).** No es obligatorio al subir: si nadie lo
respondió en el momento, se retoma después. El avance se guarda, así que se puede
salir y volver.

## Lo que ya existe y se reutiliza

Media función está construida:

- **[`/api/ia/transcribe`](../../../src/app/api/ia/transcribe/route.ts)** — graba
  con `MediaRecorder`, manda a Whisper con `language: "es"`, valida sesión y
  devuelve el texto. Ya está en producción para el Asistente IA.
- **[`ChatComposer.tsx`](../../../src/components/dashboard/ia/ChatComposer.tsx)** —
  el patrón de captura (`getUserMedia` → `MediaRecorder` → `FormData`) del que se
  copia el hook de grabación.
- **[`lib/ia/provider.ts`](../../../src/lib/ia/provider.ts)** — `completeWithTools`
  para la extracción estructurada.
- **`cobertura-ficha-form.tsx`** — el formulario destino.

No hay que elegir proveedor de transcripción ni montar infraestructura de audio.

---

## 1. Modelo de datos

Una migración, el siguiente número libre (hoy `0036`, tras `0035`).

### `cobertura_preguntas` — el catálogo

```sql
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
  updated_at timestamptz not null default now()
);
```

Una pregunta por campo de la ficha, editables en Configuración. El `check` de
`campo` es lo que garantiza que cada respuesta sepa exactamente qué llena; se
eligió esto sobre preguntas generadas por IA para poder comparar eventos entre sí.

Se siembran las nueve por defecto en la misma migración.

### `cobertura_respuestas` — lo respondido

```sql
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
```

El `unique` hace que volver a grabar una pregunta reemplace su respuesta en vez de
acumular. Es lo que sostiene el «ya respondí esta» del carrusel entre sesiones.

RLS en las dos, en la misma migración: lectura `is_staff()`, escritura
`can_manage_comunicaciones()`, más el trigger `set_updated_at`.

### Dónde vive el audio, y por qué no en el tablero

En `cobertura_respuestas.audio_path`, en el bucket `coberturas` bajo
`{cobertura_id}/respuestas/`. **No entra al tablero como `cobertura_file`.**

Esto corrige una decisión anterior. El audio de una respuesta es una nota de voz
*sobre* el evento, no material *del* evento: no lo grabó ningún equipo de
grabación. Meterlo al tablero obligaría a inventarle una atribución —o a permitir
archivos sin equipo, abriendo la puerta a que el material de campo también entre
sin ella— y mezclaría dos cosas distintas en la misma vista.

Se escucha desde el carrusel, al lado de su pregunta, que es donde tiene sentido.

---

## 2. El carrusel

Se abre desde un botón en la ficha que muestra el avance:
**«Cuestionario por voz — 4 de 9 respondidas»**.

```
┌─ Cuestionario · pregunta 4 de 9 ───────────────────────┐
│  ●━━●━━●━━◉━━○━━○━━○━━○━━○     ← respondidas / actual  │
├────────────────────────────────────────────────────────┤
│  ¿Qué compromisos quedaron?                            │
│  Acuerdos concretos, con quién y para cuándo.          │
│                                                        │
│         ◉ Grabar          ▸ Escuchar                   │
│                                                        │
│  «Quedamos en que la Secretaría de Salud manda…»       │
│  (editable)                                            │
├────────────────────────────────────────────────────────┤
│  ‹ Anterior            Siguiente ›      [Terminar]     │
└────────────────────────────────────────────────────────┘
```

- **Navegación**: botones anterior/siguiente, teclas ← →, y la fila de puntos es
  clicable para saltar a cualquier pregunta. La lista también hace scroll.
- **Estado por pregunta**: respondida, actual, pendiente.
- **La transcripción es editable**: Whisper se equivoca con nombres propios y con
  ruido de calle. Corregir ahí es más barato que corregir la ficha después.
- **Se guarda al avanzar**, no al terminar: si se cae la conexión o cierran la
  pestaña, no se pierde lo grabado.
- **Terminar** está siempre disponible: se puede extraer con tres respuestas y
  volver luego por las otras seis.

## 3. La extracción y la revisión

Al terminar, se manda a `completeWithTools` el conjunto de transcripciones con la
pregunta y el campo destino de cada una, y devuelve los nueve campos.

Después, la pantalla de revisión:

```
Objetivo
  Actual    │ Convocar a los líderes de Kennedy…      │ ○ Conservar
  Propuesto │ Reunir a los líderes comunales de…      │ ◉ Usar este
```

Campo por campo, con **lo que ya había y lo propuesto lado a lado**. Los campos
sin valor previo vienen con lo propuesto preseleccionado; los que ya tenían texto
vienen con **lo actual** preseleccionado, para que sobrescribir sea siempre un
acto deliberado. Nada entra a la base sin que alguien lo mire.

`publico_estimado` es número y `temas`/`hashtags` son arreglos: se muestran como
lista de fichas, no como texto plano.

---

## 4. Archivos

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/0036_cobertura_cuestionario.sql` | Las dos tablas, RLS, semilla de preguntas |
| `src/lib/audio-recorder.ts` | Hook de grabación: permiso, `MediaRecorder`, blob. Sin saber de coberturas |
| `src/lib/ia/extraer-ficha.ts` | Transcripciones → campos de la ficha. Pura respecto a React |
| `src/actions/cuestionario.ts` | Listar preguntas, guardar respuesta, subir audio, extraer |
| `src/actions/preguntas.ts` | CRUD del catálogo (Configuración) |
| `src/components/dashboard/cobertura-cuestionario.tsx` | El carrusel |
| `src/components/dashboard/cobertura-extraccion-review.tsx` | La revisión lado a lado |
| `src/components/dashboard/preguntas-manager.tsx` | Catálogo en Configuración |
| `src/components/dashboard/cobertura-ficha-form.tsx` | Botón de entrada con el avance |

`audio-recorder.ts` y `extraer-ficha.ts` no saben que existen las coberturas: se
prueban solos.

## 5. Errores y casos borde

| Situación | Comportamiento |
|---|---|
| Niegan el permiso de micrófono | Aviso claro y campo de texto para escribir la respuesta a mano. El cuestionario no se bloquea |
| Navegador sin `MediaRecorder` | Igual: se responde escribiendo |
| Whisper falla o tarda | Se conserva el audio grabado y se ofrece reintentar la transcripción sin volver a grabar |
| Sin `OPENAI_API_KEY` | El botón de grabar no aparece; el cuestionario funciona escrito |
| Cierran a mitad | Lo respondido está guardado; al volver, el carrusel abre en la primera pendiente |
| Cobertura sin preguntas activas | Aviso con enlace a Configuración |
| Vuelven a grabar una ya respondida | Reemplaza (el `unique` lo garantiza), avisando que va a sustituir |
| La IA no encuentra nada para un campo | Ese campo no se propone; no se inventa contenido |

## 6. Pruebas

- `extraer-ficha.ts`: mapeo de transcripciones a campos, con respuestas vacías,
  respuestas que no aportan nada, y `publico_estimado` que llega como texto.
- Estado del carrusel: cuál es la primera pendiente, avance, no salirse de rango.
- La revisión: preselección correcta según haya o no valor previo.
- Contrato: el `check` de `campo` en la migración contra los campos reales de la
  ficha, para que no se desincronicen.

## 7. Decisiones tomadas

| Decisión | Elegido | Por qué |
|---|---|---|
| Origen de las preguntas | Una por campo, configurable | Cada respuesta sabe qué llena; permite comparar eventos |
| Dónde se entra | Desde la ficha (editar) | Si no se hizo al subir, se retoma después |
| Conflicto con lo escrito | Propone y se elige campo por campo | Nada se pierde sin que alguien lo vea |
| Almacenamiento | Tabla propia por pregunta | Permite ver qué falta, retomar y auditar |
| Audio de respuesta | En la respuesta, fuera del tablero | No es material de cobertura y no tiene equipo que lo grabó |
| Transcripción | Whisper, vía la ruta que ya existe | Ya está en producción; cero infraestructura nueva |
