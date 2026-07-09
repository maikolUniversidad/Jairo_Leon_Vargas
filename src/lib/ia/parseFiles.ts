import * as XLSX from "xlsx";
import type { Attachment } from "./types";

/** Tipos aceptados por el adjuntador. */
export const ACCEPT_FILES =
  "image/*,.csv,.xlsx,.xls,.txt,.md,.json,text/csv,text/plain,application/json," +
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_TEXT = 24_000; // recorte del texto extraído enviado a la IA

function nuevoId() {
  return globalThis.crypto?.randomUUID?.() ?? `att-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("No se pudo leer el archivo."));
    r.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("No se pudo leer el archivo."));
    r.readAsText(file);
  });
}

/** Convierte un archivo del navegador en un Attachment (imagen o texto extraído). */
export async function parseFile(file: File): Promise<Attachment> {
  if (file.size > MAX_BYTES) {
    throw new Error(`"${file.name}" supera el límite de 8 MB.`);
  }

  const name = file.name;
  const mime = file.type || "";
  const lower = name.toLowerCase();

  // Imágenes → dataURL (las analiza un modelo con visión).
  if (mime.startsWith("image/")) {
    const dataUrl = await readAsDataURL(file);
    return { id: nuevoId(), name, kind: "image", mime: mime || "image/*", dataUrl };
  }

  // Excel → texto CSV por hoja.
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || mime.includes("spreadsheet") || mime.includes("ms-excel")) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const partes: string[] = [];
    for (const hoja of wb.SheetNames) {
      const ws = wb.Sheets[hoja];
      if (!ws) continue;
      const csv = XLSX.utils.sheet_to_csv(ws);
      partes.push(`# Hoja: ${hoja}\n${csv}`);
    }
    const text = partes.join("\n\n").slice(0, MAX_TEXT);
    return { id: nuevoId(), name, kind: "text", mime: "text/csv", text };
  }

  // CSV / texto plano / json / md → texto.
  if (
    lower.endsWith(".csv") || lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".json") ||
    mime.startsWith("text/") || mime === "application/json"
  ) {
    const raw = await readAsText(file);
    return { id: nuevoId(), name, kind: "text", mime: mime || "text/plain", text: raw.slice(0, MAX_TEXT) };
  }

  throw new Error(`Tipo de archivo no soportado: "${name}". Usa imagen, CSV, Excel o texto.`);
}
