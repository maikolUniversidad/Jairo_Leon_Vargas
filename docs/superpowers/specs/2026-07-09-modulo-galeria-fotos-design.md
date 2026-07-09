# Módulo Galería de fotos — Diseño

**Fecha:** 2026-07-09
**Proyecto:** UTL 360 (Jairo León Vargas — Landing/Plataforma)
**Estado:** Aprobado para planificación

## Objetivo

Un módulo del dashboard para gestionar fotos organizadas en **álbumes por evento**
(cada álbum = una carpeta en Google Drive) y decidir, con un interruptor **Público**,
cuáles fotos y álbumes se muestran en la landing pública (página `/galeria` + bloque
en el inicio).

## Decisiones tomadas

1. **Origen de las fotos:** ambas vías —subir desde la plataforma (Fase 1) y leer una
   carpeta que se llena manualmente en Drive (Fase 2). Se construyen **ambas fases, en orden**.
2. **Presentación pública:** página propia `/galeria` **y** un bloque en el inicio.
3. **Datos por foto:** título + descripción.
4. **Organización:** álbumes por evento (cada álbum es una carpeta en Drive y una
   sección en la landing).
5. **Permisos:** módulo configurable en la matriz de Roles y permisos (default:
   Comunicaciones + admins).
6. **Ubicación en el menú:** de las dos formas — módulo top-level "Galería" **y**
   además enlace como submódulo dentro de Comunicaciones (ambos apuntan a
   `/dashboard/galeria`).
7. **Al despublicar:** se conserva la copia en el bucket público; solo se apaga el
   flag `publico=false` (republicar es instantáneo).

## Restricción técnica central (Drive scope)

La integración actual usa el scope `drive.file`
([src/lib/google-drive.ts](../../../src/lib/google-drive.ts) líneas 9–12), que solo
permite ver archivos que la app creó/subió. Por eso:

- **Fase 1 (subir desde la plataforma):** funciona con `drive.file` sin verificación
  de Google. Los originales se suben a Drive vía `uploadBufferToFolder`.
- **Fase 2 (leer carpeta llenada a mano):** requiere ampliar el scope a
  `drive.readonly` (scope "restringido" de Google). Para un uso interno de una sola
  cuenta se opera la app en modo *Testing* / no verificada: al conectar aparece una
  pantalla de advertencia ("app no verificada → Configuración avanzada → Continuar"),
  válida para el propietario de la cuenta. Se documenta el cambio de scope y se activa
  el botón de sincronización solo cuando el scope esté disponible.

## Arquitectura de almacenamiento

Se separan origen y publicación para lograr rapidez y confiabilidad:

- **Drive = archivo/biblioteca (origen).** Nueva carpeta en el árbol de Drive:
  **`08 Galería`**, con una subcarpeta por álbum. Se agrega la entrada
  `{ key: "galeria", name: "08 Galería" }` a `DRIVE_TREE` en
  [src/lib/drive-shared.ts](../../../src/lib/drive-shared.ts).
- **Bucket público `contenido` = lo que ve la web.** Al marcar una foto como Pública,
  la app copia una versión al bucket en `galeria/<album-slug>/<photo-id>.<ext>`, guarda
  `public_url` y `storage_path`, y pone `publico=true`. La landing sirve desde el CDN
  de Supabase (Drive no sirve bien para incrustar `<img>`).

```
Subir fotos (panel) ──► Drive / UTL 360 / 08 Galería / <Álbum> / *.jpg   (original, privado)
                              │
             toggle Público ON│──► copia a bucket contenido/galeria/...  ──► Landing /galeria
             toggle Público OFF│──► se conserva la copia; solo publico=false (deja de verse)
```

## Modelo de datos (nueva migración Supabase)

`supabase/migrations/00XX_galeria.sql` (numeración siguiente disponible).

### Tabla `gallery_albums`
- `id` uuid pk
- `nombre` text not null
- `descripcion` text null
- `slug` text unique (para rutas/paths)
- `drive_folder_id` text null (carpeta del álbum en Drive)
- `portada_photo_id` uuid null (referencia a la foto de portada)
- `orden` int default 0
- `publico` boolean default false
- `created_by` uuid
- `created_at` timestamptz default now()
- `deleted_at` timestamptz null (borrado lógico, como documentos)

### Tabla `gallery_photos`
- `id` uuid pk
- `album_id` uuid fk → gallery_albums
- `titulo` text null
- `descripcion` text null
- `drive_file_id` text null (original en Drive)
- `storage_path` text null (ruta en el bucket contenido, si está publicada)
- `public_url` text null (URL pública del bucket)
- `orden` int default 0
- `publico` boolean default false
- `mime` text null
- `created_by` uuid
- `created_at` timestamptz default now()
- `deleted_at` timestamptz null

### Reglas de visibilidad pública
La landing muestra los álbumes con `publico=true` y, dentro de cada uno, solo las
fotos con `publico=true` y `deleted_at is null`.

### RLS
- Lectura/gestión interna: según `role_permissions` para el módulo `galeria`
  (patrón igual a los módulos existentes).
- Lectura pública (anónima): solo filas con `publico=true` (política `select` a
  `public`/`anon`), o bien la landing lee vía cliente admin filtrando por `publico`
  (seguir el patrón que ya use la landing para publicaciones públicas).

### Seed de permisos
Insertar filas en `role_permissions` para `module='galeria'` para todos los roles del
catálogo, con `can_view=true` para `super_admin, administrador, direccion_general,
coordinador_utl, comunicaciones` (resto según matriz; admins con CRUD completo).

## Registro del módulo

- [src/types/roles.ts](../../../src/types/roles.ts): añadir `"galeria"` al tipo
  `DashboardModule`, a `MODULE_ACCESS` (default `["super_admin","administrador",
  "direccion_general","coordinador_utl","comunicaciones"]`), a `MODULE_LABELS`
  (`"Galería"`) — con lo que entra automáticamente en `ALL_MODULES` y en la matriz.
- [src/components/dashboard/nav.ts](../../../src/components/dashboard/nav.ts):
  - Entrada top-level `{ href: "/dashboard/galeria", label: "Galería", icon: Images,
    module: "galeria" }`.
  - Además, un submódulo dentro de Comunicaciones apuntando a `/dashboard/galeria`
    (mismo destino) para descubrimiento.

## Server actions — `src/actions/galeria.ts`

Siguiendo el patrón de [src/actions/documentos.ts](../../../src/actions/documentos.ts):

- `createAlbum(input)` — crea fila + carpeta en Drive (`08 Galería`/nombre) best-effort.
- `updateAlbum(id, input)` — edita nombre/descripción/orden.
- `deleteAlbum(id)` — borrado lógico (bloquea si tiene fotos activas, o borra en cascada lógica).
- `toggleAlbumPublic(id, publico)`.
- `setAlbumCover(albumId, photoId)`.
- `uploadPhotos(albumId, files[])` — sube originales a la carpeta Drive del álbum vía
  `uploadBufferToFolder`; crea filas `gallery_photos`. Requiere Drive conectado (si no,
  error "Conecta Google Drive").
- `updatePhoto(id, input)` — título/descripción/orden.
- `deletePhoto(id)` — borrado lógico; opción de eliminar copia del bucket.
- `togglePhotoPublic(id, publico)` — al publicar: descarga original de Drive → sube a
  bucket `contenido` en `galeria/<slug>/<id>.<ext>` → guarda `storage_path`/`public_url`
  → `publico=true`. Al despublicar: solo `publico=false` (se conserva la copia).
- `reorderPhotos(albumId, orderedIds[])`.
- **Fase 2:** `syncAlbumFromDrive(albumId)` — lista imágenes de la carpeta Drive del
  álbum (`drive.files.list`) e importa las nuevas como `gallery_photos` (no públicas
  hasta activarlas). Gated: solo disponible con scope `drive.readonly`.

Se añade a [src/lib/google-drive.ts](../../../src/lib/google-drive.ts) una función
`listImagesInFolder(folderId)` para la Fase 2 y, si hace falta, `getGaleriaRootId()`
análoga a `getDocumentosRootId()`.

## UI del dashboard

- **`/dashboard/galeria`** (page + componente cliente `galeria-albums.tsx`): grilla de
  álbumes (portada, nº de fotos, insignia Público), botón "Nuevo álbum".
- **Detalle de álbum** (`/dashboard/galeria/[id]` o panel dentro de la misma vista):
  grilla de fotos con subir, editar título/descripción, toggle Público por foto,
  elegir portada, reordenar, eliminar; y toggle Público del álbum.

## Landing pública

- **`/galeria`** (nueva ruta en `src/app/(public)/galeria/page.tsx`, server component):
  una sección por álbum público con grilla de fotos y visor ampliado (lightbox) que
  muestra título + descripción. Lee de Supabase filtrando por `publico=true`.
- **Bloque en el inicio** ([src/app/(public)/page.tsx](../../../src/app/(public)/page.tsx)):
  franja "Galería" con las últimas fotos públicas y botón "Ver galería" → `/galeria`.
- **Navegación:** añadir enlace "Galería" en
  [src/components/landing/site-header.tsx](../../../src/components/landing/site-header.tsx).
- Imágenes servidas desde el bucket `contenido` (CDN de Supabase).

## Manejo de errores

- Subir sin Drive conectado: bloquear con aviso "Conecta Google Drive (Configuración →
  Integraciones)", igual que Documentos.
- Copia al bucket best-effort: si falla al publicar, la foto no queda pública y se avisa.
- Fase 2 sin scope `drive.readonly`: el botón "Sincronizar desde Drive" aparece
  deshabilitado con nota explicativa.

## Validaciones (Zod, en `src/lib/validations.ts`)

- `albumSchema`: nombre (req), descripción (opcional), orden.
- `photoMetaSchema`: título (opcional), descripción (opcional), orden.

## Verificación (manual)

1. Crear un álbum → se crea su carpeta en Drive.
2. Subir 2–3 fotos → aparecen en el detalle del álbum y en la carpeta de Drive.
3. Marcar una foto como Pública y el álbum como Público.
4. Confirmar que la foto aparece en `/galeria` y en el bloque del inicio.
5. Desmarcar Público → la foto desaparece de la landing pero se conserva la copia.
6. (Fase 2) Con scope ampliado: subir una foto a mano a la carpeta del álbum en Drive,
   pulsar "Sincronizar desde Drive" y verla importada como no pública.

## Fuera de alcance (YAGNI)

- Edición de imágenes (recorte, filtros) dentro del módulo.
- Reordenamiento drag-and-drop avanzado (basta con controles de orden simples al inicio).
- Comentarios o "me gusta" en la galería pública.
