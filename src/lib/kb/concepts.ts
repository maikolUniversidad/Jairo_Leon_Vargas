import "server-only";

import { generateCompletion, aiAvailable } from "@/lib/ai";

/** Normaliza un concepto a slug (minúsculas, sin tildes). */
export function slugifyConcept(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export interface ConceptExtraction {
  resumen: string;
  conceptos: string[];
}

const SYSTEM =
  "Eres un analista que construye una base de conocimiento. A partir de un documento, " +
  "extrae los conceptos/entidades clave (temas, personas, lugares, programas, normas, organizaciones). " +
  "Devuelve SOLO un JSON válido: {\"resumen\": string (máx 240 caracteres), " +
  "\"conceptos\": string[] (entre 5 y 12, en Título Capitalizado, sin duplicados, específicos y reutilizables)}. " +
  "No incluyas nada fuera del JSON.";

/** Extrae resumen + conceptos de un texto usando la IA configurada. */
export async function extractConcepts(texto: string): Promise<ConceptExtraction> {
  const muestra = texto.slice(0, 8000);
  if (!aiAvailable()) {
    return { resumen: muestra.slice(0, 200), conceptos: [] };
  }
  try {
    const out = await generateCompletion(SYSTEM, muestra, { temperature: 0.2, maxTokens: 500 });
    const match = out.match(/\{[\s\S]*\}/);
    const json = match ? (JSON.parse(match[0]) as Partial<ConceptExtraction>) : {};
    const conceptos = Array.isArray(json.conceptos)
      ? Array.from(new Set(json.conceptos.map((c) => String(c).trim()).filter((c) => c.length > 1 && c.length <= 60))).slice(0, 12)
      : [];
    return { resumen: (json.resumen ?? muestra.slice(0, 200)).toString().slice(0, 240), conceptos };
  } catch {
    return { resumen: muestra.slice(0, 200), conceptos: [] };
  }
}
