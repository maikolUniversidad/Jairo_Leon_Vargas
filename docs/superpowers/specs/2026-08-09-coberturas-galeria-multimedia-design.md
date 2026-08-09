# Galería multimedia de coberturas (levantamientos) — Diseño

Fecha: 2026-08-09
Módulo: Comunicaciones → Coberturas
Estado: aprobado por el usuario

## Problema

La ficha de una cobertura muestra tres columnas (Contenido Crudo / Editado / Aprobado)
con una lista plana de nombres de archivo y un ícono genérico. El equipo no puede ver
qué hay dentro sin abrir cada enlace en Drive, no puede mover una pieza de una fase a
otra desde la aplicación, y la subida es secuencial y bloquea la interfaz entera.

Tres causas concretas:

1. `cobertura_files.url` guarda el `webViewLink` de Drive, que es una página HTML.
   No se puede poner en un `<img>` ni en un `<video>`.
2. `addCoberturaFile` descarga el archivo entero a la memoria de la función de Vercel
   para reenviarlo a Drive. Un video de levantamiento agota los 300 s y la memoria.
3. No existe ninguna acción que cambie la fase de un archivo ya subido.

## Alcance

Entra: preview en vivo, subida masiva, arrastre entre fases, ficha editable, versiones
y reemplazo.

No entra: el estudio de edición de medios (recorte de imagen, corte de video, unir
clips, texto sobre video). Es un producto aparte y tendrá su propio spec.

Permisos: sin cambios. Cualquiera con acceso al módulo Comunicaciones sube, mueve a
cualquier fase y borra. Las políticas RLS existentes de `can_manage_comunicaciones()`
ya lo cubren.

## Arquitectura

### Preview: dos rutas según el peso

Miniaturas por proxy propio. `GET /api/drive/thumb/[fileId]?w=<ancho>` verifica la
sesión, pide `thumbnailLink` a la API de Drive con el token del servidor, descarga esos
bytes y los re-emite con `Cache-Control: private, max-age=86400`. Drive genera
miniatura para imagen, video (un fotograma), PDF, Office y PSD. Cada una pesa decenas
de kilobytes, así que el ancho de banda es despreciable, y funciona aunque el permiso
público del archivo no se haya aplicado.

Reproducción por iframe de Drive. El visor monta
`https://drive.google.com/file/d/{id}/preview`. Google hace el streaming con rangos:
un video de 2 GB arranca al instante y no pasa un byte por el servidor propio. Vale
igual para PDF, audio y documentos de Office.

Archivos que quedaron en Supabase Storage (caso de Drive desconectado): `<img>` y
`<video>` nativos contra la URL pública que ya se guarda.

Cuando Drive todavía no ha generado la miniatura de un archivo recién subido, el proxy
responde 404 y la tarjeta muestra el ícono del tipo de medio, reintentando una vez
pasados unos segundos.

### Subida: reanudable y directa a Drive

Sustituye al doble salto actual (navegador → Supabase Storage → servidor → Drive).

1. `startCoberturaUpload` abre una sesión reanudable en
   `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable` con la
   metadata del archivo y devuelve al navegador la URL de sesión.
2. El navegador sube en trozos de 8 MB con `XMLHttpRequest` (necesario para el evento
   de progreso, que `fetch` no expone), enviando `Content-Range` en cada trozo y
   tratando el 308 como «sigue». Si se corta la conexión, reanuda preguntando por el
   rango ya recibido.
3. `finishCoberturaUpload` aplica el permiso de lectura por enlace, inserta la fila en
   `cobertura_files` y registra la actividad.

La URL de sesión no lleva el token de acceso: autoriza por sí misma, así que el
navegador nunca ve credenciales.

Sobre esto va una cola con concurrencia 3: progreso por archivo, cancelar, reintentar
los fallidos, y el resto de la interfaz operativa mientras tanto. Acepta selección
múltiple, carpetas completas vía `webkitdirectory` y arrastre desde el escritorio a
cualquier columna.

Si Drive no está conectado, o si la subida directa falla por CORS, cae al camino
existente por Supabase Storage sin que el usuario tenga que hacer nada.

### Arrastre

Drag & drop nativo de HTML5, el mismo patrón que ya usa `task-board.tsx`; no se añaden
dependencias. La zona de drop de cada columna distingue por `dataTransfer.types` si lo
que cae es una tarjeta interna (`text/plain` con el id) o archivos del sistema
operativo (`Files`).

Mover una tarjeta a otra columna llama a `moveCoberturaFile`, que actualiza la fase en
la base de datos y mueve el archivo en Drive con `files.update` usando `addParents` y
`removeParents`. La carpeta «Contenido Aprobado» refleja siempre lo que se ve en
pantalla. La interfaz se actualiza de inmediato y revierte si el servidor falla.

Dentro de una misma columna se puede reordenar; el orden se guarda en la columna
`orden`.

### Ficha, versiones y derivación

Al abrir una tarjeta, un diálogo muestra el preview grande junto a la ficha editable:
nombre (renombra también en Drive), descripción, etiquetas y destacado.

Dos operaciones distintas sobre el contenido:

- Reemplazar: sube un archivo encima del mismo elemento con una sesión reanudable de
  actualización sobre el `fileId` existente. Conserva id, enlace y posición; Drive
  guarda la versión anterior en su historial de revisiones. Incrementa `version`.
- Enviar a otra fase: crea un elemento nuevo en la fase destino con `origen_file_id`
  apuntando al original, de modo que se ve de qué material crudo salió cada pieza.

## Datos

Migración `0031_cobertura_files_meta.sql` sobre `public.cobertura_files`:

| columna | tipo | propósito |
|---|---|---|
| `descripcion` | `text` | nota libre de la pieza |
| `tags` | `text[] not null default '{}'` | etiquetas para filtrar |
| `destacado` | `boolean not null default false` | marcar material clave |
| `orden` | `int not null default 0` | orden manual dentro de la columna |
| `origen_file_id` | `uuid references cobertura_files(id) on delete set null` | pieza de la que deriva |
| `version` | `int not null default 1` | número de reemplazos |
| `updated_at` | `timestamptz not null default now()` | con trigger `set_updated_at` |

Todas las columnas tienen valor por defecto, así que las filas existentes siguen
siendo válidas. Se añade un índice por `(cobertura_id, fase, orden, created_at desc)`.

## Componentes

`cobertura-detail.tsx` concentra hoy toda la vista. Con lo que se añade crecería
demasiado, así que se reparte en piezas con una responsabilidad cada una:

| archivo | responsabilidad |
|---|---|
| `cobertura-detail.tsx` | cabecera de la cobertura y estado; monta el tablero |
| `cobertura-board.tsx` | las tres columnas, el arrastre y el estado local de archivos |
| `cobertura-file-card.tsx` | una tarjeta: miniatura, tipo, tamaño, menú |
| `cobertura-file-dialog.tsx` | visor grande + ficha editable + reemplazo/derivación |
| `cobertura-upload-queue.tsx` | panel flotante con el progreso de la cola |
| `hooks/use-upload-queue.ts` | lógica de la cola: concurrencia, progreso, reintento |
| `lib/media-kind.ts` | mime → tipo de medio e ícono |
| `lib/upload-cobertura.ts` | cliente de subida reanudable por trozos |

Las acciones de servidor nuevas van a `actions/coberturas.ts`; las llamadas a la API de
Drive (mover, renombrar, miniatura, sesión reanudable, borrar) a `lib/google-drive.ts`.

## Errores

- Drive sin conectar: la subida usa Supabase Storage y el preview usa la URL pública.
  El aviso de conectar Drive ya existe en la cabecera.
- Miniatura no disponible todavía: ícono por tipo y un reintento diferido.
- Fallo al mover entre fases: la tarjeta vuelve a su columna y aparece el motivo.
- Subida interrumpida: reanuda desde el último trozo confirmado; si el usuario cancela,
  se aborta la sesión y no queda fila en la base de datos.
- Archivo borrado en Drive por fuera de la aplicación: la miniatura responde 404 y la
  tarjeta lo marca como no disponible sin romper la vista.

## Riesgo conocido

La subida directa depende de que Google acepte CORS en la URL de sesión reanudable.
Se verifica en el primer paso de la implementación. Si fallara, el fallback es enviar
los trozos a través de un route handler propio, o el camino actual por Supabase.
