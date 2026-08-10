/**
 * Clasificación de archivos por tipo de medio, compartida por la tarjeta (qué
 * ícono y qué miniatura) y el visor (cómo reproducirlo).
 */

export type MediaKind = "imagen" | "video" | "audio" | "pdf" | "documento" | "archivo";

const EXT_KIND: Record<string, MediaKind> = {
  jpg: "imagen", jpeg: "imagen", png: "imagen", gif: "imagen", webp: "imagen",
  avif: "imagen", heic: "imagen", bmp: "imagen", svg: "imagen", tif: "imagen",
  tiff: "imagen", psd: "imagen", ai: "imagen", cr2: "imagen", nef: "imagen",
  arw: "imagen", dng: "imagen", raw: "imagen",
  mp4: "video", mov: "video", avi: "video", mkv: "video", webm: "video",
  m4v: "video", mpg: "video", mpeg: "video", wmv: "video", flv: "video",
  mp3: "audio", wav: "audio", m4a: "audio", aac: "audio", ogg: "audio", flac: "audio",
  pdf: "pdf",
  doc: "documento", docx: "documento", xls: "documento", xlsx: "documento",
  ppt: "documento", pptx: "documento", txt: "documento", csv: "documento",
};

/**
 * El mime manda; si viene vacío (pasa con material de cámara y con lo que Drive
 * no reconoce) se cae a la extensión del nombre.
 */
export function mediaKind(mime: string | null | undefined, nombre: string): MediaKind {
  const m = (mime ?? "").toLowerCase();
  if (m.startsWith("image/")) return "imagen";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m === "application/pdf") return "pdf";

  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  if (EXT_KIND[ext]) return EXT_KIND[ext];

  if (m.includes("word") || m.includes("sheet") || m.includes("presentation") || m.startsWith("text/")) {
    return "documento";
  }
  return "archivo";
}

/**
 * Etiqueta con la que se clasifica el material de una cobertura.
 *
 * Es un valor GUARDADO, no derivado: `mediaKind()` da el default, pero se puede
 * corregir a mano en la revisión previa y esa corrección tiene que sobrevivir.
 * Debe coincidir con el check de `cobertura_files.tipo_contenido` (0034).
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

/** Etiqueta por defecto de un archivo, a partir de su clasificación de medio. */
export function tipoContenido(kind: MediaKind): TipoContenido {
  return KIND_A_TIPO[kind];
}

/** Tipos para los que Drive genera una miniatura aprovechable. */
export function tieneMiniatura(kind: MediaKind): boolean {
  return kind === "imagen" || kind === "video" || kind === "pdf" || kind === "documento";
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}
