# Galería y contenido unificado — Diseño

**Fecha:** 2026-07-09
**Proyecto:** UTL 360 (Jairo León Vargas — Landing/Plataforma)
**Estado:** Aprobado para planificación
**Reemplaza a:** `2026-07-09-modulo-galeria-fotos-design.md` (enfoque de álbumes por evento + módulo top-level). Ese diseño queda **obsoleto**; este lo supersede.

## Objetivo

Una **página pública única** `/galeria` que muestre todo el contenido de la campaña
—fotos, videos y publicaciones de redes— **segmentado por etiquetas** para filtrar.
Todo el contenido se **gestiona desde una pestaña nueva "Galería y contenido" en
Configuración** (admin), con dos vías de carga: manual (subir fotos / pegar enlaces de
video o redes) y **auto-sincronización desde las cuentas propias** de redes vía API.

## Decisiones tomadas (del brainstorming)

1. **Segmentación:** cada ítem tiene un **tipo** (`foto` | `video` | `red`) y
   **etiquetas de texto libres** (`tags[]`). Los chips de filtro de la landing se
   arman solos con las etiquetas usadas por ítems públicos.
2. **Videos:** solo por **embed de URL** (YouTube/Vimeo). No se hospedan archivos de
   video propios (YAGNI/costo).
3. **Contenido de redes:** **auto-sync por API**, reutilizando la infraestructura de
   conexiones existente. **Por fases** (ver más abajo).
4. **Página:** una sola `/galeria` con filtros + **franja de "destacados" en el inicio**.
5. **Gestión:** pestaña nueva en Configuración (admin-only, patrón `/misredes`), no un
   módulo top-level del dashboard.
6. **Modelo:** una tabla unificada `content_items` (no álbumes; no JSON en misredes).
7. **Al despublicar:** se conserva la fila y los archivos; solo `publico=false`.

## Realismo del auto-sync (por qué fases)

La plataforma ya tiene:
- **Conexiones/secretos** ([src/lib/connections.ts](../../../src/lib/connections.ts)):
  tokens de `youtube`, `instagram`, `tiktok`, `facebook`, `x` guardados en `app_secrets`
  y gestionados en Configuración → Integraciones. `getCredential(provider, field)` los
  entrega.
- **Colectores** ([src/lib/monitoring/collectors.ts](../../../src/lib/monitoring/collectors.ts)):
  ya consultan YouTube Data API y X API por *palabra clave* (menciones).

Pero la galería necesita el **contenido propio** de las cuentas, que difiere por plataforma:

- **YouTube** (Fase 1): fiable con API key + **ID de canal** → `channels.list`
  (`contentDetails.relatedPlaylists.uploads`) → `playlistItems.list`. Sin OAuth ni
  aprobación.
- **Instagram** (Fase 2): requiere **cuenta profesional/Business** vinculada a una
  página de Facebook + token de larga duración → Graph API `/{ig-user-id}/media`.
- **TikTok / Facebook** (Fase 2): requieren aprobación de la app del desarrollador en
  cada plataforma. La plomería (token guardado) existe; el conector se activa cuando el
  token esté disponible y probado.

**Fase 1 (entrega inmediata):** modelo + `/galeria` + gestión con carga manual (subir
fotos, pegar URLs de video/redes con miniatura por oEmbed) + **sync de YouTube**.
**Fase 2:** conectores de Instagram/TikTok/Facebook, cada uno *gated* por su token; el
botón de sync del proveedor aparece deshabilitado con nota si no está configurado.

## Modelo de datos (nueva migración Supabase)

`supabase/migrations/00XX_galeria_contenido.sql` (siguiente número disponible).

### Tabla `content_items`
- `id` uuid pk default `gen_random_uuid()`
- `tipo` text not null check in (`'foto'`,`'video'`,`'red'`)
- `fuente` text not null check in (`'upload'`,`'enlace'`,`'youtube'`,`'instagram'`,`'tiktok'`,`'facebook'`,`'x'`)
- `titulo` text null
- `descripcion` text null
- `media_url` text null — URL pública del bucket (fotos) o miniatura principal
- `storage_path` text null — ruta en el bucket si es foto subida
- `embed_url` text null — URL canónica del video/post (para embeds y auto-sync)
- `thumbnail_url` text null — miniatura de video/post
- `external_id` text null — id del video/post en la plataforma (dedupe del sync)
- `tags` text[] not null default `'{}'`
- `fecha` timestamptz null — fecha original de publicación (para orden por defecto)
- `orden` int not null default 0 — orden manual (menor primero)
- `destacado` boolean not null default false — aparece en la franja del inicio
- `publico` boolean not null default false — visible en la landing
- `created_by` uuid null
- `created_at` timestamptz not null default now()
- `deleted_at` timestamptz null — borrado lógico
- **Índice único parcial** `(fuente, external_id) where external_id is not null` — evita
  reimportar el mismo post/video en cada sync.
- Índices de apoyo: `(publico, deleted_at)`, GIN en `tags`.

### Reglas de visibilidad pública
La landing muestra ítems con `publico=true` y `deleted_at is null`. Orden:
`orden asc, coalesce(fecha, created_at) desc`.

### RLS
- **Gestión interna:** la pestaña vive en Configuración, que ya exige
  `requireRole(["super_admin","administrador"])`. Las server actions verifican admin
  (patrón de `misredes.ts`). Escritura solo vía service role / admins.
- **Lectura pública (anónima):** política `select` para `anon`/`public` restringida a
  `publico = true AND deleted_at is null`. (Alternativa equivalente: la landing lee vía
  cliente admin filtrando por `publico`; se seguirá el patrón que ya use la landing para
  contenido público — a confirmar en el plan.)

## Almacenamiento de fotos

- Fotos subidas → **bucket público** (reutilizar el bucket público de contenido del
  proyecto; el nombre exacto se fija en el plan tras verificar los buckets existentes,
  p. ej. `contenido/galeria/<id>.<ext>`). Se guarda `storage_path` + `media_url`.
- Videos y posts de redes → **no** se descargan; se guarda `embed_url` + `thumbnail_url`
  (+ `external_id`). El player se incrusta en el cliente.

## Detección de plataforma + oEmbed (carga manual de enlaces)

Helper `src/lib/gallery/embeds.ts`:
- `detectPlatform(url)` → `youtube` | `vimeo` | `instagram` | `tiktok` | `facebook` | `enlace`.
- `resolveEmbed(url)` → `{ tipo, fuente, external_id, embed_url, thumbnail_url, titulo }`.
  - YouTube: extrae `videoId`; miniatura `https://img.youtube.com/vi/<id>/hqdefault.jpg`.
  - Otros: intenta oEmbed público (`https://www.youtube.com/oembed`, `https://vimeo.com/api/oembed.json`,
    IG/TikTok/FB vía sus endpoints oEmbed cuando estén disponibles) con timeout; si falla,
    guarda el enlace con miniatura vacía y el admin puede subir una manualmente.

## Conectores de auto-sync

`src/lib/gallery/sync.ts` — reutiliza `getCredential` / `getConnectionsStatus`.
Cada conector devuelve `CollectedContent[]` (misma forma que se inserta en `content_items`):

- **`syncYouTube(channelId)`** (Fase 1): uploads del canal → mapea a `tipo:'video'`,
  `fuente:'youtube'`, `external_id`=videoId, `embed_url`, `thumbnail_url`, `fecha`.
- **`syncInstagram(igUserId)`** (Fase 2): `/{ig-user-id}/media` → `tipo:'red'|'foto'|'video'`
  según `media_type`, `fuente:'instagram'`.
- **`syncTikTok()` / `syncFacebook()`** (Fase 2): análogos, *gated* por token.

Identificadores de cuenta propia (channel ID de YouTube, IG user id, etc.) se guardan en
una clave de `settings` `galeria_sync` (editable desde el panel de sync). El sync inserta
ítems **no públicos** (`publico=false`) por defecto, deduplicando por `(fuente, external_id)`;
el admin los revisa, etiqueta y publica.

Opcional (no en alcance inicial): un cron en `src/app/api/cron/` que corra el sync
periódicamente (ya existe infraestructura de cron en el proyecto).

## Server actions — `src/actions/galeria.ts`

Patrón de `documentos.ts` / `misredes.ts` (verifican admin, `revalidatePath`):
- `listContent(filters?)` — para el panel de gestión (incluye no públicos).
- `addPhotos(files[], meta)` — sube al bucket, crea filas `tipo:'foto'`.
- `addEmbed(url, meta)` — usa `resolveEmbed`, crea fila `video`/`red`.
- `updateItem(id, patch)` — título, descripción, tags, tipo, orden, destacado.
- `togglePublic(id, publico)`, `toggleDestacado(id, destacado)`.
- `deleteItem(id)` — borrado lógico (opción de borrar archivo del bucket).
- `reorder(orderedIds[])`.
- `syncProvider(provider)` — corre el conector; importa borradores; devuelve resumen
  (`ok:N nuevos`). Gated por estado de conexión.
- `getSyncConfig()` / `saveSyncConfig(patch)` — ids de cuenta para el sync.

## UI del dashboard (Configuración → "Galería y contenido")

- Registrar la pestaña en
  [src/app/dashboard/configuracion/page.tsx](../../../src/app/dashboard/configuracion/page.tsx):
  `TabsTrigger value="galeria"` + `TabsContent` con `<GaleriaManager>`, y añadir
  `"galeria"` a la lista de tabs válidas. Cargar datos con `listContent()` en el server
  component.
- **`src/components/dashboard/galeria-manager.tsx`** (cliente):
  - Barra superior: **Agregar** (subir fotos | pegar enlace) · **Sincronizar de redes**
    (menú por proveedor con su estado) · búsqueda/filtro por tipo y tag.
  - Grilla de tarjetas: miniatura, tipo, insignias `Público`/`Destacado`, tags; editar
    inline (título, descripción, tags como chips, tipo, orden), toggles, eliminar.
  - Panel de configuración de sync (ids de cuenta) plegable.

## Landing pública

- **`src/app/(public)/galeria/page.tsx`** (server component): lee ítems públicos y pasa a
  un cliente **`galeria-grid.tsx`**:
  - Chips de filtro: tipo (Todos/Fotos/Videos/Redes) + etiquetas (derivadas de las tags
    de los ítems públicos). Filtro combinable (tipo AND tags seleccionadas).
  - Grilla masonry responsiva. Foto → lightbox con título/descripción. Video →
    reproductor (iframe YouTube/Vimeo, lazy). Red → tarjeta con miniatura que enlaza al
    post original (o embed oficial si está disponible).
- **Franja "destacados" en el inicio**
  ([src/app/(public)/page.tsx](../../../src/app/(public)/page.tsx)): últimos ítems
  `destacado=true && publico=true` + botón "Ver galería" → `/galeria`.
- **Navegación:** enlace "Galería" en
  [src/components/landing/site-header.tsx](../../../src/components/landing/site-header.tsx)
  (y opcionalmente en el footer).

## Validaciones (Zod, en `src/lib/validations.ts`)

- `contentMetaSchema`: `titulo?`, `descripcion?`, `tags: string[]` (trim, sin vacíos,
  únicas, límite razonable), `tipo`, `orden?`, `destacado?`.
- `embedInputSchema`: `url` (URL válida) + meta.
- `syncConfigSchema`: `youtubeChannelId?`, `instagramUserId?`, etc.

## Manejo de errores

- Subir foto sin bucket disponible / fallo de storage: se avisa y no se crea la fila.
- `resolveEmbed` sin oEmbed: se guarda el enlace con miniatura vacía + aviso "añade
  miniatura manual".
- `syncProvider` sin token o token inválido: acción devuelve "Conecta <proveedor> en
  Integraciones"; el botón del proveedor aparece deshabilitado con nota.
- Dedupe: reimportaciones no crean duplicados (índice único parcial).

## Verificación (manual)

1. Configuración → "Galería y contenido": subir 2–3 fotos con tags → aparecen como
   borradores no públicos.
2. Pegar un enlace de YouTube → se crea ítem `video` con miniatura.
3. Marcar 3 ítems como `Público` y 1 como `Destacado`.
4. `/galeria`: se ven los públicos; los chips de tipo y de etiqueta filtran bien.
5. Inicio: la franja de destacados muestra el ítem destacado y "Ver galería" navega.
6. Con `YOUTUBE_API_KEY` + channel id: "Sincronizar de redes → YouTube" importa videos
   nuevos como borradores; correrlo de nuevo no duplica.
7. Despublicar un ítem → desaparece de la landing; la fila/archivo se conservan.

## Fuera de alcance (YAGNI)

- Hosting de archivos de video propios (solo embeds).
- Likes/comentarios/compartir en la galería pública.
- Reordenamiento drag-and-drop avanzado (basta el campo `orden`).
- Edición de imágenes (recorte/filtros) dentro del módulo.
- Cron automático de sync en la primera entrega (queda como mejora posterior).
