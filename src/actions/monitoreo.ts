"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getSourcesStatus } from "@/lib/monitoring/collectors";
import { runCollectionFor } from "@/lib/monitoring/run";
import { aiAvailable, generateCompletion } from "@/lib/ai";
import { type ActionResult } from "./types";
import type { MonitorPerson, MonitorItem, MonitorRun, MonitorRelacion } from "@/types/database";

const RELACIONES: MonitorRelacion[] = ["propio", "aliado", "contraposicion", "neutral", "objetivo"];

/* ───────────────────── Personas ───────────────────── */

export async function listPersons(): Promise<(MonitorPerson & { items: number })[]> {
  const supabase = await createClient();
  const [{ data: persons }, { data: items }] = await Promise.all([
    supabase.from("monitor_persons").select("*").is("deleted_at", null).order("created_at"),
    supabase.from("monitor_items").select("person_id"),
  ]);
  const counts = new Map<string, number>();
  for (const it of (items as { person_id: string }[]) ?? []) {
    counts.set(it.person_id, (counts.get(it.person_id) ?? 0) + 1);
  }
  return ((persons as MonitorPerson[]) ?? []).map((p) => ({ ...p, items: counts.get(p.id) ?? 0 }));
}

export async function createPerson(input: {
  nombre: string;
  relacion?: string;
  cargo?: string;
  partido?: string;
  keywords?: string[];
  etiquetas?: string[];
  handles?: Record<string, string>;
}): Promise<ActionResult<{ id: string }>> {
  if (!input.nombre?.trim() || input.nombre.trim().length < 2) {
    return { ok: false, message: "Escribe el nombre de la persona." };
  }
  const relacion = (RELACIONES as string[]).includes(input.relacion ?? "")
    ? (input.relacion as MonitorRelacion)
    : "objetivo";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión no válida." };

  const kws = input.keywords?.length ? input.keywords : [input.nombre.trim()];
  const { data, error } = await supabase
    .from("monitor_persons")
    .insert({
      nombre: input.nombre.trim(),
      relacion,
      cargo: input.cargo?.trim() || null,
      partido: input.partido?.trim() || null,
      keywords: kws,
      etiquetas: input.etiquetas ?? [],
      handles: input.handles ?? {},
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: "No se pudo crear (¿permisos de Comunicaciones?)." };

  revalidatePath("/dashboard/comunicaciones/monitoreo");
  return { ok: true, message: "Persona agregada al monitoreo.", data: { id: data.id } };
}

export async function updatePerson(
  id: string,
  patch: {
    relacion?: string;
    cargo?: string;
    partido?: string;
    keywords?: string[];
    etiquetas?: string[];
    handles?: Record<string, string>;
    notas?: string;
  },
): Promise<ActionResult> {
  const supabase = await createClient();
  const upd: Record<string, unknown> = {};
  if (patch.relacion && (RELACIONES as string[]).includes(patch.relacion)) upd.relacion = patch.relacion;
  if (patch.cargo !== undefined) upd.cargo = patch.cargo.trim() || null;
  if (patch.partido !== undefined) upd.partido = patch.partido.trim() || null;
  if (patch.keywords !== undefined) upd.keywords = patch.keywords;
  if (patch.etiquetas !== undefined) upd.etiquetas = patch.etiquetas;
  if (patch.handles !== undefined) upd.handles = patch.handles;
  if (patch.notas !== undefined) upd.notas = patch.notas.trim() || null;

  const { error } = await supabase.from("monitor_persons").update(upd).eq("id", id);
  if (error) return { ok: false, message: "No se pudo actualizar (¿permisos?)." };
  revalidatePath(`/dashboard/comunicaciones/monitoreo/${id}`);
  return { ok: true, message: "Ficha actualizada." };
}

export async function deletePerson(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("monitor_persons")
    .update({ deleted_at: new Date().toISOString(), activo: false })
    .eq("id", id);
  if (error) return { ok: false, message: "No se pudo eliminar (¿permisos?)." };
  revalidatePath("/dashboard/comunicaciones/monitoreo");
  return { ok: true, message: "Persona retirada del monitoreo." };
}

/* ───────────────────── Expediente + recolección ───────────────────── */

export async function getPersonDossier(id: string): Promise<{
  person: MonitorPerson | null;
  items: MonitorItem[];
  runs: MonitorRun[];
  sources: { fuente: string; label: string; configurado: boolean }[];
}> {
  const supabase = await createClient();
  const [{ data: person }, { data: items }, { data: runs }, sources] = await Promise.all([
    supabase.from("monitor_persons").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("monitor_items")
      .select("*")
      .eq("person_id", id)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(300),
    supabase
      .from("monitor_runs")
      .select("*")
      .eq("person_id", id)
      .order("created_at", { ascending: false })
      .limit(40),
    getSourcesStatus(),
  ]);
  return {
    person: (person as MonitorPerson) ?? null,
    items: (items as MonitorItem[]) ?? [],
    runs: (runs as MonitorRun[]) ?? [],
    sources,
  };
}

/** Dispara la recolección de menciones de una persona (todas las fuentes). */
export async function runCollection(
  personId: string,
): Promise<ActionResult<{ inserted: number; perSource: Record<string, string> }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión no válida." };

  const { data: person } = await supabase
    .from("monitor_persons")
    .select("id, nombre, alias, keywords, handles")
    .eq("id", personId)
    .maybeSingle();
  if (!person) return { ok: false, message: "Persona no encontrada." };

  const p = person as Pick<MonitorPerson, "id" | "nombre" | "alias" | "keywords" | "handles">;
  const { inserted, perSource } = await runCollectionFor(supabase, p, user.id);

  revalidatePath(`/dashboard/comunicaciones/monitoreo/${personId}`);
  return {
    ok: true,
    message: `Recolección lista: ${inserted} menciones nuevas.`,
    data: { inserted, perSource },
  };
}

/** Barrido general: búsqueda amplia/histórica (más consultas por fuente). */
export async function runSweep(
  personId: string,
): Promise<ActionResult<{ inserted: number; perSource: Record<string, string> }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión no válida." };

  const { data: person } = await supabase
    .from("monitor_persons")
    .select("id, nombre, alias, keywords, handles")
    .eq("id", personId)
    .maybeSingle();
  if (!person) return { ok: false, message: "Persona no encontrada." };

  const p = person as Pick<MonitorPerson, "id" | "nombre" | "alias" | "keywords" | "handles">;
  const { inserted, perSource } = await runCollectionFor(supabase, p, user.id, "sweep");

  revalidatePath(`/dashboard/comunicaciones/monitoreo/${personId}`);
  return {
    ok: true,
    message: `Barrido general listo: ${inserted} menciones nuevas.`,
    data: { inserted, perSource },
  };
}

/** Programa (o desactiva) la recolección automática de una persona. */
export async function updateSchedule(
  personId: string,
  input: { auto_activo: boolean; auto_frecuencia: string; auto_hora: number },
): Promise<ActionResult> {
  const FRECS = ["manual", "cada_hora", "cada_6h", "cada_12h", "diario"];
  const frec = FRECS.includes(input.auto_frecuencia) ? input.auto_frecuencia : "manual";
  const hora = Math.min(23, Math.max(0, Math.round(input.auto_hora)));
  const supabase = await createClient();
  const { error } = await supabase
    .from("monitor_persons")
    .update({ auto_activo: input.auto_activo && frec !== "manual", auto_frecuencia: frec, auto_hora: hora })
    .eq("id", personId);
  if (error) return { ok: false, message: "No se pudo guardar la programación (¿permisos?)." };
  revalidatePath(`/dashboard/comunicaciones/monitoreo/${personId}`);
  return { ok: true, message: "Programación guardada." };
}

export async function addManualItem(input: {
  person_id: string;
  fuente: string;
  titulo: string;
  url?: string;
  contenido?: string;
  autor?: string;
  published_at?: string;
}): Promise<ActionResult> {
  if (!input.titulo?.trim()) return { ok: false, message: "Escribe un título." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("monitor_items").insert({
    person_id: input.person_id,
    fuente: input.fuente || "manual",
    tipo: input.fuente === "x" ? "post" : "mencion",
    titulo: input.titulo.trim(),
    url: input.url?.trim() || null,
    contenido: input.contenido?.trim() || null,
    autor: input.autor?.trim() || null,
    published_at: input.published_at || null,
    created_by: user?.id ?? null,
  });
  if (error) return { ok: false, message: "No se pudo agregar (¿permisos?)." };
  revalidatePath(`/dashboard/comunicaciones/monitoreo/${input.person_id}`);
  return { ok: true, message: "Mención agregada." };
}

export async function deleteItem(id: string, personId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("monitor_items").delete().eq("id", id);
  if (error) return { ok: false, message: "No se pudo eliminar." };
  revalidatePath(`/dashboard/comunicaciones/monitoreo/${personId}`);
  return { ok: true, message: "Mención eliminada." };
}

/* ───────────────────── Análisis por mención ───────────────────── */

interface ItemAnalysis {
  resumen: string;
  es_directo: boolean;
  sentimiento: "positivo" | "negativo" | "neutral";
  etiquetas: string[];
  analisis: string;
}

function parseAiJson(s: string): Record<string, unknown> | null {
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Analiza UNA mención: resumen, si es directa, sentimiento y etiquetas. */
export async function analyzeItem(itemId: string): Promise<ActionResult<ItemAnalysis>> {
  if (!aiAvailable()) return { ok: false, message: "No hay proveedor de IA configurado." };
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("monitor_items")
    .select("id, person_id, fuente, titulo, contenido, autor")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return { ok: false, message: "Mención no encontrada." };
  const it = item as { id: string; person_id: string; fuente: string; titulo: string; contenido: string | null; autor: string | null };

  const { data: person } = await supabase
    .from("monitor_persons")
    .select("nombre, relacion, cargo")
    .eq("id", it.person_id)
    .maybeSingle();
  const pn = (person as { nombre: string; relacion: string; cargo: string | null } | null) ?? { nombre: "la persona", relacion: "objetivo", cargo: null };

  const system =
    "Eres analista de medios en Colombia. Analiza UNA mención sobre una persona y responde ÚNICAMENTE un JSON válido (sin texto extra, sin ```), con esta forma: " +
    `{"resumen": string (2-3 frases claras), "directo": boolean (true si la mención habla directamente de la persona; false si solo menciona su partido/entorno), ` +
    `"sentimiento": "positivo"|"negativo"|"neutral" (hacia la persona), "etiquetas": string[] (2 a 5 temas cortos, p. ej. "corrupción","elecciones"), ` +
    `"analisis": string (2-4 frases con el enfoque para nuestra campaña, que es OPOSICIÓN)}.`;
  const user =
    `Persona: ${pn.nombre}${pn.cargo ? ` (${pn.cargo})` : ""}. Relación con nosotros: ${pn.relacion}.\n` +
    `Fuente: ${it.fuente}. ${it.autor ? `Medio/autor: ${it.autor}. ` : ""}\n` +
    `Titular: ${it.titulo}\n${it.contenido ? `Texto: ${it.contenido.slice(0, 600)}` : ""}`;

  let raw: string;
  try {
    raw = await generateCompletion(system, user, { maxTokens: 500, temperature: 0.3 });
  } catch (e) {
    return { ok: false, message: `La IA falló: ${(e as Error).message.slice(0, 100)}` };
  }
  const j = parseAiJson(raw);
  if (!j) return { ok: false, message: "La IA no devolvió un análisis legible." };

  const sent = ["positivo", "negativo", "neutral"].includes(String(j.sentimiento))
    ? (j.sentimiento as ItemAnalysis["sentimiento"])
    : "neutral";
  const analysis: ItemAnalysis = {
    resumen: typeof j.resumen === "string" ? j.resumen : "",
    es_directo: Boolean(j.directo),
    sentimiento: sent,
    etiquetas: Array.isArray(j.etiquetas) ? j.etiquetas.map(String).slice(0, 6) : [],
    analisis: typeof j.analisis === "string" ? j.analisis : "",
  };

  await supabase
    .from("monitor_items")
    .update({
      resumen: analysis.resumen || null,
      es_directo: analysis.es_directo,
      sentimiento: analysis.sentimiento,
      etiquetas: analysis.etiquetas,
      analisis: analysis.analisis || null,
      analizado_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  revalidatePath(`/dashboard/comunicaciones/monitoreo/${it.person_id}`);
  return { ok: true, message: "Mención analizada.", data: analysis };
}

/** Analiza en lote las menciones aún sin análisis (hasta `limit`). */
export async function analyzeNewItems(
  personId: string,
  limit = 10,
): Promise<ActionResult<{ analizadas: number }>> {
  if (!aiAvailable()) return { ok: false, message: "No hay proveedor de IA configurado." };
  const supabase = await createClient();
  const { data: pend } = await supabase
    .from("monitor_items")
    .select("id")
    .eq("person_id", personId)
    .is("analizado_at", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  const ids = ((pend as { id: string }[]) ?? []).map((r) => r.id);
  let done = 0;
  for (const id of ids) {
    const res = await analyzeItem(id);
    if (res.ok) done++;
  }
  revalidatePath(`/dashboard/comunicaciones/monitoreo/${personId}`);
  return {
    ok: true,
    message: done ? `${done} menciones analizadas.` : "No había menciones pendientes.",
    data: { analizadas: done },
  };
}

/** Analiza con IA lo recolectado y guarda un brief de inteligencia. */
export async function analyzePerson(personId: string): Promise<ActionResult<{ brief: string }>> {
  if (!aiAvailable()) {
    return { ok: false, message: "No hay proveedor de IA configurado (DeepSeek/OpenAI)." };
  }
  const supabase = await createClient();
  const { data: person } = await supabase
    .from("monitor_persons")
    .select("nombre, relacion, cargo, partido")
    .eq("id", personId)
    .maybeSingle();
  if (!person) return { ok: false, message: "Persona no encontrada." };

  const { data: items } = await supabase
    .from("monitor_items")
    .select("titulo, autor, fuente, url, published_at")
    .eq("person_id", personId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(60);

  const rows = (items as { titulo: string; autor: string | null; fuente: string; url: string | null; published_at: string | null }[]) ?? [];
  const list = rows
    .map((i, n) => `${n + 1}. [${i.fuente}] ${i.titulo}${i.autor ? ` — ${i.autor}` : ""}${i.url ? ` (${i.url})` : ""}`)
    .join("\n");
  if (!list) return { ok: false, message: "No hay menciones para analizar. Recolecta primero." };

  const p = person as { nombre: string; relacion: string; cargo: string | null; partido: string | null };
  const system =
    "Eres analista de comunicación política en Colombia. A partir de titulares y menciones, produce un BRIEF ejecutivo claro y accionable, SIN inventar datos que no estén en las menciones.\n" +
    "Responde en MARKDOWN bien formateado: usa encabezados '## ' para cada sección, viñetas '- ' y negritas '**' para lo clave. " +
    "Cuando cites un hecho, enlaza la fuente en formato [medio](url) usando las URLs provistas. " +
    "Cierra SIEMPRE con una sección '## Referencias' que liste de 4 a 6 enlaces más relevantes como '- [Titular](url)'.";
  const user =
    `Persona: ${p.nombre}${p.cargo ? ` (${p.cargo})` : ""}${p.partido ? `, ${p.partido}` : ""}. ` +
    `Relación con nuestra campaña (somos oposición): ${p.relacion}.\n\n` +
    `Menciones recientes (con URL entre paréntesis):\n${list}\n\n` +
    `Estructura el brief con estas secciones (## cada una): ` +
    `1) Temas y narrativas dominantes. 2) Tono general (positivo/negativo/mixto) y por qué. ` +
    `3) Riesgos y oportunidades para nuestra estrategia. 4) Recomendaciones de comunicación (3). 5) Referencias.`;

  let brief: string;
  try {
    brief = await generateCompletion(system, user, { maxTokens: 1500, temperature: 0.4 });
  } catch (e) {
    return { ok: false, message: `La IA falló: ${(e as Error).message.slice(0, 120)}` };
  }

  await supabase
    .from("monitor_persons")
    .update({ ultimo_analisis: brief, analisis_at: new Date().toISOString() })
    .eq("id", personId);
  revalidatePath(`/dashboard/comunicaciones/monitoreo/${personId}`);
  return { ok: true, message: "Análisis generado.", data: { brief } };
}
