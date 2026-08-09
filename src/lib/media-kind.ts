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
