import "server-only";

import * as XLSX from "xlsx";

/** Extrae texto plano de un archivo. Lanza si el tipo no es soportado. */
export async function extractDocumentText(
  buffer: Buffer,
  filename: string,
  mime: string,
): Promise<{ text: string; tipo: string }> {
  const lower = filename.toLowerCase();
  const ext = lower.split(".").pop() || "";

  // PDF (unpdf: pdf.js sin binarios nativos).
  if (ext === "pdf" || mime === "application/pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return { text: Array.isArray(text) ? text.join("\n\n") : String(text), tipo: "pdf" };
  }

  // DOCX (mammoth).
  if (ext === "docx" || mime.includes("wordprocessingml")) {
    const mammoth = (await import("mammoth")).default;
    const { value } = await mammoth.extractRawText({ buffer });
    return { text: value, tipo: "docx" };
  }

  // Excel.
  if (ext === "xlsx" || ext === "xls" || mime.includes("spreadsheet") || mime.includes("ms-excel")) {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const partes: string[] = [];
    for (const hoja of wb.SheetNames) {
      const ws = wb.Sheets[hoja];
      if (!ws) continue;
      partes.push(`# Hoja: ${hoja}\n${XLSX.utils.sheet_to_csv(ws)}`);
    }
    return { text: partes.join("\n\n"), tipo: "xlsx" };
  }

  // CSV / texto / markdown / json.
  if (["csv", "txt", "md", "json", "log", "tsv"].includes(ext) || mime.startsWith("text/") || mime === "application/json") {
    return { text: buffer.toString("utf8"), tipo: ext || "txt" };
  }

  throw new Error(`Tipo de archivo no soportado para extracción: .${ext || "?"}. Usa PDF, DOCX, Excel, CSV, TXT, MD o JSON.`);
}
