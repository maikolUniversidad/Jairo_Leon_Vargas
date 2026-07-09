/** Fragmenta texto en chunks solapados, respetando párrafos cuando es posible. */

const MAX_CHARS = 1200;
const OVERLAP = 200;

export interface Chunk {
  content: string;
  tokens: number;
}

function aprox(tokens: string): number {
  return Math.ceil(tokens.length / 4); // estimación de tokens
}

export function chunkText(raw: string): Chunk[] {
  const text = raw.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return [];

  // Divide en párrafos y acumula hasta ~MAX_CHARS.
  const parrafos = text.split(/\n\n+/);
  const chunks: string[] = [];
  let actual = "";

  const push = () => {
    const t = actual.trim();
    if (t) chunks.push(t);
    actual = "";
  };

  for (const p of parrafos) {
    // Párrafo enorme: divídelo por oraciones/ventana.
    if (p.length > MAX_CHARS) {
      push();
      let i = 0;
      while (i < p.length) {
        const slice = p.slice(i, i + MAX_CHARS);
        chunks.push(slice.trim());
        i += MAX_CHARS - OVERLAP;
      }
      continue;
    }
    if (actual.length + p.length + 2 > MAX_CHARS) push();
    actual += (actual ? "\n\n" : "") + p;
  }
  push();

  // Solapamiento entre chunks consecutivos (mejora recuperación en fronteras).
  const conOverlap: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const prev = i > 0 ? chunks[i - 1]!.slice(-OVERLAP) : "";
    conOverlap.push((prev ? prev + "\n…\n" : "") + chunks[i]!);
  }

  return conOverlap.map((content) => ({ content, tokens: aprox(content) }));
}
