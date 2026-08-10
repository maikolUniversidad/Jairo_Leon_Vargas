# Subida de coberturas con revisión previa — Plan de implementación

> **Para quien ejecute:** los pasos usan casillas (`- [ ]`) para ir marcando.
> Spec de referencia: `docs/superpowers/specs/2026-08-09-cobertura-subida-preview-equipo-design.md`

**Meta:** insertar una pantalla de revisión en lote entre soltar archivos y subirlos, con miniatura real, equipo responsable obligatorio, dispositivo detectado y tipo de contenido corregible.

**Arquitectura:** la lógica pura (clasificación, EXIF, límite de concurrencia) vive en `src/lib/` sin saber que existe React y se prueba con Vitest. El diálogo consume esos módulos y entrega a la cola de subida items ya enriquecidos; la cola conserva intacta su lógica de concurrencia, cancelación y reintento. El servidor revalida todo lo que manda el cliente.

**Stack:** Next 15 (App Router, server actions), Supabase (Postgres + RLS + Storage), Google Drive resumable upload, Vitest, `exifr@7.1.3` build `lite`.

---

## Estructura de archivos

| Archivo | Responsabilidad | Estado |
|---|---|---|
| `supabase/migrations/0034_cobertura_equipos.sql` | Tabla `equipos_cobertura`, columnas nuevas, RLS, backfill | crear |
| `src/lib/media-kind.ts` | `mediaKind()` *(existe)* + `tipoContenido()` | modificar |
| `src/lib/exif.ts` | Dispositivo desde imagen (exifr) y video (parser de átomos) | crear |
| `src/lib/thumbnails.ts` | Miniatura local + límite de concurrencia | crear |
| `src/actions/equipos.ts` | CRUD del catálogo | crear |
| `src/actions/coberturas.ts` | Aceptar y revalidar la metadata nueva | modificar |
| `src/lib/upload-cobertura.ts` | Propagar la metadata | modificar |
| `src/hooks/use-upload-queue.ts` | Encolar items enriquecidos | modificar |
| `src/components/dashboard/cobertura-preview-card.tsx` | Una tarjeta del lote | crear |
| `src/components/dashboard/cobertura-preview-dialog.tsx` | La pantalla de revisión | crear |
| `src/components/dashboard/cobertura-board.tsx` | Abrir el diálogo en vez de encolar | modificar |
| `src/components/dashboard/cobertura-file-card.tsx` | Mostrar chip de tipo y equipo | modificar |
| `src/components/dashboard/equipos-manager.tsx` | Administración en Configuración | crear |
| `tests/helpers/media-fixtures.ts` | Constructores de JPEG/MP4 sintéticos | crear |
| `tests/unit/tipo-contenido.test.ts` | Mapeo de tipos | crear |
| `tests/unit/exif.test.ts` | Parsers de dispositivo | crear |
| `tests/unit/concurrencia.test.ts` | Límite de concurrencia | crear |
| `scripts/qa-contract.mjs` | Declarar `equipos_cobertura` | modificar |

**Orden:** 1→3 son lógica pura y no dependen de nada. 4→9 son datos y servidor. 10→14 interfaz. 15 cierra.

---

## Task 1: Migración de esquema

**Archivos:** Crear `supabase/migrations/0034_cobertura_equipos.sql`

- [ ] **Paso 1: Escribir la migración**

```sql
-- ============================================================================
-- UTL 360 · 0034_cobertura_equipos.sql
-- Catálogo de equipos de grabación/fotos y atribución del material de una
-- cobertura: qué equipo lo produjo, con qué dispositivo y de qué tipo es.
-- Ejecuta DESPUÉS de 0033. Idempotente.
-- ============================================================================

-- ─────────────── Catálogo de equipos ───────────────
create table if not exists public.equipos_cobertura (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  tipo       text not null default 'mixto' check (tipo in ('grabacion','fotos','mixto')),
  activo     boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipos_cobertura_nombre_no_vacio check (length(btrim(nombre)) > 0)
);

-- Impide que "Equipo A", "equipo a" y "EquipoA" convivan como tres equipos.
create unique index if not exists idx_equipos_cobertura_nombre
  on public.equipos_cobertura (lower(btrim(nombre)));

alter table public.equipos_cobertura enable row level security;
alter table public.equipos_cobertura force row level security;

drop policy if exists equipos_cobertura_read on public.equipos_cobertura;
create policy equipos_cobertura_read on public.equipos_cobertura
  for select to authenticated using (public.is_staff());

drop policy if exists equipos_cobertura_write on public.equipos_cobertura;
create policy equipos_cobertura_write on public.equipos_cobertura
  for all to authenticated
  using (public.can_manage_comunicaciones())
  with check (public.can_manage_comunicaciones());

drop trigger if exists trg_equipos_cobertura_updated on public.equipos_cobertura;
create trigger trg_equipos_cobertura_updated before update on public.equipos_cobertura
  for each row execute function public.set_updated_at();

-- ─────────────── Atribución del material ───────────────
-- `on delete set null` en equipo_id: borrar un equipo del catálogo no puede
-- llevarse por delante el material que grabó.
alter table public.cobertura_files
  add column if not exists equipo_id      uuid references public.equipos_cobertura(id) on delete set null,
  add column if not exists dispositivo    text,
  add column if not exists tipo_contenido text not null default 'otro';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cobertura_files_tipo_contenido_check'
  ) then
    alter table public.cobertura_files
      add constraint cobertura_files_tipo_contenido_check
      check (tipo_contenido in ('foto','video','audio','documento','otro'));
  end if;
end $$;

create index if not exists idx_cobertura_files_equipo
  on public.cobertura_files (cobertura_id, equipo_id);
create index if not exists idx_cobertura_files_tipo
  on public.cobertura_files (cobertura_id, tipo_contenido);

-- ─────────────── Reclasificar lo que ya existe ───────────────
-- Las filas anteriores entraron con el default 'otro'; se derivan del mime.
update public.cobertura_files set tipo_contenido = case
  when mime like 'image/%'      then 'foto'
  when mime like 'video/%'      then 'video'
  when mime like 'audio/%'      then 'audio'
  when mime = 'application/pdf' then 'documento'
  when mime like 'text/%'       then 'documento'
  when mime like '%word%' or mime like '%sheet%' or mime like '%presentation%' then 'documento'
  else 'otro'
end
where tipo_contenido = 'otro';
```

- [ ] **Paso 2: Aplicar contra la base**

```bash
node --env-file=.env.local scripts/db-exec.mjs supabase/migrations/0034_cobertura_equipos.sql
```
Esperado: `✓ Todas las migraciones se aplicaron correctamente.`

- [ ] **Paso 3: Verificar RLS y el check**

```bash
npm run qa:db -- --quiet
```
Esperado: `equipos_cobertura` no aparece en «RLS habilitada» ni en «tablas sin políticas».

---

## Task 2: `tipoContenido()`

**Archivos:** Modificar `src/lib/media-kind.ts` · Crear `tests/unit/tipo-contenido.test.ts`

- [ ] **Paso 1: Escribir la prueba que falla**

```ts
import { describe, expect, it } from "vitest";
import { TIPOS_CONTENIDO, tipoContenido, type TipoContenido } from "@/lib/media-kind";

describe("tipoContenido", () => {
  it("mapea los seis valores de mediaKind a las cinco etiquetas", () => {
    expect(tipoContenido("imagen")).toBe("foto");
    expect(tipoContenido("video")).toBe("video");
    expect(tipoContenido("audio")).toBe("audio");
    expect(tipoContenido("pdf")).toBe("documento");
    expect(tipoContenido("documento")).toBe("documento");
    expect(tipoContenido("archivo")).toBe("otro");
  });

  it("TIPOS_CONTENIDO coincide con el check de la migración 0034", () => {
    expect([...TIPOS_CONTENIDO].sort()).toEqual(
      ["audio", "documento", "foto", "otro", "video"],
    );
  });

  it("todo valor devuelto está en TIPOS_CONTENIDO", () => {
    const kinds = ["imagen", "video", "audio", "pdf", "documento", "archivo"] as const;
    for (const k of kinds) {
      expect(TIPOS_CONTENIDO).toContain(tipoContenido(k) as TipoContenido);
    }
  });
});
```

- [ ] **Paso 2: Correr y ver que falla**

Run: `npx vitest run tests/unit/tipo-contenido.test.ts`
Esperado: FAIL, `tipoContenido is not exported`.

- [ ] **Paso 3: Implementar en `src/lib/media-kind.ts`**

```ts
/**
 * Etiqueta con la que se clasifica el material de una cobertura. Es un valor
 * guardado, no derivado: `mediaKind()` da el default, pero se puede corregir a
 * mano y esa corrección tiene que sobrevivir. Debe coincidir con el check de
 * `cobertura_files.tipo_contenido` (migración 0034).
 */
export const TIPOS_CONTENIDO = ["foto", "video", "audio", "documento", "otro"] as const;
export type TipoContenido = (typeof TIPOS_CONTENIDO)[number];

export const TIPO_CONTENIDO_LABEL: Record<TipoContenido, string> = {
  foto: "Foto",
  video: "Video",
  audio: "Audio",
  documento: "Documento",
  otro: "Otro",
};

const KIND_A_TIPO: Record<MediaKind, TipoContenido> = {
  imagen: "foto",
  video: "video",
  audio: "audio",
  pdf: "documento",
  documento: "documento",
  archivo: "otro",
};

/** Etiqueta por defecto para un archivo, a partir de su clasificación de medio. */
export function tipoContenido(kind: MediaKind): TipoContenido {
  return KIND_A_TIPO[kind];
}
```

- [ ] **Paso 4: Correr y ver que pasa**

Run: `npx vitest run tests/unit/tipo-contenido.test.ts`
Esperado: PASS, 3 pruebas.

---

## Task 3: Fixtures de medios sintéticos

**Archivos:** Crear `tests/helpers/media-fixtures.ts`

Se necesitan antes que Task 4: son las entradas con las que se prueba el parser sin meter binarios al repo.

- [ ] **Paso 1: Escribir los constructores**

```ts
/**
 * Constructores de archivos binarios mínimos pero válidos, para probar los
 * parsers de metadatos sin comprometer fotos ni videos reales al repositorio.
 */

/** JPEG con un segmento APP1/EXIF que lleva Make y Model en el IFD0. */
export function jpegConExif(make: string, model: string): Uint8Array {
  const enc = (s: string) => {
    const b = new TextEncoder().encode(s + "\0");
    return b;
  };
  const makeB = enc(make);
  const modelB = enc(model);

  const nEntradas = 2;
  const ifdSize = 2 + nEntradas * 12 + 4;
  const datosOffset = 8 + ifdSize;

  const tiff = new Uint8Array(8 + ifdSize + makeB.length + modelB.length);
  const v = new DataView(tiff.buffer);
  tiff[0] = 0x49; tiff[1] = 0x49;          // "II" little endian
  v.setUint16(2, 0x2a, true);
  v.setUint32(4, 8, true);                 // offset a IFD0
  v.setUint16(8, nEntradas, true);

  let p = 10;
  v.setUint16(p, 0x010f, true);            // Make
  v.setUint16(p + 2, 2, true);             // ASCII
  v.setUint32(p + 4, makeB.length, true);
  v.setUint32(p + 8, datosOffset, true);
  p += 12;
  v.setUint16(p, 0x0110, true);            // Model
  v.setUint16(p + 2, 2, true);
  v.setUint32(p + 4, modelB.length, true);
  v.setUint32(p + 8, datosOffset + makeB.length, true);
  p += 12;
  v.setUint32(p, 0, true);                 // no hay IFD1

  tiff.set(makeB, datosOffset);
  tiff.set(modelB, datosOffset + makeB.length);

  const exifHdr = new TextEncoder().encode("Exif\0\0");
  const payload = new Uint8Array(exifHdr.length + tiff.length);
  payload.set(exifHdr, 0);
  payload.set(tiff, exifHdr.length);

  const out = new Uint8Array(2 + 4 + payload.length + 2);
  const ov = new DataView(out.buffer);
  ov.setUint16(0, 0xffd8);                 // SOI
  ov.setUint16(2, 0xffe1);                 // APP1
  ov.setUint16(4, payload.length + 2);
  out.set(payload, 6);
  ov.setUint16(6 + payload.length, 0xffd9); // EOI
  return out;
}

/** Un átomo ISO-BMFF: [uint32 tamaño][4 chars tipo][payload]. */
function atomo(tipo: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + payload.length);
  new DataView(out.buffer).setUint32(0, out.length);
  out.set(new TextEncoder().encode(tipo).slice(0, 4), 4);
  out.set(payload, 8);
  return out;
}

function concat(...partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of partes) { out.set(p, off); off += p.length; }
  return out;
}

/**
 * MP4/MOV con `moov > udta > ©mak/©mod`, que es donde iPhone, Sony y GoPro
 * escriben la marca y el modelo. El payload de un átomo `©xxx` de udta es
 * [uint16 longitud][uint16 idioma][texto].
 */
export function mp4ConDispositivo(make: string | null, model: string | null): Uint8Array {
  const texto = (s: string) => {
    const b = new TextEncoder().encode(s);
    const out = new Uint8Array(4 + b.length);
    const v = new DataView(out.buffer);
    v.setUint16(0, b.length);
    v.setUint16(2, 0);
    out.set(b, 4);
    return out;
  };

  const hijos: Uint8Array[] = [];
  if (make) hijos.push(atomo("©mak", texto(make)));
  if (model) hijos.push(atomo("©mod", texto(model)));

  const udta = atomo("udta", concat(...hijos));
  const moov = atomo("moov", udta);
  const ftyp = atomo("ftyp", new TextEncoder().encode("isom\0\0\0"));
  return concat(ftyp, moov);
}

/** MP4 sin metadatos de dispositivo: cámaras que sencillamente no lo escriben. */
export function mp4SinDispositivo(): Uint8Array {
  return concat(
    atomo("ftyp", new TextEncoder().encode("isom\0\0\0")),
    atomo("moov", atomo("udta", new Uint8Array(0))),
  );
}
```

- [ ] **Paso 2: Comprobar que Vitest no los toma por pruebas**

Run: `npx vitest run`
Esperado: sigue reportando los 7 archivos de prueba de siempre; `tests/helpers/` no aparece (el `include` es `tests/**/*.test.ts`).

---

## Task 4: `src/lib/exif.ts`

**Archivos:** Crear `src/lib/exif.ts` · Crear `tests/unit/exif.test.ts`

- [ ] **Paso 1: Escribir la prueba que falla**

```ts
import { describe, expect, it } from "vitest";
import { dispositivoDeImagen, dispositivoDeVideo, unirMarcaModelo } from "@/lib/exif";
import { jpegConExif, mp4ConDispositivo, mp4SinDispositivo } from "../helpers/media-fixtures";

describe("unirMarcaModelo", () => {
  it("une marca y modelo sin repetir la marca", () => {
    expect(unirMarcaModelo("SONY", "ILCE-7M3")).toBe("SONY ILCE-7M3");
    expect(unirMarcaModelo("Apple", "iPhone 15 Pro")).toBe("Apple iPhone 15 Pro");
  });

  it("no duplica cuando el modelo ya trae la marca", () => {
    expect(unirMarcaModelo("Canon", "Canon EOS R5")).toBe("Canon EOS R5");
  });

  it("funciona con uno solo de los dos", () => {
    expect(unirMarcaModelo("SONY", null)).toBe("SONY");
    expect(unirMarcaModelo(null, "ILCE-7M3")).toBe("ILCE-7M3");
  });

  it("devuelve null cuando no hay nada útil", () => {
    expect(unirMarcaModelo(null, null)).toBeNull();
    expect(unirMarcaModelo("  ", "")).toBeNull();
  });
});

describe("dispositivoDeImagen", () => {
  it("lee Make y Model del EXIF", async () => {
    const buf = jpegConExif("SONY", "ILCE-7M3");
    await expect(dispositivoDeImagen(buf)).resolves.toBe("SONY ILCE-7M3");
  });

  it("devuelve null con un buffer que no es imagen, sin lanzar", async () => {
    await expect(dispositivoDeImagen(new Uint8Array([1, 2, 3, 4]))).resolves.toBeNull();
  });

  it("devuelve null con un JPEG sin EXIF", async () => {
    await expect(dispositivoDeImagen(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).resolves.toBeNull();
  });
});

describe("dispositivoDeVideo", () => {
  it("lee los átomos ©mak y ©mod de moov/udta", () => {
    expect(dispositivoDeVideo(mp4ConDispositivo("Apple", "iPhone 15 Pro"))).toBe("Apple iPhone 15 Pro");
  });

  it("funciona con solo el modelo", () => {
    expect(dispositivoDeVideo(mp4ConDispositivo(null, "HERO11 Black"))).toBe("HERO11 Black");
  });

  it("devuelve null cuando la cámara no escribió el dato", () => {
    expect(dispositivoDeVideo(mp4SinDispositivo())).toBeNull();
  });

  it("devuelve null con basura, sin lanzar ni colgarse", () => {
    expect(dispositivoDeVideo(new Uint8Array(64).fill(0xff))).toBeNull();
    expect(dispositivoDeVideo(new Uint8Array(0))).toBeNull();
  });
});
```

- [ ] **Paso 2: Correr y ver que falla**

Run: `npx vitest run tests/unit/exif.test.ts`
Esperado: FAIL, no existe `@/lib/exif`.

- [ ] **Paso 3: Implementar**

```ts
/**
 * Detección del dispositivo con que se capturó un archivo.
 *
 * Es best-effort a propósito: hay cámaras que no escriben el dato. Cuando no se
 * puede saber, se devuelve null y el campo se llena a mano. Nunca lanza y nunca
 * bloquea la subida.
 *
 * Sin dependencias de React: se puede probar con buffers sintéticos.
 */

/** Une marca y modelo evitando "Canon Canon EOS R5". */
export function unirMarcaModelo(make: string | null, model: string | null): string | null {
  const ma = (make ?? "").trim();
  const mo = (model ?? "").trim();
  if (!ma && !mo) return null;
  if (!ma) return mo;
  if (!mo) return ma;
  return mo.toLowerCase().startsWith(ma.toLowerCase()) ? mo : `${ma} ${mo}`;
}

/**
 * Marca y modelo del EXIF de una imagen.
 *
 * Usa el build `lite` de exifr: el `mini` NO devuelve Make/Model (verificado), y
 * el `full` pesa 29 KB más sin aportar nada aquí. Ojo: `lite` no soporta la
 * opción `pick` —lanza—, así que se llama sin opciones.
 */
export async function dispositivoDeImagen(datos: Uint8Array): Promise<string | null> {
  try {
    const mod = await import("exifr/dist/lite.esm.mjs");
    const exifr = (mod as { default?: unknown }).default ?? mod;
    const tags = (await (exifr as { parse: (d: Uint8Array) => Promise<Record<string, unknown>> })
      .parse(datos)) as { Make?: string; Model?: string } | null;
    if (!tags) return null;
    return unirMarcaModelo(tags.Make ?? null, tags.Model ?? null);
  } catch {
    return null;
  }
}

/* ───────────────────────── Video: átomos ISO-BMFF ───────────────────────── */

const CONTENEDORES = new Set(["moov", "udta", "meta", "ilst"]);
/** `meta` lleva 4 bytes de versión y banderas antes de sus hijos. */
const CON_CABECERA = new Set(["meta"]);
const PROFUNDIDAD_MAX = 6;

function tipoDeAtomo(v: DataView, off: number): string {
  return String.fromCharCode(
    v.getUint8(off), v.getUint8(off + 1), v.getUint8(off + 2), v.getUint8(off + 3),
  );
}

/**
 * Valor de un átomo `©xxx`. Admite las dos formas que se ven en la práctica:
 * un sub-átomo `data` (estilo iTunes/ilst) o [uint16 longitud][uint16 idioma][texto].
 */
function valorDeAtomo(v: DataView, ini: number, fin: number): string | null {
  if (fin - ini >= 16 && tipoDeAtomo(v, ini + 4) === "data") {
    return leerTexto(v, ini + 16, fin);
  }
  if (fin - ini >= 4) {
    const largo = v.getUint16(ini);
    const desde = ini + 4;
    return leerTexto(v, desde, Math.min(desde + largo, fin));
  }
  return null;
}

function leerTexto(v: DataView, ini: number, fin: number): string | null {
  if (fin <= ini) return null;
  const bytes = new Uint8Array(v.buffer, v.byteOffset + ini, fin - ini);
  const s = new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/\0+$/, "").trim();
  return s || null;
}

function recorrer(
  v: DataView, ini: number, fin: number, encontrado: Map<string, string>, profundidad: number,
): void {
  if (profundidad > PROFUNDIDAD_MAX) return;
  let p = ini;
  while (p + 8 <= fin) {
    let tam = v.getUint32(p);
    const tipo = tipoDeAtomo(v, p + 4);
    let datos = p + 8;

    if (tam === 1) {
      if (p + 16 > fin) return;
      // Tamaño de 64 bits. Nos basta la parte baja: no vamos a recorrer >4 GB.
      const alto = v.getUint32(p + 8);
      if (alto !== 0) return;
      tam = v.getUint32(p + 12);
      datos = p + 16;
    } else if (tam === 0) {
      tam = fin - p;
    }
    if (tam < 8 || p + tam > fin) return;

    const finAtomo = p + tam;
    if (CONTENEDORES.has(tipo)) {
      recorrer(v, CON_CABECERA.has(tipo) ? datos + 4 : datos, finAtomo, encontrado, profundidad + 1);
    } else if (tipo === "©mak" || tipo === "©mod") {
      const valor = valorDeAtomo(v, datos, finAtomo);
      if (valor && !encontrado.has(tipo)) encontrado.set(tipo, valor);
    }
    p = finAtomo;
  }
}

/**
 * Marca y modelo de un MP4/MOV. Cubre iPhone, Sony y GoPro, que escriben en
 * `moov/udta`. Otras cámaras no escriben nada: devuelve null y se llena a mano.
 */
export function dispositivoDeVideo(datos: Uint8Array): string | null {
  try {
    if (datos.byteLength < 8) return null;
    const v = new DataView(datos.buffer, datos.byteOffset, datos.byteLength);
    const encontrado = new Map<string, string>();
    recorrer(v, 0, datos.byteLength, encontrado, 0);
    return unirMarcaModelo(encontrado.get("©mak") ?? null, encontrado.get("©mod") ?? null);
  } catch {
    return null;
  }
}
```

- [ ] **Paso 4: Correr y ver que pasa**

Run: `npx vitest run tests/unit/exif.test.ts`
Esperado: PASS, 11 pruebas.

- [ ] **Paso 5: Envoltorio para `File`, al final del mismo archivo**

```ts
/** Cuántos bytes se leen de un video: los átomos de metadatos van al principio. */
const CABEZA_VIDEO = 2 * 1024 * 1024;

/**
 * Dispositivo de un archivo del navegador. Del video solo lee la cabeza, para no
 * cargar en memoria un archivo de 4 GB.
 */
export async function detectarDispositivo(file: File, kind: string): Promise<string | null> {
  try {
    if (kind === "imagen") {
      return await dispositivoDeImagen(new Uint8Array(await file.arrayBuffer()));
    }
    if (kind === "video") {
      const trozo = file.slice(0, Math.min(CABEZA_VIDEO, file.size));
      return dispositivoDeVideo(new Uint8Array(await trozo.arrayBuffer()));
    }
    return null;
  } catch {
    return null;
  }
}
```

---

## Task 5: Límite de concurrencia y miniaturas

**Archivos:** Crear `src/lib/thumbnails.ts` · Crear `tests/unit/concurrencia.test.ts`

La generación de miniaturas usa API del navegador y no se prueba en Node; lo que sí se prueba —porque es donde está el error posible— es el limitador.

- [ ] **Paso 1: Escribir la prueba que falla**

```ts
import { describe, expect, it } from "vitest";
import { conLimite } from "@/lib/thumbnails";

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("conLimite", () => {
  it("devuelve los resultados en el orden de entrada", async () => {
    const out = await conLimite([3, 1, 2], 2, async (n) => { await espera(n * 5); return n * 10; });
    expect(out).toEqual([30, 10, 20]);
  });

  it("nunca corre más de N a la vez", async () => {
    let vivos = 0;
    let pico = 0;
    await conLimite(Array.from({ length: 10 }, (_, i) => i), 3, async () => {
      vivos += 1;
      pico = Math.max(pico, vivos);
      await espera(5);
      vivos -= 1;
    });
    expect(pico).toBeLessThanOrEqual(3);
  });

  it("un fallo no tumba el lote: esa posición queda en null", async () => {
    const out = await conLimite([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error("truena");
      return n;
    });
    expect(out).toEqual([1, null, 3]);
  });

  it("con lista vacía no hace nada", async () => {
    expect(await conLimite([], 3, async () => 1)).toEqual([]);
  });
});
```

- [ ] **Paso 2: Correr y ver que falla**

Run: `npx vitest run tests/unit/concurrencia.test.ts`
Esperado: FAIL, no existe `@/lib/thumbnails`.

- [ ] **Paso 3: Implementar el limitador**

```ts
/**
 * Miniaturas locales para la pantalla de revisión, antes de subir nada.
 *
 * Las de video son caras: cada una monta un <video>, busca un fotograma y lo
 * pinta. Por eso van con límite de concurrencia, igual que la cola de subida.
 */

/**
 * Corre `fn` sobre cada elemento con un máximo de `limite` en vuelo.
 * Conserva el orden de entrada. Un fallo deja `null` en su posición en vez de
 * tumbar el lote entero: una miniatura que no sale no puede impedir una subida.
 */
export async function conLimite<T, R>(
  items: T[],
  limite: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<(R | null)[]> {
  const out: (R | null)[] = new Array(items.length).fill(null);
  let siguiente = 0;

  const obrero = async (): Promise<void> => {
    while (true) {
      const i = siguiente++;
      if (i >= items.length) return;
      try {
        out[i] = await fn(items[i]!, i);
      } catch {
        out[i] = null;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limite, items.length)) }, obrero),
  );
  return out;
}
```

- [ ] **Paso 4: Correr y ver que pasa**

Run: `npx vitest run tests/unit/concurrencia.test.ts`
Esperado: PASS, 4 pruebas.

- [ ] **Paso 5: Añadir la generación de miniaturas al mismo archivo**

```ts
/** Tres a la vez, como la cola de subida. */
export const MINIATURAS_CONCURRENTES = 3;
/** Segundo del que se saca el fotograma: el 0 suele ser negro. */
const SEGUNDO_FOTOGRAMA = 0.5;
const ANCHO_MINIATURA = 320;

/**
 * URL de objeto con la miniatura, o null si no se pudo. Quien llama es
 * responsable de revocar la URL: con 200 archivos, no hacerlo tumba la pestaña.
 */
export async function miniatura(file: File, kind: string): Promise<string | null> {
  if (kind === "imagen") return URL.createObjectURL(file);
  if (kind === "video") return miniaturaDeVideo(file);
  return null;
}

function miniaturaDeVideo(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let resuelto = false;

    const terminar = (out: string | null) => {
      if (resuelto) return;
      resuelto = true;
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
      resolve(out);
    };

    // Un codec que el navegador no sabe decodificar se queda colgado sin error.
    const reloj = setTimeout(() => terminar(null), 10_000);

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadeddata = () => {
      video.currentTime = Math.min(SEGUNDO_FOTOGRAMA, (video.duration || 1) / 2);
    };
    video.onseeked = () => {
      try {
        const escala = ANCHO_MINIATURA / (video.videoWidth || ANCHO_MINIATURA);
        const canvas = document.createElement("canvas");
        canvas.width = ANCHO_MINIATURA;
        canvas.height = Math.round((video.videoHeight || ANCHO_MINIATURA) * escala);
        const ctx = canvas.getContext("2d");
        if (!ctx) return terminar(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          clearTimeout(reloj);
          terminar(blob ? URL.createObjectURL(blob) : null);
        }, "image/jpeg", 0.7);
      } catch {
        clearTimeout(reloj);
        terminar(null);
      }
    };
    video.onerror = () => { clearTimeout(reloj); terminar(null); };
    video.src = url;
  });
}
```

---

## Task 6: Acciones del catálogo de equipos

**Archivos:** Crear `src/actions/equipos.ts`

- [ ] **Paso 1: Escribir el módulo**

Sigue el patrón de `src/actions/roles.ts`: `"use server"`, `getSessionUser()` para autorizar, `ActionResult` de `./types`, `revalidatePath` al final.

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { type ActionResult } from "./types";

export const TIPOS_EQUIPO = ["grabacion", "fotos", "mixto"] as const;
export type TipoEquipo = (typeof TIPOS_EQUIPO)[number];

export interface EquipoCobertura {
  id: string;
  nombre: string;
  tipo: TipoEquipo;
  activo: boolean;
}

const equipoSchema = z.object({
  nombre: z.string().trim().min(2, "Escribe el nombre del equipo").max(120),
  tipo: z.enum(TIPOS_EQUIPO).default("mixto"),
  activo: z.boolean().default(true),
});

/** Equipos activos, para los selectores. Cualquier staff puede leerlos. */
export async function listEquipos(soloActivos = true): Promise<EquipoCobertura[]> {
  const supabase = await createClient();
  let q = supabase.from("equipos_cobertura").select("id, nombre, tipo, activo").order("nombre");
  if (soloActivos) q = q.eq("activo", true);
  const { data } = await q;
  return (data as EquipoCobertura[]) ?? [];
}

async function puedeGestionar(): Promise<boolean> {
  const u = await getSessionUser();
  if (!u) return false;
  return u.isAdmin || u.roles.some((r) => ["direccion_general", "coordinador_utl", "comunicaciones"].includes(r));
}

export async function createEquipo(input: unknown): Promise<ActionResult> {
  if (!(await puedeGestionar())) return { ok: false, message: "No autorizado." };
  const v = equipoSchema.safeParse(input);
  if (!v.success) {
    return { ok: false, message: "Revisa los campos.", fieldErrors: aCampos(v.error) };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("equipos_cobertura").insert(v.data);
  if (error) {
    return error.code === "23505"
      ? { ok: false, message: "Ya existe un equipo con ese nombre.", fieldErrors: { nombre: "Ya existe un equipo con ese nombre." } }
      : { ok: false, message: "No se pudo crear el equipo." };
  }
  revalidatePath("/dashboard/configuracion");
  return { ok: true, message: "Equipo creado." };
}

export async function updateEquipo(id: string, input: unknown): Promise<ActionResult> { /* mismo patrón, .update().eq("id", id) */ }

/** No se borra: se desactiva. El material ya subido conserva su atribución. */
export async function toggleEquipo(id: string, activo: boolean): Promise<ActionResult> { /* .update({ activo }) */ }
```

> `aCampos()` convierte un `ZodError` en `Record<campo, mensaje>`. Si ya existe un
> helper así en `src/actions/`, se reutiliza; si no, se escribe en `./types`.
> El commit `153b3ce` cambió los formularios a errores por campo: hay que seguir eso.

- [ ] **Paso 2: Verificar tipos**

Run: `npm run typecheck`
Esperado: sin errores.

---

## Task 7: Metadata en las acciones de coberturas

**Archivos:** Modificar `src/actions/coberturas.ts`

- [ ] **Paso 1: Ampliar la interfaz `CoberturaFile`**

Agregar tras `version`:
```ts
  equipo_id: string | null;
  equipo_nombre: string | null;   // resuelto en el select con join
  dispositivo: string | null;
  tipo_contenido: TipoContenido;
```

- [ ] **Paso 2: Aceptar y revalidar la metadata**

`addCoberturaFile`, `startCoberturaUpload` y `finishCoberturaUpload` reciben tres campos más:
```ts
  equipo_id: string;
  tipo_contenido: TipoContenido;
  dispositivo?: string | null;
```

En las tres, antes de escribir:
```ts
  // Lo que manda el cliente no se cree: la pantalla de revisión es comodidad de
  // la interfaz, no un control de acceso.
  if (!TIPOS_CONTENIDO.includes(input.tipo_contenido)) {
    return { ok: false, message: "Tipo de contenido no válido." };
  }
  const { data: equipo } = await supabase
    .from("equipos_cobertura")
    .select("id")
    .eq("id", input.equipo_id)
    .eq("activo", true)
    .maybeSingle();
  if (!equipo) return { ok: false, message: "El equipo no existe o está inactivo." };
```

- [ ] **Paso 3: Incluir el equipo en las lecturas**

En el `select` que arma el tablero, cambiar a
`"..., equipo_id, dispositivo, tipo_contenido, equipos_cobertura(nombre)"`
y aplanar `equipo_nombre` al mapear.

- [ ] **Paso 4: Verificar tipos**

Run: `npm run typecheck`

---

## Task 8: Propagar la metadata en la subida

**Archivos:** Modificar `src/lib/upload-cobertura.ts`

- [ ] **Paso 1: Ampliar la firma**

```ts
export interface MetadataArchivo {
  equipoId: string;
  tipoContenido: TipoContenido;
  dispositivo: string | null;
}
```
`subirArchivoCobertura(coberturaId, fase, file, meta, opts)` — `meta` como cuarto parámetro obligatorio, `opts` pasa a quinto. Se propaga a `startCoberturaUpload`, `finishCoberturaUpload`, `addCoberturaFile` y a `subirPorStorage`.

- [ ] **Paso 2: Verificar tipos**

Run: `npm run typecheck`
Esperado: errores solo en `use-upload-queue.ts`, que se arregla en Task 9.

---

## Task 9: La cola recibe items enriquecidos

**Archivos:** Modificar `src/hooks/use-upload-queue.ts`

- [ ] **Paso 1: Ampliar `ItemSubida` y `encolar`**

```ts
export interface ItemSubida {
  id: string;
  nombre: string;
  fase: Fase;
  size: number;
  estado: EstadoSubida;
  progreso: number;
  message?: string;
  equipoId: string;
  tipoContenido: TipoContenido;
  dispositivo: string | null;
}

/** Lo que entrega la pantalla de revisión: el archivo ya viene clasificado. */
export interface ArchivoRevisado {
  file: File;
  fase: Fase;
  equipoId: string;
  tipoContenido: TipoContenido;
  dispositivo: string | null;
}

const encolar = useCallback((revisados: ArchivoRevisado[]) => { /* … */ }, []);
```

`ejecutar()` pasa `{ equipoId, tipoContenido, dispositivo }` a `subirArchivoCobertura`. **La lógica de concurrencia, cancelación y reintento no se toca.**

- [ ] **Paso 2: Verificar tipos**

Run: `npm run typecheck`
Esperado: errores solo en `cobertura-board.tsx`, que se arregla en Task 12.

---

## Task 10: Tarjeta del lote

**Archivos:** Crear `src/components/dashboard/cobertura-preview-card.tsx`

- [ ] **Paso 1: Escribir el componente**

Presentacional puro; todo el estado vive en el diálogo.

```ts
interface Props {
  nombre: string;
  size: number;
  kind: MediaKind;
  tipo: TipoContenido;
  dispositivo: string | null;
  miniaturaUrl: string | null;
  cargandoMiniatura: boolean;
  seleccionado: boolean;
  onSeleccionar: (v: boolean) => void;
  onCambiarTipo: (t: TipoContenido) => void;
  onQuitar: () => void;
}
```

Muestra: checkbox arriba a la izquierda; miniatura o ícono según `kind`; nombre truncado con `title`; `formatBytes(size)`; `<select>` con los cinco tipos; el dispositivo o `—`; botón de quitar.

- [ ] **Paso 2: Verificar tipos y lint**

Run: `npm run typecheck && npm run lint`

---

## Task 11: La pantalla de revisión

**Archivos:** Crear `src/components/dashboard/cobertura-preview-dialog.tsx`

- [ ] **Paso 1: Escribir el componente**

```ts
interface Props {
  abierto: boolean;
  archivos: File[];
  faseInicial: Fase;
  equipos: EquipoCobertura[];
  onCancelar: () => void;
  onConfirmar: (revisados: ArchivoRevisado[]) => void;
}
```

Estado interno: un arreglo de entradas `{ id, file, kind, tipo, dispositivo, equipoId, miniaturaUrl, cargando }`.

Al abrir, un `useEffect`:
1. Arma las entradas con `mediaKind()` y `tipoContenido()` — inmediato, la rejilla pinta ya.
2. Lanza `conLimite(entradas, MINIATURAS_CONCURRENTES, …)` para miniatura y `detectarDispositivo()`, parcheando cada entrada al llegar.
3. En el `return` del efecto, revoca **todas** las URL de objeto.

Barra superior: `<select>` de equipo que aplica a la selección (o a todos si no hay selección), `<select>` de fase, «seleccionar todo», y el aviso de cuántos van sin equipo.

Pie: `[Cancelar]` y `[Subir N archivos]`, este último `disabled` mientras `sinEquipo > 0`.

Si `equipos.length === 0`: en vez de la rejilla, un mensaje con enlace a `/dashboard/configuracion` y el botón de subir deshabilitado.

- [ ] **Paso 2: Verificar tipos y lint**

Run: `npm run typecheck && npm run lint`

---

## Task 12: Conectar el tablero

**Archivos:** Modificar `src/components/dashboard/cobertura-board.tsx`

- [ ] **Paso 1: Cambiar `soltarArchivos`**

De encolar directo a abrir el diálogo:
```ts
const [porRevisar, setPorRevisar] = useState<{ archivos: File[]; fase: Fase } | null>(null);

const soltarArchivos = (fase: Fase, lista: FileList) => {
  const archivos = Array.from(lista).filter((f) => f.size > 0);
  if (archivos.length === 0) {
    toast.error("No se reconoció ningún archivo. Para carpetas usa el botón «Subir carpeta».");
    return;
  }
  setPorRevisar({ archivos, fase });
};
```

Renderizar `<CoberturaPreviewDialog … onConfirmar={(revisados) => { cola.encolar(revisados); setPorRevisar(null); }} />`.

- [ ] **Paso 2: Cargar los equipos**

`listEquipos()` desde el server component que renderiza el tablero, pasado por prop. Evita un ida y vuelta al abrir el diálogo.

- [ ] **Paso 3: Verificar**

Run: `npm run typecheck && npm run lint && npm test`

---

## Task 13: Chip de tipo y equipo en la tarjeta del tablero

**Archivos:** Modificar `src/components/dashboard/cobertura-file-card.tsx`

- [ ] **Paso 1: Añadir el chip**

`<Badge>` con `TIPO_CONTENIDO_LABEL[file.tipo_contenido]`, y debajo `file.equipo_nombre` cuando exista.

- [ ] **Paso 2: Verificar**

Run: `npm run typecheck && npm run lint`

---

## Task 14: Administración del catálogo

**Archivos:** Crear `src/components/dashboard/equipos-manager.tsx` · Modificar `src/app/dashboard/configuracion/page.tsx`

- [ ] **Paso 1: Escribir el gestor**

Tabla con nombre, tipo y activo; formulario de alta; edición en línea; interruptor de activo. Sigue el patrón de `roles-manager.tsx`. Errores por campo, no toast genérico.

- [ ] **Paso 2: Montarlo como pestaña en Configuración**

- [ ] **Paso 3: Verificar**

Run: `npm run typecheck && npm run lint`

---

## Task 15: Cerrar con el QA

**Archivos:** Modificar `scripts/qa-contract.mjs`

- [ ] **Paso 1: Declarar la tabla**

Añadir `"equipos_cobertura"` a `TABLAS_NUCLEO`.

- [ ] **Paso 2: Preflight completo**

Run: `npm run preflight`
Esperado: 🟢 en las cinco etapas. El QA de base de datos debe seguir en 0 fallas, y la comprobación de referencias huérfanas ahora cubre `cobertura_files.equipo_id`.

- [ ] **Paso 3: Commit**

Consultar antes de commitear: en este proyecto los commits los pide el usuario.

---

## Notas de ejecución

**Lo que puede salir mal y ya está previsto**

- `exifr` importado con `await import()` dinámico dentro de un `try`: si el paquete falla al cargar en el navegador, se sigue sin dispositivo en vez de romper el diálogo.
- El parser de video corta en cuanto ve un tamaño de átomo inconsistente. Con basura devuelve `null`; nunca entra en bucle (la profundidad está topada en 6 y `p` siempre avanza `tam ≥ 8`).
- Las miniaturas de video llevan reloj de 10 s: un codec que el navegador no decodifica se queda colgado sin lanzar error.

**Lo que NO entra en este plan**

El cuestionario por voz. Sus decisiones están en `docs/superpowers/specs/2026-08-09-cobertura-cuestionario-voz-decisiones.md`.
