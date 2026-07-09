import "server-only";

/**
 * Cliente server-only de Higgsfield Cloud API (imagen/video). La generación es
 * ASÍNCRONA: `submitGeneration` encola un trabajo y devuelve un id; el llamador
 * sondea con `getGeneration` hasta que termine. Las llaves NUNCA se exponen al
 * cliente. Sin llave, `higgsfieldAvailable()` es false y el llamador cae a mock.
 *
 * El esquema exacto de la API puede variar según el plan/endpoint; por eso todo
 * queda encapsulado aquí y es configurable por variables de entorno:
 *   HIGGSFIELD_API_KEY      (obligatoria para modo real)
 *   HIGGSFIELD_BASE_URL     (por defecto https://api.higgsfield.ai)
 *   HIGGSFIELD_IMAGE_MODEL  (por defecto "flux")
 *   HIGGSFIELD_VIDEO_MODEL  (por defecto "higgsfield")
 */

export type HiggsKind = "imagen" | "video";

interface HiggsConfig {
  key: string;
  baseUrl: string;
  imageModel: string;
  videoModel: string;
}

function getConfig(): HiggsConfig | null {
  const key = process.env.HIGGSFIELD_API_KEY;
  if (!key) return null;
  return {
    key,
    baseUrl: (process.env.HIGGSFIELD_BASE_URL || "https://api.higgsfield.ai").replace(/\/+$/, ""),
    imageModel: process.env.HIGGSFIELD_IMAGE_MODEL || "flux",
    videoModel: process.env.HIGGSFIELD_VIDEO_MODEL || "higgsfield",
  };
}

/** ¿Hay llave de Higgsfield configurada? */
export function higgsfieldAvailable(): boolean {
  return getConfig() !== null;
}

export interface SubmitInput {
  kind: HiggsKind;
  prompt: string;
  imageUrl?: string; // para imagen→video
  width?: number;
  height?: number;
  duration?: number; // segundos (video)
}

export interface SubmitResult {
  externalId: string;
}

export interface GenerationState {
  status: "pending" | "processing" | "completed" | "failed";
  resultUrl?: string;
  error?: string;
}

const TIMEOUT = 30_000;

/** Extrae de forma tolerante un id de trabajo de una respuesta JSON. */
function pickId(obj: Record<string, unknown>): string | null {
  for (const k of ["id", "generation_id", "job_id", "jobId", "task_id", "requestId"]) {
    const v = obj[k];
    if (typeof v === "string" && v) return v;
  }
  const data = obj.data as Record<string, unknown> | undefined;
  if (data) return pickId(data);
  return null;
}

/** Normaliza el estado devuelto por la API a nuestro enum. */
function pickStatus(raw: string | undefined): GenerationState["status"] {
  const s = (raw || "").toLowerCase();
  if (["completed", "succeeded", "success", "done", "finished", "ready"].includes(s)) return "completed";
  if (["failed", "error", "cancelled", "canceled"].includes(s)) return "failed";
  if (["processing", "running", "in_progress", "started"].includes(s)) return "processing";
  return "pending";
}

/** Busca de forma tolerante la URL del asset resultante. */
function pickResultUrl(obj: Record<string, unknown>): string | undefined {
  for (const k of ["result_url", "output_url", "url", "video_url", "image_url", "asset_url"]) {
    const v = obj[k];
    if (typeof v === "string" && /^https?:\/\//.test(v)) return v;
  }
  for (const k of ["output", "result", "data", "assets"]) {
    const v = obj[k];
    if (typeof v === "string" && /^https?:\/\//.test(v)) return v;
    if (Array.isArray(v) && v.length) {
      const first = v[0];
      if (typeof first === "string" && /^https?:\/\//.test(first)) return first;
      if (first && typeof first === "object") {
        const u = pickResultUrl(first as Record<string, unknown>);
        if (u) return u;
      }
    }
    if (v && typeof v === "object") {
      const u = pickResultUrl(v as Record<string, unknown>);
      if (u) return u;
    }
  }
  return undefined;
}

/** Encola una generación de imagen o video. Lanza si falla; el llamador cae a mock. */
export async function submitGeneration(input: SubmitInput): Promise<SubmitResult> {
  const cfg = getConfig();
  if (!cfg) throw new Error("Higgsfield no está configurado.");

  const isVideo = input.kind === "video";
  const body: Record<string, unknown> = isVideo
    ? {
        task: input.imageUrl ? "image-to-video" : "text-to-video",
        model: cfg.videoModel,
        prompt: input.prompt,
        ...(input.imageUrl ? { input_image: input.imageUrl } : {}),
        duration: input.duration ?? 5,
      }
    : {
        task: "text-to-image",
        model: cfg.imageModel,
        prompt: input.prompt,
        width: input.width ?? 1024,
        height: input.height ?? 1024,
      };

  const res = await fetch(`${cfg.baseUrl}/v1/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.key}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Higgsfield respondió ${res.status}: ${detail.slice(0, 200)}`);
  }

  const json = (await res.json()) as Record<string, unknown>;
  const id = pickId(json);
  if (!id) throw new Error("Higgsfield no devolvió un id de trabajo.");
  return { externalId: id };
}

/** Descarga el objeto "interno" de un trabajo (desanida `data` si aplica). */
async function fetchInner(externalId: string): Promise<Record<string, unknown>> {
  const cfg = getConfig();
  if (!cfg) throw new Error("Higgsfield no está configurado.");
  const res = await fetch(`${cfg.baseUrl}/v1/generations/${encodeURIComponent(externalId)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${cfg.key}` },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Higgsfield respondió ${res.status}: ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as Record<string, unknown>;
  return (json.data as Record<string, unknown>) ?? json;
}

/** Consulta el estado de un trabajo. Lanza si la petición falla. */
export async function getGeneration(externalId: string): Promise<GenerationState> {
  const inner = await fetchInner(externalId);
  const status = pickStatus(inner.status as string | undefined);
  const resultUrl = pickResultUrl(inner);
  return {
    status: status === "pending" && resultUrl ? "completed" : status,
    resultUrl,
    error: typeof inner.error === "string" ? inner.error : undefined,
  };
}

/* ───────────────── Predictor de viralidad nativo (brain_activity) ───────────────── */

export interface ViralityMetrics {
  score: number | null; // Viral Potential Score 0..100
  hookScore: number | null; // 0..100
  holdRate: number | null; // % 0..100
  heatmapUrl?: string;
  raw: Record<string, unknown>;
}

function toPct(v: unknown): number | null {
  if (typeof v !== "number" || Number.isNaN(v)) return null;
  const n = v <= 1 && v >= 0 ? v * 100 : v; // normaliza 0..1 → 0..100
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Busca de forma tolerante un número por varias claves, incluyendo contenedores anidados. */
function findNum(obj: Record<string, unknown>, keys: string[], depth = 0): number | null {
  for (const k of keys) {
    if (k in obj) {
      const p = toPct(obj[k]);
      if (p !== null) return p;
    }
  }
  if (depth < 2) {
    for (const c of ["metrics", "result", "output", "report", "brain_activity", "data", "scores"]) {
      const v = obj[c];
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const found = findNum(v as Record<string, unknown>, keys, depth + 1);
        if (found !== null) return found;
      }
    }
  }
  return null;
}

function extractMetrics(inner: Record<string, unknown>): ViralityMetrics {
  return {
    score: findNum(inner, ["viral_potential_score", "virality_score", "viral_score", "score", "virality"]),
    hookScore: findNum(inner, ["hook_score", "hook"]),
    holdRate: findNum(inner, ["hold_rate", "hold", "retention_rate", "retention"]),
    heatmapUrl: pickResultUrl(
      (inner.brain_heatmap as Record<string, unknown>) ?? { u: (inner.heatmap_url ?? inner.brain_heatmap_url) },
    ),
    raw: inner,
  };
}

/** ¿Se puede usar el predictor nativo? (misma llave que el resto de Higgsfield). */
export function viralityPredictorAvailable(): boolean {
  return getConfig() !== null;
}

/**
 * Predictor de viralidad nativo de Higgsfield ("brain_activity"). Encola el
 * análisis del video y sondea de forma acotada (resultado en segundos). El
 * endpoint y el nombre del task son configurables por env:
 *   HIGGSFIELD_VIRALITY_URL   (por defecto {base}/v1/generations)
 *   HIGGSFIELD_VIRALITY_TASK  (por defecto "brain_activity")
 */
export async function predictVirality(videoUrl: string): Promise<ViralityMetrics> {
  const cfg = getConfig();
  if (!cfg) throw new Error("Higgsfield no está configurado.");
  const url = process.env.HIGGSFIELD_VIRALITY_URL || `${cfg.baseUrl}/v1/generations`;
  const task = process.env.HIGGSFIELD_VIRALITY_TASK || "brain_activity";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({ task, input_video: videoUrl, video_url: videoUrl }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Higgsfield (viralidad) respondió ${res.status}: ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as Record<string, unknown>;
  const inner0 = (json.data as Record<string, unknown>) ?? json;

  // Respuesta síncrona: ya trae métricas.
  const direct = extractMetrics(inner0);
  if (direct.score !== null || direct.hookScore !== null || direct.holdRate !== null) return direct;

  // Asíncrono: sondea hasta ~24s.
  const id = pickId(inner0);
  if (!id) throw new Error("Higgsfield no devolvió métricas ni un id de trabajo.");
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const inner = await fetchInner(id);
    const status = pickStatus(inner.status as string | undefined);
    const m = extractMetrics(inner);
    if (status === "failed") throw new Error("El predictor de viralidad falló.");
    if (status === "completed" || m.score !== null) return m;
  }
  throw new Error("El predictor de viralidad no respondió a tiempo.");
}
