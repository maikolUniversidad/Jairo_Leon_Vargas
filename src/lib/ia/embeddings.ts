import "server-only";

/**
 * Embeddings de texto con OpenAI (text-embedding-3-small · 1536 dims). Server-only.
 * La dimensión debe coincidir con vector(1536) de kb_chunks.
 *   OPENAI_API_KEY       (obligatoria)
 *   OPENAI_EMBED_MODEL   (por defecto text-embedding-3-small)
 */

const MODEL = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";

export function embeddingsAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Genera embeddings para varios textos (en lotes). Lanza si falla. */
export async function embedTexts(textos: string[]): Promise<number[][]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Falta OPENAI_API_KEY para generar embeddings.");
  if (textos.length === 0) return [];

  const out: number[][] = [];
  const BATCH = 96;
  for (let i = 0; i < textos.length; i += BATCH) {
    const lote = textos.slice(i, i + BATCH).map((t) => t.replace(/\n/g, " ").slice(0, 8000));
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: MODEL, input: lote }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Embeddings respondió ${res.status}: ${detail.slice(0, 160)}`);
    }
    const json = (await res.json()) as { data?: { embedding: number[] }[] };
    for (const d of json.data ?? []) out.push(d.embedding);
  }
  return out;
}

/** Embedding de una sola consulta (para la búsqueda del RAG). */
export async function embedQuery(texto: string): Promise<number[]> {
  const [v] = await embedTexts([texto]);
  if (!v) throw new Error("No se pudo generar el embedding de la consulta.");
  return v;
}
