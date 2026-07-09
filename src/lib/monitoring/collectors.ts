import "server-only";

import { getCredential, getConnectionsStatus } from "@/lib/connections";

/**
 * Colectores de menciones para el monitoreo de personas.
 *
 * · Noticias: RSS de Google News (GRATIS, sin clave) → funciona ya.
 * · X (Twitter): API v2 si hay X_BEARER_TOKEN (opcional).
 * · NewsAPI: si hay NEWSAPI_KEY (opcional, complementa noticias).
 * · Facebook/Instagram/TikTok: requieren APIs oficiales con aprobación; se dejan
 *   como "no_configurado" (se pueden añadir con sus claves, o cargar manualmente).
 */

export interface CollectedItem {
  fuente: string;
  tipo: string;
  titulo: string;
  contenido?: string;
  url: string;
  autor?: string;
  autor_handle?: string;
  published_at?: string;
}

export interface SourceResult {
  fuente: string;
  status: string; // "ok:N" | "no_configurado" | "error:..."
  items: CollectedItem[];
}

export interface MonitorTarget {
  nombre: string;
  alias?: string[];
  keywords?: string[];
  handles?: Record<string, string> | null;
}

/** "recent" = incremental (rápido); "sweep" = barrido amplio/histórico. */
export type CollectMode = "recent" | "sweep";

function buildQuery(t: MonitorTarget): string {
  const terms = [t.nombre, ...(t.alias ?? []), ...(t.keywords ?? [])]
    .map((s) => s.trim())
    .filter(Boolean);
  const uniq = Array.from(new Set(terms));
  // ("A" OR "B" OR ...)
  return "(" + uniq.map((s) => `"${s}"`).join(" OR ") + ")";
}

/* ─────────────── Utilidades de parseo RSS ─────────────── */

function strip(s?: string): string {
  return (s ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();
}
function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}
function isoDate(s: string): string | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

function parseRss(xml: string): CollectedItem[] {
  const items: CollectedItem[] = [];
  const blocks = xml.split(/<item>/i).slice(1);
  for (const raw of blocks) {
    const seg = raw.split(/<\/item>/i)[0] ?? "";
    const pick = (tag: string): string => {
      const m = seg.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
      return m ? decode(strip(m[1])) : "";
    };
    const title = pick("title");
    const link = pick("link");
    if (!title || !link) continue;
    const source = pick("source");
    items.push({
      fuente: "noticia",
      tipo: "noticia",
      titulo: title.replace(/\s+-\s+[^-]+$/, "").trim() || title,
      url: link,
      autor: source || undefined,
      contenido: pick("description") || source || undefined,
      published_at: isoDate(pick("pubDate")),
    });
  }
  return items;
}

/* ─────────────── Fuente: Google News RSS (gratis) ─────────────── */

function targetTerms(t: MonitorTarget): string[] {
  return Array.from(
    new Set([t.nombre, ...(t.alias ?? []), ...(t.keywords ?? [])].map((s) => s.trim()).filter(Boolean)),
  );
}

async function collectGoogleNews(t: MonitorTarget, mode: CollectMode = "recent"): Promise<SourceResult> {
  try {
    // En barrido se consulta cada término por separado (Google News devuelve
    // resultados distintos por consulta), lo que amplía mucho la cobertura.
    const queries =
      mode === "sweep" ? [buildQuery(t), ...targetTerms(t).map((x) => `"${x}"`)] : [buildQuery(t)];
    const map = new Map<string, CollectedItem>();
    for (const query of queries) {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=es-419&gl=CO&ceid=CO:es-419`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 UTL360-Monitor" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      for (const it of parseRss(xml)) if (!map.has(it.url)) map.set(it.url, it);
      if (map.size >= 150) break;
    }
    const items = [...map.values()].slice(0, 150);
    return { fuente: "noticia", status: `ok:${items.length}`, items };
  } catch (e) {
    return { fuente: "noticia", status: `error:${(e as Error).message.slice(0, 60)}`, items: [] };
  }
}

/* ─────────────── Fuente: X (Twitter) API v2 — opcional ─────────────── */

async function collectX(t: MonitorTarget, mode: CollectMode = "recent"): Promise<SourceResult> {
  const token = await getCredential("x", "bearer_token");
  if (!token) return { fuente: "x", status: "no_configurado", items: [] };
  try {
    // Nota: la búsqueda estándar de X solo cubre los ÚLTIMOS 7 DÍAS. En barrido
    // paginamos para traer todo lo posible dentro de esa ventana.
    const query = `${buildQuery(t)} -is:retweet lang:es`;
    const maxPages = mode === "sweep" ? 4 : 1;
    const perPage = mode === "sweep" ? 100 : 25;
    const users = new Map<string, { id: string; username: string; name: string }>();
    const items: CollectedItem[] = [];
    let next: string | undefined;
    for (let page = 0; page < maxPages; page++) {
      const url =
        `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}` +
        `&max_results=${perPage}&tweet.fields=created_at,author_id&expansions=author_id&user.fields=username,name` +
        (next ? `&next_token=${next}` : "");
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        if (page === 0) return { fuente: "x", status: `error:${res.status}`, items: [] };
        break;
      }
      const data = (await res.json()) as {
        data?: { id: string; text: string; created_at?: string; author_id?: string }[];
        includes?: { users?: { id: string; username: string; name: string }[] };
        meta?: { next_token?: string };
      };
      for (const u of data.includes?.users ?? []) users.set(u.id, u);
      for (const tw of data.data ?? []) {
        const u = tw.author_id ? users.get(tw.author_id) : undefined;
        items.push({
          fuente: "x",
          tipo: "post",
          titulo: tw.text.slice(0, 120),
          contenido: tw.text,
          url: u ? `https://x.com/${u.username}/status/${tw.id}` : `https://x.com/i/web/status/${tw.id}`,
          autor: u?.name,
          autor_handle: u ? `@${u.username}` : undefined,
          published_at: isoDate(tw.created_at ?? ""),
        });
      }
      next = data.meta?.next_token;
      if (!next) break;
    }
    return { fuente: "x", status: `ok:${items.length}`, items };
  } catch (e) {
    return { fuente: "x", status: `error:${(e as Error).message.slice(0, 60)}`, items: [] };
  }
}

/* ─────────────── Fuente: NewsAPI — opcional ─────────────── */

async function collectNewsApi(t: MonitorTarget, mode: CollectMode = "recent"): Promise<SourceResult> {
  const key = await getCredential("newsapi", "api_key");
  if (!key) return { fuente: "newsapi", status: "no_configurado", items: [] };
  try {
    const q = encodeURIComponent(buildQuery(t));
    const pageSize = mode === "sweep" ? 100 : 30;
    const sortBy = mode === "sweep" ? "relevancy" : "publishedAt";
    const url = `https://newsapi.org/v2/everything?q=${q}&language=es&sortBy=${sortBy}&pageSize=${pageSize}&apiKey=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return { fuente: "newsapi", status: `error:${res.status}`, items: [] };
    const data = (await res.json()) as {
      articles?: { title: string; description?: string; url: string; publishedAt?: string; source?: { name?: string } }[];
    };
    const items: CollectedItem[] = (data.articles ?? []).map((a) => ({
      fuente: "noticia",
      tipo: "noticia",
      titulo: a.title,
      contenido: a.description ?? undefined,
      url: a.url,
      autor: a.source?.name,
      published_at: isoDate(a.publishedAt ?? ""),
    }));
    return { fuente: "newsapi", status: `ok:${items.length}`, items };
  } catch (e) {
    return { fuente: "newsapi", status: `error:${(e as Error).message.slice(0, 60)}`, items: [] };
  }
}

/* ─────────────── Fuente: YouTube (Data API v3) — opcional ─────────────── */

async function collectYouTube(t: MonitorTarget, mode: CollectMode = "recent"): Promise<SourceResult> {
  const key = await getCredential("youtube", "api_key");
  if (!key) return { fuente: "youtube", status: "no_configurado", items: [] };
  try {
    const q = encodeURIComponent(buildQuery(t));
    const maxResults = mode === "sweep" ? 50 : 15;
    const order = mode === "sweep" ? "relevance" : "date";
    const url =
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=${order}&maxResults=${maxResults}` +
      `&q=${q}&key=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return { fuente: "youtube", status: `error:${res.status}`, items: [] };
    const data = (await res.json()) as {
      items?: { id?: { videoId?: string }; snippet?: { title?: string; description?: string; channelTitle?: string; publishedAt?: string } }[];
    };
    const items: CollectedItem[] = (data.items ?? [])
      .filter((v) => v.id?.videoId)
      .map((v) => ({
        fuente: "youtube",
        tipo: "video",
        titulo: v.snippet?.title ?? "(video)",
        contenido: v.snippet?.description ?? undefined,
        url: `https://www.youtube.com/watch?v=${v.id!.videoId}`,
        autor: v.snippet?.channelTitle,
        published_at: isoDate(v.snippet?.publishedAt ?? ""),
      }));
    return { fuente: "youtube", status: `ok:${items.length}`, items };
  } catch (e) {
    return { fuente: "youtube", status: `error:${(e as Error).message.slice(0, 60)}`, items: [] };
  }
}

/** Estado de cada fuente (para la UI), según las conexiones guardadas. */
export async function getSourcesStatus(): Promise<
  { fuente: string; label: string; configurado: boolean }[]
> {
  const status = await getConnectionsStatus();
  const on = (k: string) => Boolean(status[k]?.connected);
  return [
    { fuente: "noticia", label: "Noticias (Google News)", configurado: true },
    { fuente: "x", label: "X / Twitter", configurado: on("x") },
    { fuente: "newsapi", label: "NewsAPI", configurado: on("newsapi") },
    { fuente: "youtube", label: "YouTube", configurado: on("youtube") },
  ];
}

/** Ejecuta todas las fuentes disponibles para una persona. */
export async function collectForPerson(
  t: MonitorTarget,
  mode: CollectMode = "recent",
): Promise<SourceResult[]> {
  return Promise.all([
    collectGoogleNews(t, mode),
    collectNewsApi(t, mode),
    collectX(t, mode),
    collectYouTube(t, mode),
  ]);
}
