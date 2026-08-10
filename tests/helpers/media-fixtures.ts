/**
 * Constructores de archivos binarios mínimos pero válidos, para probar los
 * parsers de metadatos sin comprometer fotos ni videos reales al repositorio.
 *
 * No es un archivo de pruebas: el `include` de Vitest es `tests/**\/*.test.ts`.
 */

const utf8 = (s: string) => new TextEncoder().encode(s);

function concat(...partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of partes) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/* ────────────────────────────── JPEG con EXIF ────────────────────────────── */

/**
 * JPEG con un segmento APP1/EXIF que lleva Make y Model en el IFD0.
 * Estructura: SOI · APP1[ "Exif\0\0" + TIFF ] · EOI.
 */
export function jpegConExif(make: string, model: string): Uint8Array {
  const makeB = utf8(make + "\0");
  const modelB = utf8(model + "\0");

  const nEntradas = 2;
  const ifdSize = 2 + nEntradas * 12 + 4;
  const datosOffset = 8 + ifdSize; // relativo al inicio del TIFF header

  const tiff = new Uint8Array(8 + ifdSize + makeB.length + modelB.length);
  const v = new DataView(tiff.buffer);
  tiff[0] = 0x49;
  tiff[1] = 0x49; // "II": little endian
  v.setUint16(2, 0x2a, true);
  v.setUint32(4, 8, true); // offset al IFD0
  v.setUint16(8, nEntradas, true);

  let p = 10;
  v.setUint16(p, 0x010f, true); // tag Make
  v.setUint16(p + 2, 2, true); // tipo ASCII
  v.setUint32(p + 4, makeB.length, true);
  v.setUint32(p + 8, datosOffset, true);
  p += 12;
  v.setUint16(p, 0x0110, true); // tag Model
  v.setUint16(p + 2, 2, true);
  v.setUint32(p + 4, modelB.length, true);
  v.setUint32(p + 8, datosOffset + makeB.length, true);
  p += 12;
  v.setUint32(p, 0, true); // no hay IFD1

  tiff.set(makeB, datosOffset);
  tiff.set(modelB, datosOffset + makeB.length);

  const payload = concat(utf8("Exif\0\0"), tiff);

  const out = new Uint8Array(2 + 4 + payload.length + 2);
  const ov = new DataView(out.buffer);
  ov.setUint16(0, 0xffd8); // SOI
  ov.setUint16(2, 0xffe1); // APP1
  ov.setUint16(4, payload.length + 2);
  out.set(payload, 6);
  ov.setUint16(6 + payload.length, 0xffd9); // EOI
  return out;
}

/** JPEG válido pero sin ningún segmento de metadatos. */
export function jpegSinExif(): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
}

/* ─────────────────────────── MP4 / MOV con átomos ─────────────────────────── */

/** Un átomo ISO-BMFF: [uint32 tamaño][4 chars tipo][payload]. */
function atomo(tipo: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + payload.length);
  new DataView(out.buffer).setUint32(0, out.length);
  const t = utf8(tipo);
  // Los tipos "©xxx" ocupan 4 bytes: 0xA9 + 3 ASCII. TextEncoder emite 0xC2 0xA9
  // para "©" (UTF-8), así que ese byte se escribe a mano.
  if (tipo.startsWith("©")) {
    out[4] = 0xa9;
    out.set(utf8(tipo.slice(1)).slice(0, 3), 5);
  } else {
    out.set(t.slice(0, 4), 4);
  }
  out.set(payload, 8);
  return out;
}

/** Payload de un átomo `©xxx` de udta: [uint16 longitud][uint16 idioma][texto]. */
function textoUdta(s: string): Uint8Array {
  const b = utf8(s);
  const out = new Uint8Array(4 + b.length);
  const v = new DataView(out.buffer);
  v.setUint16(0, b.length);
  v.setUint16(2, 0);
  out.set(b, 4);
  return out;
}

const FTYP = () => atomo("ftyp", utf8("isom\0\0\0\0"));

/**
 * MP4/MOV con `moov > udta > ©mak/©mod`, que es donde iPhone, Sony y GoPro
 * escriben la marca y el modelo.
 */
export function mp4ConDispositivo(make: string | null, model: string | null): Uint8Array {
  const hijos: Uint8Array[] = [];
  if (make) hijos.push(atomo("©mak", textoUdta(make)));
  if (model) hijos.push(atomo("©mod", textoUdta(model)));
  return concat(FTYP(), atomo("moov", atomo("udta", concat(...hijos))));
}

/** MP4 sin metadatos de dispositivo: cámaras que sencillamente no lo escriben. */
export function mp4SinDispositivo(): Uint8Array {
  return concat(FTYP(), atomo("moov", atomo("udta", new Uint8Array(0))));
}

/**
 * Variante estilo iTunes: `moov > meta > ilst > ©mod > data`.
 * `meta` lleva 4 bytes de versión y banderas antes de sus hijos.
 */
export function mp4ConDispositivoEnIlst(model: string): Uint8Array {
  const b = utf8(model);
  const data = new Uint8Array(8 + b.length);
  const dv = new DataView(data.buffer);
  dv.setUint32(0, 1); // tipo de dato: texto UTF-8
  dv.setUint32(4, 0); // locale
  data.set(b, 8);

  const ilst = atomo("ilst", atomo("©mod", atomo("data", data)));
  const metaPayload = concat(new Uint8Array(4), ilst); // versión + banderas
  return concat(FTYP(), atomo("moov", atomo("meta", metaPayload)));
}
