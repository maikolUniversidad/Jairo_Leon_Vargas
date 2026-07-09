"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { generateCompletion, aiAvailable, aiProviderName } from "@/lib/ai";
import {
  higgsfieldAvailable, submitGeneration, getGeneration, type HiggsKind,
  viralityPredictorAvailable, predictVirality, type ViralityMetrics,
} from "@/lib/higgsfield";
import { searchAvailable, webSearch } from "@/lib/search";
import { videoProjectSchema, videoProjectPatchSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";
import { type ActionResult, zodToFieldErrors } from "./types";
import type {
  VideoProject,
  VideoResearchNote,
  VideoGeneration,
  VideoViralityAnalysis,
} from "@/types/database";

const PROD_PATH = "/dashboard/comunicaciones/produccion";

/** Tono común del proyecto + human-in-the-loop (igual que el Asistente IA). */
const BASE =
  "Eres un estratega de contenido audiovisual del equipo de Jairo León Vargas " +
  "(Pacto Histórico / Colombia Humana, Bogotá). Tono cercano, popular, respetuoso y " +
  "no confrontacional. REGLAS: produce SIEMPRE un BORRADOR para revisión humana; " +
  "NUNCA inventes hechos, cifras, nombres ni promesas; si falta información, indícalo; " +
  "responde en español de Colombia.";

/* ───────────────── Lectura ───────────────── */

export async function listProjects(): Promise<VideoProject[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("video_projects")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);
  return (data as VideoProject[]) ?? [];
}

export async function getProjectDetail(id: string): Promise<{
  project: VideoProject | null;
  research: VideoResearchNote[];
  generations: VideoGeneration[];
  virality: VideoViralityAnalysis[];
}> {
  const supabase = await createClient();
  const [{ data: project }, { data: research }, { data: generations }, { data: virality }] =
    await Promise.all([
      supabase.from("video_projects").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
      supabase.from("video_research").select("*").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("video_generations").select("*").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("video_virality").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    ]);
  return {
    project: (project as VideoProject) ?? null,
    research: (research as VideoResearchNote[]) ?? [],
    generations: (generations as VideoGeneration[]) ?? [],
    virality: (virality as VideoViralityAnalysis[]) ?? [],
  };
}

/* ───────────────── CRUD proyecto ───────────────── */

export async function createProject(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = videoProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos.", fieldErrors: zodToFieldErrors(parsed.error) };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("video_projects")
    .insert({
      titulo: v.titulo,
      descripcion: v.descripcion || null,
      objetivo: v.objetivo || null,
      fase: v.fase,
      plataformas: v.plataformas ?? [],
      responsable_id: v.responsable_id || user?.id || null,
      post_id: v.post_id || null,
      cobertura_id: v.cobertura_id || null,
      contexto_operativo: v.contexto_operativo,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: "No se pudo crear el proyecto (¿permisos?)." };

  revalidatePath(PROD_PATH);
  return { ok: true, message: "Proyecto de video creado.", data: { id: data.id } };
}

export async function updateProject(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = videoProjectPatchSchema.partial().safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Datos inválidos." };
  const v = parsed.data;
  const patch: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) {
    if (val === undefined) continue;
    if (typeof val === "string") patch[k] = val === "" ? null : val;
    else patch[k] = val;
  }
  if (Object.keys(patch).length === 0) return { ok: true, message: "Sin cambios." };

  const supabase = await createClient();
  const { error } = await supabase.from("video_projects").update(patch).eq("id", id);
  if (error) return { ok: false, message: "No se pudo actualizar." };
  revalidatePath(`${PROD_PATH}/${id}`);
  revalidatePath(PROD_PATH);
  return { ok: true, message: "Proyecto actualizado." };
}

export async function setProjectFase(id: string, fase: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("video_projects").update({ fase }).eq("id", id);
  if (error) return { ok: false, message: "No se pudo cambiar la fase." };
  revalidatePath(`${PROD_PATH}/${id}`);
  revalidatePath(PROD_PATH);
  return { ok: true, message: `Fase: ${fase}.` };
}

export async function deleteProject(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("video_projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: "No se pudo eliminar." };
  revalidatePath(PROD_PATH);
  return { ok: true, message: "Proyecto eliminado." };
}

/* ───────────────── Guión, copy, descripción, títulos, hashtags ───────────────── */

export type TextKind = "ideas" | "guion" | "copy" | "descripcion" | "titulos" | "hashtags";

const TEXT_SYSTEM: Record<TextKind, string> = {
  ideas: `${BASE} Tarea: propón 5 ideas/ángulos de video cortos y potentes a partir del tema o contexto. Para cada uno da un gancho (primeros 3 segundos) y el mensaje central. Formato de lista.`,
  guion: `${BASE} Tarea: redacta un guión para video corto (vertical, 30-60s) con estructura: GANCHO (0-3s), DESARROLLO (bloques con lo que se dice y lo que se muestra), CIERRE con llamado a la acción. Marca [pendiente] lo que falte por confirmar.`,
  copy: `${BASE} Tarea: redacta copys para publicar el video. Devuelve 2-3 variantes cortas por si es para feed, con tono adecuado a la red, y sugiere emojis con moderación.`,
  descripcion: `${BASE} Tarea: redacta la descripción del video (para YouTube/TikTok): 2-4 líneas atractivas + una línea de contexto. Incluye un llamado a la acción suave.`,
  titulos: `${BASE} Tarea: propón 6 títulos/tituladores llamativos y honestos para el video (sin clickbait engañoso). Devuelve una opción por línea, sin numeración.`,
  hashtags: `${BASE} Tarea: sugiere de 8 a 15 hashtags pertinentes (mezcla de amplios y de nicho local Bogotá/Colombia). Devuélvelos separados por espacios, cada uno iniciando con #.`,
};

const TEXT_MOCK: Record<TextKind, (i: string) => string> = {
  ideas: (i) => `💡 (mock · sin clave de IA)\nTema: ${i.slice(0, 80)}\n1. Gancho: "..." — Mensaje: ...\n2. ...\n3. ...`,
  guion: (i) => `🎬 Guión (mock)\nGANCHO (0-3s): ${i.slice(0, 60)}...\nDESARROLLO: [pendiente]\nCIERRE: Súmate. [pendiente]`,
  copy: (i) => `📣 Copy (mock)\nVariante 1: ${i.slice(0, 80)}...\nVariante 2: ...`,
  descripcion: (i) => `📝 Descripción (mock): ${i.slice(0, 120)}...`,
  titulos: (i) => `Título A sobre ${i.slice(0, 40)}\nTítulo B\nTítulo C`,
  hashtags: () => `#Bogotá #ColombiaHumana #PactoHistórico #Territorio #Comunidad #JairoLeónVargas`,
};

/**
 * Genera un artefacto de texto (borrador). No lo guarda: el usuario lo revisa y
 * decide guardarlo con `updateProject`. Registra en ai_logs (best-effort).
 */
export async function generateContent(
  projectId: string,
  kind: TextKind,
  input: string,
): Promise<ActionResult<{ output: string; fuente: string }>> {
  if (!input.trim()) return { ok: false, message: "Escribe el tema o contexto." };

  let output: string;
  let fuente: string;
  try {
    if (aiAvailable()) {
      output = await generateCompletion(TEXT_SYSTEM[kind], input.trim(), {
        temperature: kind === "hashtags" ? 0.4 : 0.7,
      });
      fuente = aiProviderName();
    } else {
      output = TEXT_MOCK[kind](input.trim());
      fuente = "mock";
    }
  } catch {
    output = TEXT_MOCK[kind](input.trim());
    fuente = "mock-fallback";
  }

  await logAi(kind, input, output, fuente, projectId);
  return { ok: true, message: fuente.startsWith("mock") ? "Generado (mock)." : `Generado con ${fuente}.`, data: { output, fuente } };
}

/* ───────────────── Investigación de temas ───────────────── */

export async function runResearch(
  projectId: string,
  tema: string,
): Promise<ActionResult<{ note: VideoResearchNote }>> {
  if (!tema.trim()) return { ok: false, message: "Escribe un tema a investigar." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1) Búsqueda web (si hay proveedor).
  let fuentes: { title: string; url: string; snippet?: string }[] = [];
  if (searchAvailable()) {
    try {
      fuentes = await webSearch(tema.trim(), 6);
    } catch {
      fuentes = [];
    }
  }

  // 2) Síntesis con IA (ángulos de video a partir del tema + resultados).
  const contexto = fuentes.length
    ? `Tema: ${tema}\n\nResultados de búsqueda:\n${fuentes
        .map((f, i) => `${i + 1}. ${f.title} — ${f.url}\n${(f.snippet ?? "").slice(0, 300)}`)
        .join("\n\n")}`
    : `Tema: ${tema}\n(No hay resultados de búsqueda; usa conocimiento general y marca lo que deba verificarse.)`;

  const system = `${BASE} Tarea: investigación para video. A partir del tema y los resultados, entrega: (1) resumen del estado del tema, (2) 4-5 ángulos de video con su gancho, (3) datos/afirmaciones a VERIFICAR antes de publicar. Cita las fuentes por su número cuando uses información de ellas.`;

  let contenido: string;
  let fuenteIa: string;
  try {
    if (aiAvailable()) {
      contenido = await generateCompletion(system, contexto, { temperature: 0.6, maxTokens: 1100 });
      fuenteIa = aiProviderName();
    } else {
      contenido = `🔎 Investigación (mock) sobre "${tema}".\n${
        fuentes.length ? `Encontradas ${fuentes.length} fuentes.` : "Sin búsqueda web conectada."
      }\nÁngulos: [pendiente de IA]`;
      fuenteIa = "mock";
    }
  } catch {
    contenido = `🔎 Investigación (mock-fallback) sobre "${tema}".`;
    fuenteIa = "mock-fallback";
  }

  const { data, error } = await supabase
    .from("video_research")
    .insert({
      project_id: projectId,
      tema: tema.trim(),
      contenido,
      fuentes,
      fuente_ia: fuenteIa,
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false, message: "No se pudo guardar la investigación." };

  await logActivity("investigacion", "video_project", projectId, tema.slice(0, 120));
  revalidatePath(`${PROD_PATH}/${projectId}`);
  return { ok: true, message: "Investigación guardada.", data: { note: data as VideoResearchNote } };
}

export async function deleteResearch(id: string, projectId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("video_research").delete().eq("id", id);
  if (error) return { ok: false, message: "No se pudo eliminar." };
  revalidatePath(`${PROD_PATH}/${projectId}`);
  return { ok: true, message: "Nota eliminada." };
}

/* ───────────────── Generación visual (Higgsfield) ───────────────── */

/** Placeholder SVG (data URI) para el modo mock, sin dependencias externas. */
function mockAsset(kind: HiggsKind, prompt: string): string {
  const label = kind === "video" ? "VIDEO (mock)" : "IMAGEN (mock)";
  const text = prompt.slice(0, 48).replace(/[<>&]/g, " ");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f59e0b"/><stop offset="1" stop-color="#b45309"/></linearGradient></defs><rect width="720" height="1280" fill="url(#g)"/><text x="360" y="600" fill="#fff" font-family="sans-serif" font-size="42" font-weight="bold" text-anchor="middle">${label}</text><text x="360" y="670" fill="#fff" font-family="sans-serif" font-size="26" text-anchor="middle">${text}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export async function submitVisual(input: {
  projectId: string;
  kind: HiggsKind;
  prompt: string;
  imageUrl?: string;
  duration?: number;
}): Promise<ActionResult<{ id: string; status: string }>> {
  if (!input.prompt.trim()) return { ok: false, message: "Escribe el prompt de la imagen/video." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let status = "processing";
  let externalId: string | null = null;
  let resultUrl: string | null = null;
  let provider = "higgsfield";
  let errorMsg: string | null = null;

  if (higgsfieldAvailable()) {
    try {
      const { externalId: eid } = await submitGeneration({
        kind: input.kind,
        prompt: input.prompt.trim(),
        imageUrl: input.imageUrl,
        duration: input.duration,
      });
      externalId = eid;
      status = "processing";
    } catch (e) {
      status = "failed";
      errorMsg = e instanceof Error ? e.message : "Error al enviar a Higgsfield.";
    }
  } else {
    // Sin llave: entrega inmediata en modo mock para que el flujo funcione.
    provider = "mock";
    status = "completed";
    resultUrl = mockAsset(input.kind, input.prompt.trim());
  }

  const { data, error } = await supabase
    .from("video_generations")
    .insert({
      project_id: input.projectId,
      kind: input.kind,
      prompt: input.prompt.trim(),
      status,
      provider,
      external_id: externalId,
      result_url: resultUrl,
      error: errorMsg,
      params: { image_url: input.imageUrl ?? null, duration: input.duration ?? null },
      created_by: user?.id ?? null,
    })
    .select("id, status")
    .single();
  if (error || !data) return { ok: false, message: "No se pudo registrar la generación." };

  revalidatePath(`${PROD_PATH}/${input.projectId}`);
  return { ok: true, message: provider === "mock" ? "Generado (mock)." : "Enviado a Higgsfield.", data: { id: data.id, status: data.status } };
}

/** Sondea el estado de una generación en Higgsfield y actualiza la fila. */
export async function checkVisual(
  generationId: string,
): Promise<ActionResult<{ status: string; result_url: string | null }>> {
  const supabase = await createClient();
  const { data: gen } = await supabase
    .from("video_generations")
    .select("id, project_id, status, provider, external_id")
    .eq("id", generationId)
    .maybeSingle();
  if (!gen) return { ok: false, message: "Generación no encontrada." };

  // Terminales o mock: nada que sondear.
  if (gen.status === "completed" || gen.status === "failed" || gen.provider !== "higgsfield" || !gen.external_id) {
    return { ok: true, message: "Estado actual.", data: { status: gen.status, result_url: null } };
  }

  try {
    const state = await getGeneration(gen.external_id);
    const patch: Record<string, unknown> = { status: state.status };
    if (state.resultUrl) patch.result_url = state.resultUrl;
    if (state.error) patch.error = state.error;
    await supabase.from("video_generations").update(patch).eq("id", generationId);
    if (state.status === "completed" || state.status === "failed") {
      revalidatePath(`${PROD_PATH}/${gen.project_id}`);
    }
    return { ok: true, message: "Estado actualizado.", data: { status: state.status, result_url: state.resultUrl ?? null } };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "No se pudo consultar el estado." };
  }
}

/** Marca una generación como portada del proyecto. */
export async function setPortada(generationId: string, projectId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: gen } = await supabase
    .from("video_generations")
    .select("result_url")
    .eq("id", generationId)
    .maybeSingle();
  if (!gen?.result_url) return { ok: false, message: "La generación aún no tiene resultado." };

  await supabase.from("video_generations").update({ is_portada: false }).eq("project_id", projectId);
  await supabase.from("video_generations").update({ is_portada: true }).eq("id", generationId);
  const { error } = await supabase.from("video_projects").update({ portada_url: gen.result_url }).eq("id", projectId);
  if (error) return { ok: false, message: "No se pudo fijar la portada." };
  revalidatePath(`${PROD_PATH}/${projectId}`);
  return { ok: true, message: "Portada fijada." };
}

export async function deleteGeneration(id: string, projectId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("video_generations").delete().eq("id", id);
  if (error) return { ok: false, message: "No se pudo eliminar." };
  revalidatePath(`${PROD_PATH}/${projectId}`);
  return { ok: true, message: "Generación eliminada." };
}

/* ───────────────── Análisis de viralidad ───────────────── */

interface ViralityJson {
  score?: number;
  veredicto?: string;
  fortalezas?: string[];
  riesgos?: string[];
  recomendaciones?: string[];
}

function parseVirality(text: string): ViralityJson {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as ViralityJson;
  } catch {
    /* ignore */
  }
  return {};
}

export async function analyzeVirality(input: {
  projectId: string;
  target: string; // idea|guion|portada|video
  content: string; // texto o URL a analizar
}): Promise<ActionResult<{ analysis: VideoViralityAnalysis }>> {
  if (!input.content.trim()) return { ok: false, message: "Aporta el contenido a analizar." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isUrl = /^https?:\/\//.test(input.content.trim());

  // ── Camino 1: predictor NATIVO de Higgsfield para videos con URL ──
  if (input.target === "video" && isUrl && viralityPredictorAvailable()) {
    try {
      const metrics = await predictVirality(input.content.trim());
      return await saveNativeVirality(input, metrics, user?.id ?? null);
    } catch {
      /* si el predictor nativo falla, cae al análisis por IA de texto */
    }
  }

  // ── Camino 2: análisis por IA de texto (idea/guión/portada, o fallback) ──
  const system = `${BASE} Tarea: análisis de VIRALIDAD y desempeño potencial de un contenido de video (${input.target}) para redes (TikTok/Reels/Shorts). Evalúa gancho, claridad del mensaje, valor emocional, ritmo y llamado a la acción. Devuelve SOLO un JSON válido con las claves: score (0-100), veredicto (frase corta), fortalezas (array de strings), riesgos (array de strings), recomendaciones (array de strings, acciones concretas para mejorar). No incluyas nada fuera del JSON.`;

  let json: ViralityJson = {};
  let fuente: string;
  try {
    if (aiAvailable()) {
      const out = await generateCompletion(system, input.content.trim(), { temperature: 0.3, maxTokens: 900 });
      json = parseVirality(out);
      fuente = aiProviderName();
    } else {
      json = {
        score: 55,
        veredicto: "Análisis mock (sin clave de IA).",
        fortalezas: ["Tema relevante para la audiencia local."],
        riesgos: ["Falta validar el gancho de los primeros 3 segundos."],
        recomendaciones: ["Conecta una clave de IA para un análisis real.", "Refuerza el CTA final."],
      };
      fuente = "mock";
    }
  } catch {
    json = { score: 50, veredicto: "No se pudo analizar; borrador de respaldo.", recomendaciones: ["Reintenta más tarde."] };
    fuente = "mock-fallback";
  }

  const score = typeof json.score === "number" ? Math.max(0, Math.min(100, Math.round(json.score))) : null;
  const { data, error } = await supabase
    .from("video_virality")
    .insert({
      project_id: input.projectId,
      target: input.target,
      input_ref: input.content.slice(0, 1000),
      score,
      veredicto: json.veredicto ?? null,
      fortalezas: json.fortalezas ?? [],
      riesgos: json.riesgos ?? [],
      recomendaciones: json.recomendaciones ?? [],
      raw: json as Record<string, unknown>,
      fuente,
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false, message: "No se pudo guardar el análisis." };

  revalidatePath(`${PROD_PATH}/${input.projectId}`);
  return { ok: true, message: fuente.startsWith("mock") ? "Analizado (mock)." : `Analizado con ${fuente}.`, data: { analysis: data as VideoViralityAnalysis } };
}

/** Guarda un análisis basado en las métricas NATIVAS de Higgsfield (+ interpretación de IA). */
async function saveNativeVirality(
  input: { projectId: string; target: string; content: string },
  metrics: ViralityMetrics,
  userId: string | null,
): Promise<ActionResult<{ analysis: VideoViralityAnalysis }>> {
  const supabase = await createClient();

  const parts: string[] = [];
  if (metrics.score !== null) parts.push(`Viral Potential Score: ${metrics.score}/100`);
  if (metrics.hookScore !== null) parts.push(`Hook Score: ${metrics.hookScore}/100`);
  if (metrics.holdRate !== null) parts.push(`Hold Rate: ${metrics.holdRate}%`);
  const resumenMetricas = parts.join(" · ") || "Métricas no disponibles";

  let fortalezas: string[] = [];
  let riesgos: string[] = [];
  let recomendaciones: string[] = [];
  let fuente = "higgsfield";

  if (aiAvailable()) {
    const sys = `${BASE} Tarea: interpreta las MÉTRICAS del predictor de viralidad de Higgsfield para un video corto. Devuelve SOLO un JSON válido con: fortalezas (array de strings), riesgos (array de strings), recomendaciones (array de acciones concretas para subir el hook y el hold rate). No incluyas nada fuera del JSON.`;
    try {
      const out = await generateCompletion(sys, `Métricas: ${resumenMetricas}`, { temperature: 0.3, maxTokens: 700 });
      const j = parseVirality(out);
      fortalezas = j.fortalezas ?? [];
      riesgos = j.riesgos ?? [];
      recomendaciones = j.recomendaciones ?? [];
      fuente = `higgsfield+${aiProviderName()}`;
    } catch {
      /* conserva el score nativo aunque la interpretación IA falle */
    }
  }

  const veredicto =
    metrics.score === null ? "Análisis de Higgsfield"
    : metrics.score >= 70 ? "Alto potencial viral"
    : metrics.score >= 45 ? "Potencial medio; hay margen de mejora"
    : "Bajo potencial; conviene reforzar el gancho";

  const raw: Record<string, unknown> = {
    ...metrics.raw,
    metricas: { score: metrics.score, hook_score: metrics.hookScore, hold_rate: metrics.holdRate },
    heatmap_url: metrics.heatmapUrl ?? null,
  };

  const { data, error } = await supabase
    .from("video_virality")
    .insert({
      project_id: input.projectId,
      target: input.target,
      input_ref: input.content.slice(0, 1000),
      score: metrics.score,
      veredicto,
      fortalezas,
      riesgos,
      recomendaciones,
      raw,
      fuente,
      created_by: userId,
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false, message: "No se pudo guardar el análisis nativo." };

  revalidatePath(`${PROD_PATH}/${input.projectId}`);
  return { ok: true, message: `Analizado con ${fuente}.`, data: { analysis: data as VideoViralityAnalysis } };
}

export async function deleteVirality(id: string, projectId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("video_virality").delete().eq("id", id);
  if (error) return { ok: false, message: "No se pudo eliminar." };
  revalidatePath(`${PROD_PATH}/${projectId}`);
  return { ok: true, message: "Análisis eliminado." };
}

/* ───────────────── Estado de integraciones (para la UI) ───────────────── */

export async function getStudioStatus(): Promise<{
  ai: boolean;
  aiProvider: string;
  higgsfield: boolean;
  search: boolean;
}> {
  return {
    ai: aiAvailable(),
    aiProvider: aiProviderName(),
    higgsfield: higgsfieldAvailable(),
    search: searchAvailable(),
  };
}

/* ───────────────── util interna ───────────────── */

async function logAi(kind: string, input: string, output: string, fuente: string, projectId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("ai_logs").insert({
        user_id: user.id,
        tarea_ia: `produccion_${kind}`,
        prompt: input.slice(0, 2000),
        resultado: output.slice(0, 4000),
        estado: "generado",
        fuente,
      });
    }
    void projectId;
  } catch {
    /* ai_logs puede no existir; ignorar */
  }
}
