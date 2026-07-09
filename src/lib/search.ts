import "server-only";

/**
 * Búsqueda web server-only para la investigación de temas. Soporta Tavily
 * (por defecto) y Serper (Google). La llave NUNCA se expone al cliente. Sin
 * llave, `searchAvailable()` es false y el llamador se apoya solo en la IA.
 *   SEARCH_PROVIDER  "tavily" | "serper"  (por defecto "tavily")
 *   SEARCH_API_KEY   llave del proveedor elegido
 */

type SearchProvider = "tavily" | "serper";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

function provider(): SearchProvider {
  return (process.env.SEARCH_PROVIDER as SearchProvider) || "tavily";
}

/** ¿Hay proveedor de búsqueda con llave? */
export function searchAvailable(): boolean {
  return Boolean(process.env.SEARCH_API_KEY);
}

const TIMEOUT = 20_000;

/** Ejecuta una búsqueda web y devuelve hasta `max` resultados. Lanza si falla. */
export async function webSearch(query: string, max = 6): Promise<SearchResult[]> {
  const key = process.env.SEARCH_API_KEY;
  if (!key) throw new Error("No hay proveedor de búsqueda configurado.");

  if (provider() === "serper") {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": key },
      body: JSON.stringify({ q: query, num: max, gl: "co", hl: "es" }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) throw new Error(`Serper respondió ${res.status}`);
    const json = (await res.json()) as { organic?: { title: string; link: string; snippet?: string }[] };
    return (json.organic ?? []).slice(0, max).map((r) => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet ?? "",
    }));
  }

  // Tavily (por defecto).
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      max_results: max,
      search_depth: "basic",
      include_answer: false,
    }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`Tavily respondió ${res.status}`);
  const json = (await res.json()) as {
    results?: { title: string; url: string; content?: string }[];
  };
  return (json.results ?? []).slice(0, max).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content ?? "",
  }));
}
