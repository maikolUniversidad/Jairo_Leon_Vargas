/**
 * Detección del dispositivo con que se capturó un archivo.
 *
 * Es best-effort a propósito: hay cámaras que no escriben el dato. Cuando no se
 * puede saber se devuelve null y el campo se llena a mano. Nunca lanza y nunca
 * bloquea la subida.
 *
 * Sin dependencias de React: se prueba con buffers sintéticos.
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

/* ────────────────────────────── Imágenes ────────────────────────────── */

/**
 * Marca y modelo del EXIF de una imagen.
 *
 * Usa el build `lite` de exifr. Verificado contra un JPEG con APP1/EXIF real:
 * el build `mini` devuelve `{}` para Make/Model, y la opción `pick` solo existe
 * en `full` (en `lite` lanza), así que se llama sin opciones.
 */
export async function dispositivoDeImagen(datos: Uint8Array): Promise<string | null> {
  if (datos.byteLength < 4) return null;
  try {
    const mod = await import("exifr/dist/lite.esm.mjs");
    const exifr = ((mod as { default?: unknown }).default ?? mod) as {
      parse: (d: Uint8Array) => Promise<Record<string, unknown> | null>;
    };
    const tags = await exifr.parse(datos);
    if (!tags) return null;
    const make = typeof tags.Make === "string" ? tags.Make : null;
    const model = typeof tags.Model === "string" ? tags.Model : null;
    return unirMarcaModelo(make, model);
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
    v.getUint8(off),
    v.getUint8(off + 1),
    v.getUint8(off + 2),
    v.getUint8(off + 3),
  );
}

function leerTexto(v: DataView, ini: number, fin: number): string | null {
  if (fin <= ini) return null;
  const bytes = new Uint8Array(v.buffer, v.byteOffset + ini, fin - ini);
  const s = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes)
    .replace(/\0+$/, "")
    .trim();
  return s || null;
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

/**
 * Recorre el árbol de átomos acumulando `©mak` y `©mod`.
 * Corta en cuanto ve un tamaño incoherente: con basura devuelve nada, y como
 * cada vuelta avanza al menos 8 bytes, no puede quedarse en bucle.
 */
function recorrer(
  v: DataView,
  ini: number,
  fin: number,
  encontrado: Map<string, string>,
  profundidad: number,
): void {
  if (profundidad > PROFUNDIDAD_MAX) return;
  let p = ini;

  while (p + 8 <= fin) {
    let tam = v.getUint32(p);
    const tipo = tipoDeAtomo(v, p + 4);
    let datos = p + 8;

    if (tam === 1) {
      // Tamaño de 64 bits. Basta la parte baja: no vamos a recorrer >4 GB.
      if (p + 16 > fin) return;
      if (v.getUint32(p + 8) !== 0) return;
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
    return unirMarcaModelo(
      encontrado.get("©mak") ?? null,
      encontrado.get("©mod") ?? null,
    );
  } catch {
    return null;
  }
}

/* ────────────────────────── Envoltorio para File ────────────────────────── */

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
