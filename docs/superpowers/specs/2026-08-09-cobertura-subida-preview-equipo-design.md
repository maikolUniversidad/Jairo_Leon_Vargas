# Subida masiva de coberturas: revisión previa, equipo y tipo de contenido

**Fecha:** 2026-08-09
**Estado:** diseño aprobado, pendiente de plan de implementación
**Alcance:** módulo Coberturas (Producción). No toca otros módulos.

---

## El problema

Hoy, al soltar archivos en el tablero de una cobertura, `cobertura-board.tsx` llama
directo a `cola.encolar()` y la subida arranca. Eso significa que:

- No se ve qué se está subiendo hasta que ya subió.
- Un levantamiento de 200 archivos entra sin ninguna atribución: no queda registro
  de qué equipo lo grabó ni con qué.
- No hay forma de descartar lo que sobra antes de gastar los datos móviles de
  alguien que está en campo.
- El tipo de archivo solo existe en tiempo de render (`mediaKind()`); no se puede
  filtrar el tablero por "solo videos" ni corregir una clasificación errada.

## Qué se construye

Una **pantalla de revisión en lote** entre soltar los archivos y subirlos. Muestra
miniatura real de cada archivo, deja asignar el equipo responsable, detecta el
dispositivo con que se grabó y clasifica el tipo de contenido —corregible a mano—
antes de que salga un solo byte.

## Qué NO se construye aquí

El cuestionario por voz para llenar la ficha del evento. Es una función aparte,
más grande, con su propio spec. Las decisiones ya tomadas sobre ella están en
`2026-08-09-cobertura-cuestionario-voz-decisiones.md`.

---

## 1. Modelo de datos

Todo va en **una sola migración**, con el siguiente número libre (hoy `0034`, tras
`0033_cobertura_ficha.sql`). `tests/contract/migraciones.test.ts` falla si se
repite un número ya usado.

### Tabla nueva: `equipos_cobertura`

Catálogo de equipos humanos, administrable desde Configuración.

```sql
create table if not exists public.equipos_cobertura (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  tipo       text not null default 'mixto'
             check (tipo in ('grabacion','fotos','mixto')),
  activo     boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipos_cobertura_nombre_no_vacio check (length(btrim(nombre)) > 0)
);

create unique index if not exists idx_equipos_cobertura_nombre
  on public.equipos_cobertura (lower(btrim(nombre)));
```

RLS en la misma migración —lectura para `is_staff()`, escritura para
`can_manage_comunicaciones()`, el mismo gate que ya gobierna el módulo— más el
trigger `set_updated_at`. El índice único sobre `lower(btrim(nombre))` es lo que
evita que aparezcan "Equipo A", "equipo a" y "EquipoA" como tres equipos.

### Columnas nuevas en `cobertura_files`

```sql
alter table public.cobertura_files
  add column if not exists equipo_id      uuid references public.equipos_cobertura(id) on delete set null,
  add column if not exists dispositivo    text,
  add column if not exists tipo_contenido text not null default 'otro'
             check (tipo_contenido in ('foto','video','audio','documento','otro'));

create index if not exists idx_cobertura_files_equipo
  on public.cobertura_files (cobertura_id, equipo_id);
create index if not exists idx_cobertura_files_tipo
  on public.cobertura_files (cobertura_id, tipo_contenido);
```

`on delete set null` en `equipo_id`: borrar un equipo del catálogo no puede borrar
el material que grabó. Las filas existentes quedan en `tipo_contenido = 'otro'`; se
reclasifican en la misma migración con un `update` derivado del `mime`.

### Por qué `tipo_contenido` se guarda y no se deriva

`mediaKind()` sabe deducirlo del mime y la extensión. Pero la corrección manual es
un requisito, y un valor derivado al vuelo no tiene dónde guardar la corrección: se
perdería en cada render. El valor derivado es el **default**; la columna es la
**verdad**. Además permite filtrar e indexar el tablero por tipo, que derivando en
el cliente no se puede.

### Las cinco etiquetas

`foto` · `video` · `audio` · `documento` · `otro`

`audio` es etiqueta propia y no parte de "otro" porque en una cobertura llega audio
real —entrevistas, cuñas, ambientes— y porque el cuestionario por voz va a guardar
sus grabaciones como archivos de la cobertura. Meterlas junto a un `.zip` haría que
la etiqueta dejara de servir para filtrar.

---

## 2. Clasificación de tipo

`mediaKind()` ya devuelve seis valores. Se agrega a `src/lib/media-kind.ts` una
función que los mapea a las cinco etiquetas:

| `mediaKind()` | `tipoContenido()` |
|---|---|
| `imagen` | `foto` |
| `video` | `video` |
| `audio` | `audio` |
| `pdf`, `documento` | `documento` |
| `archivo` | `otro` |

Función pura, sin dependencias, con pruebas unitarias que cubren el mapeo completo.

---

## 3. Detección del dispositivo

Se hace **en el navegador, antes de subir**, sobre el `File` que ya está en memoria.
Cero coste de servidor y cero latencia añadida a la subida.

**Fotos** — `exifr@7.1.3`, build **`lite`**, importado como
`exifr/dist/lite.esm.mjs`. Los dos valores se combinan en una cadena legible:
`"Sony ILCE-7M3"`, `"Apple iPhone 15 Pro"`.

> Verificado contra un JPEG sintético con APP1/EXIF real, no supuesto. El primer
> borrador de este spec decía `mini`: **es incorrecto**, `mini` devuelve `{}` para
> `Make`/`Model`. Y la opción `pick` **solo existe en `full`**; en `lite` lanza
> `undefined is not iterable`, así que se llama sin opciones.
>
> | build | ¿lee Make/Model? | ¿acepta `pick`? | tamaño ESM |
> |---|---|---|---|
> | `mini` | ❌ devuelve `{}` | ❌ lanza | 28.3 KB |
> | **`lite`** | ✅ | ❌ lanza | **44.4 KB** |
> | `full` | ✅ | ✅ | 73.7 KB |
>
> `lite` es el más pequeño que sirve: ahorra 29 KB frente a `full` y evita los
> parsers de ICC, IPTC y XMP, que aquí no se usan.

**Video** — parser propio en `src/lib/exif.ts`. MP4 y MOV guardan el modelo en los
átomos `©mak` / `©mod` dentro de `moov/udta`. Se recorre el árbol de átomos sobre
un `slice` de los primeros 2 MB del archivo, sin cargarlo entero.

> **Esto es best-effort, no una garantía.** Cubre iPhone, Sony y GoPro, que es el
> grueso del material de campo. Hay cámaras que sencillamente no escriben el dato.
> Cuando no se detecta, el campo queda vacío y se llena a mano. La detección nunca
> bloquea ni retrasa la subida: si el parser falla o tarda, se sigue sin dispositivo.

Ambos caminos son funciones puras sobre un `ArrayBuffer`, testeables con buffers
de muestra construidos a mano.

---

## 4. La pantalla de revisión

### Flujo

```
Soltar / elegir archivos
        ↓
  Diálogo de revisión  ←── se generan miniaturas y se detecta dispositivo en paralelo
        ↓
  Asignar equipo (todos o por selección) · corregir tipo · descartar
        ↓
  "Subir N archivos"  ←── deshabilitado mientras falte equipo
        ↓
  Cola de subida (la que ya existe, sin cambios en su lógica de concurrencia)
```

### Composición

```
┌─ Revisar 47 archivos ──────────────────────────────────┐
│ Equipo: [Equipo A ▾]  Fase: [Crudo ▾]   ☑ Todos (47)   │
│ ⚠ 12 archivos sin equipo                               │
├────────────────────────────────────────────────────────┤
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐            │
│ │ [img]  │ │ [▶1er  │ │  📄    │ │ [img]  │            │
│ │        │ │ frame] │ │        │ │        │            │
│ │ 📷 Foto│ │🎬 Video│ │📄 Docum│ │ 📷 Foto│            │
│ │ A7 III │ │iPhone15│ │   —    │ │ A7 III │            │
│ └────────┘ └────────┘ └────────┘ └────────┘            │
├────────────────────────────────────────────────────────┤
│                    [Cancelar]  [Subir 47 archivos]     │
└────────────────────────────────────────────────────────┘
```

- **Miniatura**: imagen vía `URL.createObjectURL`; video pintando el primer
  fotograma en un `<canvas>`; resto por ícono según el tipo.
- **Chip de tipo**: editable, con el valor derivado preseleccionado.
- **Dispositivo**: el detectado, o `—` si no se pudo.
- **Selección múltiple**: checkbox por tarjeta y "seleccionar todo", para asignar
  equipo en lote o descartar de un golpe.
- **Botón de subir**: deshabilitado mientras haya archivos sin equipo, mostrando
  cuántos faltan. El equipo es obligatorio por decisión de producto.

### Rendimiento

Las miniaturas de video son caras: cada una monta un `<video>`, busca un fotograma
y lo pinta. Se generan con un límite de concurrencia (3, igual que la cola de
subida) y bajo demanda al entrar la tarjeta en el viewport. Todos los `objectURL`
se revocan al cerrar el diálogo; con 200 archivos, no hacerlo tumba la pestaña.

---

## 5. Componentes y responsabilidades

| Archivo | Qué hace | De qué depende |
|---|---|---|
| `src/lib/exif.ts` | Dispositivo desde imagen (exifr) y video (parser de átomos) | `exifr`. Sin React |
| `src/lib/thumbnails.ts` | Miniatura local con límite de concurrencia y revocación | API del navegador |
| `src/lib/media-kind.ts` | *(existente)* + `tipoContenido()` | ninguna |
| `src/components/dashboard/cobertura-preview-dialog.tsx` | La pantalla: estado del lote, selección, validación | los dos de arriba |
| `src/components/dashboard/cobertura-preview-card.tsx` | Una tarjeta: miniatura, chips, checkbox | — |
| `src/actions/equipos.ts` | CRUD del catálogo, solo admin/comunicaciones | Supabase |
| `src/components/dashboard/equipos-manager.tsx` | Administración en Configuración | `equipos.ts` |

Cada uno tiene un propósito y se puede entender sin leer los otros. `exif.ts` y
`thumbnails.ts` no saben que existe React; el diálogo no sabe cómo se lee un EXIF.

### Cambios en lo que ya existe

- **`use-upload-queue.ts`** — `encolar()` pasa de recibir `File[]` + `fase` a recibir
  items ya enriquecidos: `{ file, fase, equipoId, tipoContenido, dispositivo }`.
  `ItemSubida` carga esos campos. La lógica de concurrencia, cancelación y
  reintento no se toca.
- **`upload-cobertura.ts`** — `subirArchivoCobertura()` acepta la metadata y la
  propaga a `addCoberturaFile` / `finishCoberturaUpload`.
- **`coberturas.ts`** — las tres acciones de subida aceptan `equipo_id`,
  `tipo_contenido` y `dispositivo`.
- **`cobertura-board.tsx`** — soltar archivos abre el diálogo en vez de encolar.
- **`cobertura-file-card.tsx`** — muestra el chip de tipo y el equipo.

### Validación en el servidor

Las acciones **revalidan** que `equipo_id` exista y esté activo, y que
`tipo_contenido` sea uno de los cinco valores. Lo que manda el cliente no se cree:
la pantalla de revisión es comodidad de la interfaz, no un control de seguridad.

---

## 6. Errores y casos borde

| Situación | Comportamiento |
|---|---|
| EXIF ilegible o corrupto | Dispositivo vacío. Nunca bloquea |
| Codec de video que el navegador no puede decodificar | Miniatura por ícono |
| Archivo muy grande | El video se lee por `slice`; nunca se carga entero en memoria |
| Carpeta soltada (llega como entrada de 0 bytes) | Se descarta al armar el lote, como hoy |
| Se borra un equipo que ya tiene material | `on delete set null`: el material se conserva, queda sin equipo |
| Dos equipos con el mismo nombre | Lo impide el índice único sobre `lower(btrim(nombre))` |
| Catálogo de equipos vacío | El diálogo avisa y enlaza a Configuración; no se puede subir |

---

## 7. Pruebas

Se apoya en el sistema de QA ya montado (`docs/qa/README.md`).

**Unitarias** (`tests/unit/`)
- `tipoContenido()`: el mapeo completo de los seis valores de `mediaKind()`.
- `exif.ts`: extracción de `Make`/`Model` y del átomo `©mod`, contra buffers de
  muestra construidos a mano. Incluye buffer corrupto → devuelve `null` sin lanzar.
- Validación del lote: no se puede confirmar con archivos sin equipo.

**Contrato** (`tests/contract/`)
- `migraciones.test.ts` ya exige por su cuenta que `equipos_cobertura` traiga RLS.

**QA de base de datos**
- `equipos_cobertura` entra al inventario de `scripts/qa-contract.mjs`.
- La comprobación de referencias huérfanas cubre las FK nuevas sin tocar nada.

---

## 8. Decisiones tomadas

| Decisión | Elegido | Por qué |
|---|---|---|
| Qué es "equipo" | Humano **y** dispositivo | El humano se elige, el dispositivo se detecta. Responden preguntas distintas: a quién acreditar y con qué se grabó |
| Etiqueta de tipo | Automática y corregible | La derivación falla con material sin mime; sin corrección quedaría mal clasificado para siempre |
| Momento | Antes de subir, en lote | Con 200 archivos nadie vuelve a etiquetar después. Y deja descartar antes de gastar datos |
| Catálogo de equipos | Tabla propia en Configuración | Un área no es un equipo de grabación; el texto libre se fragmenta |
| Equipo obligatorio | Sí | Un clic por lote, no por archivo. Sin eso el dato no sirve para reportes |
| Parser de video | Sí, best-effort | ~60 líneas, cubre iPhone/Sony/GoPro. Se puede borrar sin tocar nada más |
| `audio` como etiqueta | Sí | Material real de cobertura, y el cuestionario por voz va a guardar audio en el tablero |
