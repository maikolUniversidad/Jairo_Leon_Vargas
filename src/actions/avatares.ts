"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { avatarSchema } from "@/lib/validations";
import { aiAvailable, generateCompletion } from "@/lib/ai";
import {
  elevenLabsAvailable,
  listElevenVoices,
  textToSpeech,
  type ElevenVoice,
  type TtsSettings,
} from "@/lib/avatars/elevenlabs";
import { higgsfieldAvailable, submitGeneration } from "@/lib/avatars/higgsfield";
import { uploadBufferToFolder } from "@/lib/google-drive";
import { type ActionResult, zodToFieldErrors } from "./types";
import type { Avatar, AvatarJob, AvatarModel, AvatarJobTipo } from "@/types/database";

const BASE = "/dashboard/comunicaciones/avatares";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/* ───────────────────── Avatares (CRUD) ───────────────────── */

export async function listAvatars(): Promise<(Avatar & { jobs: number })[]> {
  const supabase = await createClient();
  const [{ data: avatars }, { data: jobs }] = await Promise.all([
    supabase.from("avatars").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("avatar_jobs").select("avatar_id"),
  ]);
  const counts = new Map<string, number>();
  for (const j of (jobs as { avatar_id: string }[]) ?? []) {
    counts.set(j.avatar_id, (counts.get(j.avatar_id) ?? 0) + 1);
  }
  return ((avatars as Avatar[]) ?? []).map((a) => ({ ...a, jobs: counts.get(a.id) ?? 0 }));
}

export async function listModels(): Promise<AvatarModel[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("avatar_models")
    .select("*")
    .eq("activo", true)
    .order("orden", { ascending: true });
  return (data as AvatarModel[]) ?? [];
}

export interface AvatarStudioData {
  avatar: Avatar | null;
  jobs: AvatarJob[];
  models: AvatarModel[];
  voices: ElevenVoice[];
  elevenReady: boolean;
  higgsReady: boolean;
  aiReady: boolean;
  insights: { id: string; nombre: string; brief: string | null }[];
}

export async function getAvatarStudio(id: string): Promise<AvatarStudioData> {
  const supabase = await createClient();
  const [{ data: avatar }, { data: jobs }, models, elevenReady, higgsReady, voices, { data: persons }] =
    await Promise.all([
      supabase.from("avatars").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
      supabase.from("avatar_jobs").select("*").eq("avatar_id", id).order("created_at", { ascending: false }).limit(200),
      listModels(),
      elevenLabsAvailable(),
      higgsfieldAvailable(),
      elevenLabsAvailable().then((ok) => (ok ? listElevenVoices() : [])),
      supabase
        .from("monitor_persons")
        .select("id, nombre, ultimo_analisis")
        .is("deleted_at", null)
        .order("nombre")
        .limit(100),
    ]);

  return {
    avatar: (avatar as Avatar) ?? null,
    jobs: (jobs as AvatarJob[]) ?? [],
    models,
    voices,
    elevenReady,
    higgsReady,
    aiReady: aiAvailable(),
    insights: ((persons as { id: string; nombre: string; ultimo_analisis: string | null }[]) ?? []).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      brief: p.ultimo_analisis,
    })),
  };
}

export async function createAvatar(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = avatarSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos.", fieldErrors: zodToFieldErrors(parsed.error) };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión no válida." };

  const slug = `${slugify(v.nombre)}-${Date.now().toString(36).slice(-4)}`;
  const { data, error } = await supabase
    .from("avatars")
    .insert({
      nombre: v.nombre,
      slug,
      arquetipo: v.arquetipo || null,
      descripcion: v.descripcion || null,
      personalidad: v.personalidad || null,
      tono: v.tono || null,
      valores: v.valores ?? [],
      estilo_visual: v.estilo_visual || null,
      voice_provider: v.voice_provider,
      voice_id: v.voice_id || null,
      voice_name: v.voice_name || null,
      modelo_imagen: v.modelo_imagen || null,
      modelo_video: v.modelo_video || null,
      avatar_url: v.avatar_url || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: "No se pudo crear (¿permisos de Comunicaciones?)." };

  revalidatePath(BASE);
  return { ok: true, message: "Avatar creado.", data: { id: data.id } };
}

export async function updateAvatar(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = avatarSchema.partial().safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Datos inválidos." };
  const v = parsed.data;
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) {
    if (val === undefined) continue;
    patch[k] = val === "" ? null : val;
  }
  const { error } = await supabase.from("avatars").update(patch).eq("id", id);
  if (error) return { ok: false, message: "No se pudo actualizar (¿permisos?)." };
  revalidatePath(`${BASE}/${id}`);
  return { ok: true, message: "Avatar actualizado." };
}

export async function deleteAvatar(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("avatars")
    .update({ deleted_at: new Date().toISOString(), activo: false })
    .eq("id", id);
  if (error) return { ok: false, message: "No se pudo eliminar (¿permisos?)." };
  revalidatePath(BASE);
  return { ok: true, message: "Avatar eliminado." };
}

/* ───────────────────── Personalidad con IA ───────────────────── */

export async function generatePersona(input: {
  nombre: string;
  arquetipo?: string;
  brief?: string;
}): Promise<ActionResult<{ personalidad: string; tono: string; valores: string[]; estilo_visual: string }>> {
  if (!aiAvailable()) return { ok: false, message: "No hay proveedor de IA configurado (DeepSeek/OpenAI)." };
  if (!input.nombre?.trim()) return { ok: false, message: "Escribe el nombre del personaje." };

  const system =
    "Eres director creativo de una campaña política progresista en Bogotá (Colombia). Diseñas personajes de marca (voceros digitales) coherentes y creíbles. Responde SOLO con un JSON válido, sin texto adicional.";
  const user =
    `Diseña un personaje de marca para comunicación de campaña.\n` +
    `Nombre: ${input.nombre}\n` +
    (input.arquetipo ? `Arquetipo: ${input.arquetipo}\n` : "") +
    (input.brief ? `Contexto/brief: ${input.brief}\n` : "") +
    `Devuelve exactamente este JSON: {"personalidad": string (2-4 frases, en 2ª persona describiendo al personaje), ` +
    `"tono": string (3-5 adjetivos separados por coma), "valores": string[] (4-6 valores/temas), ` +
    `"estilo_visual": string (descripción del look para un generador de imagen: encuadre, luz, vestuario, fondo)}.`;

  let text: string;
  try {
    text = await generateCompletion(system, user, { maxTokens: 700, temperature: 0.7 });
  } catch (e) {
    return { ok: false, message: `La IA falló: ${(e as Error).message.slice(0, 120)}` };
  }

  try {
    const clean = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const j = JSON.parse(clean) as {
      personalidad?: string;
      tono?: string;
      valores?: string[];
      estilo_visual?: string;
    };
    return {
      ok: true,
      message: "Personalidad generada. Revísala y ajústala.",
      data: {
        personalidad: (j.personalidad ?? "").trim(),
        tono: (j.tono ?? "").trim(),
        valores: Array.isArray(j.valores) ? j.valores.slice(0, 8) : [],
        estilo_visual: (j.estilo_visual ?? "").trim(),
      },
    };
  } catch {
    return { ok: false, message: "La IA no devolvió un formato válido. Intenta de nuevo." };
  }
}

/* ───────────────────── Voz (ElevenLabs, automático) ───────────────────── */

export async function refreshVoices(): Promise<ElevenVoice[]> {
  if (!(await elevenLabsAvailable())) return [];
  return listElevenVoices();
}

export async function generateVoice(
  avatarId: string,
  texto: string,
  opts?: { titulo?: string; settings?: TtsSettings },
): Promise<ActionResult<{ jobId: string; url: string }>> {
  if (!texto?.trim()) return { ok: false, message: "Escribe el texto a locutar." };
  if (!(await elevenLabsAvailable())) {
    return { ok: false, message: "ElevenLabs no está conectado (Configuración → Integraciones)." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión no válida." };

  const { data: avatar } = await supabase
    .from("avatars")
    .select("voice_id, voice_settings")
    .eq("id", avatarId)
    .maybeSingle();
  const voiceId = (avatar as { voice_id: string | null } | null)?.voice_id;
  if (!voiceId) return { ok: false, message: "Asigna una voz al avatar antes de generar audio." };

  let audio: Buffer;
  try {
    const stored = (avatar as { voice_settings?: TtsSettings } | null)?.voice_settings ?? {};
    audio = await textToSpeech(voiceId, texto.trim(), { ...stored, ...(opts?.settings ?? {}) });
  } catch (e) {
    return { ok: false, message: (e as Error).message.slice(0, 160) };
  }

  const admin = createAdminClient();
  const path = `${avatarId}/voz/${Date.now()}.mp3`;
  const { error: upErr } = await admin.storage.from("avatars").upload(path, audio, {
    contentType: "audio/mpeg",
    upsert: true,
  });
  if (upErr) return { ok: false, message: `No se pudo guardar el audio: ${upErr.message}` };
  const url = admin.storage.from("avatars").getPublicUrl(path).data.publicUrl;

  const { data: job, error } = await supabase
    .from("avatar_jobs")
    .insert({
      avatar_id: avatarId,
      tipo: "voz",
      proveedor: "elevenlabs",
      modelo: (opts?.settings?.model as string) || "el-multi-v2",
      titulo: opts?.titulo || "Locución",
      prompt: texto.trim(),
      estado: "listo",
      output_url: url,
      output_meta: { mime: "audio/mpeg", chars: texto.trim().length },
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !job) return { ok: false, message: "Audio generado pero no se pudo registrar el trabajo." };

  revalidatePath(`${BASE}/${avatarId}`);
  return { ok: true, message: "Voz generada.", data: { jobId: job.id, url } };
}

/* ───────────────────── Imagen / Video / 3D (híbrido) ───────────────────── */

export async function createGenerationJob(input: {
  avatar_id: string;
  tipo: AvatarJobTipo; // imagen|video|3d
  modelo?: string;
  titulo?: string;
  prompt: string;
  input_refs?: string[];
  params?: Record<string, unknown>;
  person_id?: string;
}): Promise<ActionResult<{ jobId: string; estado: string }>> {
  if (!input.prompt?.trim()) return { ok: false, message: "Escribe el prompt de generación." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión no válida." };

  // Intenta la API de Higgsfield; si no hay, queda pendiente (asistido).
  const gen = await submitGeneration({
    tipo: input.tipo === "voz" ? "imagen" : input.tipo,
    modelo: input.modelo,
    prompt: input.prompt.trim(),
    inputRefs: input.input_refs,
    params: input.params,
  });

  const estado = gen.done ? "listo" : gen.ok ? "procesando" : "pendiente";

  const { data: job, error } = await supabase
    .from("avatar_jobs")
    .insert({
      avatar_id: input.avatar_id,
      tipo: input.tipo,
      proveedor: "higgsfield",
      modelo: input.modelo || null,
      titulo: input.titulo || null,
      prompt: input.prompt.trim(),
      input_refs: input.input_refs ?? [],
      params: input.params ?? {},
      estado,
      provider_job_id: gen.providerJobId || null,
      output_url: gen.outputUrl || null,
      error_msg: gen.ok ? null : gen.message || null,
      person_id: input.person_id || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !job) return { ok: false, message: "No se pudo crear el trabajo (¿permisos?)." };

  revalidatePath(`${BASE}/${input.avatar_id}`);
  const msg = gen.done
    ? "Contenido generado."
    : gen.ok
      ? "Generación encolada en Higgsfield."
      : "Trabajo creado como pendiente (se completará de forma asistida).";
  return { ok: true, message: msg, data: { jobId: job.id, estado } };
}

/** Marca un trabajo como listo con la URL del asset (completado asistido/manual). */
export async function completeJob(
  jobId: string,
  avatarId: string,
  outputUrl: string,
  meta?: Record<string, unknown>,
): Promise<ActionResult> {
  if (!outputUrl?.trim()) return { ok: false, message: "Falta la URL del asset." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("avatar_jobs")
    .update({
      estado: "listo",
      output_url: outputUrl.trim(),
      output_meta: meta ?? {},
      error_msg: null,
    })
    .eq("id", jobId);
  if (error) return { ok: false, message: "No se pudo actualizar el trabajo." };
  revalidatePath(`${BASE}/${avatarId}`);
  return { ok: true, message: "Trabajo marcado como listo." };
}

export async function deleteJob(jobId: string, avatarId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("avatar_jobs").delete().eq("id", jobId);
  if (error) return { ok: false, message: "No se pudo eliminar." };
  revalidatePath(`${BASE}/${avatarId}`);
  return { ok: true, message: "Trabajo eliminado." };
}

/* ───────────────────── Integración con herramientas de Comunicaciones ───────────────────── */

async function getJobOutput(jobId: string): Promise<{ url: string; tipo: string; titulo: string | null; avatar_id: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("avatar_jobs")
    .select("output_url, tipo, titulo, avatar_id")
    .eq("id", jobId)
    .maybeSingle();
  const j = data as { output_url: string | null; tipo: string; titulo: string | null; avatar_id: string } | null;
  if (!j?.output_url) return null;
  return { url: j.output_url, tipo: j.tipo, titulo: j.titulo, avatar_id: j.avatar_id };
}

/** Crea (o actualiza) una publicación usando el asset del trabajo como imagen. */
export async function attachJobToPost(
  jobId: string,
  input: { titulo: string; postId?: string },
): Promise<ActionResult<{ postId: string }>> {
  const job = await getJobOutput(jobId);
  if (!job) return { ok: false, message: "El trabajo no tiene un asset listo." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (input.postId) {
    const { error } = await supabase.from("content_posts").update({ imagen_url: job.url }).eq("id", input.postId);
    if (error) return { ok: false, message: "No se pudo adjuntar a la publicación." };
    await supabase.from("avatar_jobs").update({ post_id: input.postId }).eq("id", jobId);
    revalidatePath("/dashboard/comunicaciones/publicaciones");
    return { ok: true, message: "Adjuntado a la publicación.", data: { postId: input.postId } };
  }

  const titulo = input.titulo?.trim() || job.titulo || "Pieza de avatar";
  const slug = `${slugify(titulo)}-${Date.now().toString(36).slice(-4)}`;
  const { data, error } = await supabase
    .from("content_posts")
    .insert({
      titulo,
      slug,
      tipo: job.tipo === "video" ? "video" : "pieza",
      imagen_url: job.url,
      estado: "borrador",
      visibilidad: "interna",
      contexto_operativo: "comunicacional",
      autor_id: user?.id ?? null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: "No se pudo crear la publicación (¿permisos?)." };
  await supabase.from("avatar_jobs").update({ post_id: data.id }).eq("id", jobId);
  revalidatePath("/dashboard/comunicaciones/publicaciones");
  return { ok: true, message: "Publicación creada en borrador con el asset.", data: { postId: data.id } };
}

/** Programa el asset del trabajo en el calendario editorial. */
export async function scheduleJobInCalendar(
  jobId: string,
  input: { titulo: string; canal: string; fecha_programada: string },
): Promise<ActionResult> {
  const job = await getJobOutput(jobId);
  if (!job) return { ok: false, message: "El trabajo no tiene un asset listo." };
  if (!input.canal?.trim() || !input.fecha_programada) {
    return { ok: false, message: "Indica canal y fecha." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("content_calendar").insert({
    titulo: input.titulo?.trim() || job.titulo || "Pieza de avatar",
    canal: input.canal.trim(),
    fecha_programada: input.fecha_programada,
    estado: "programado",
    responsable_id: user?.id || null,
  });
  if (error) return { ok: false, message: "No se pudo programar (¿permisos?)." };
  revalidatePath("/dashboard/comunicaciones/calendario");
  return { ok: true, message: "Pieza programada en el calendario." };
}

/** Sube el asset del trabajo a la carpeta de Drive de una cobertura. */
export async function attachJobToCobertura(
  jobId: string,
  coberturaId: string,
  fase: "crudo" | "editado" | "aprobado",
): Promise<ActionResult> {
  const job = await getJobOutput(jobId);
  if (!job) return { ok: false, message: "El trabajo no tiene un asset listo." };
  const supabase = await createClient();

  const { data: cob } = await supabase
    .from("coberturas")
    .select("drive_crudo_id, drive_editado_id, drive_aprobado_id")
    .eq("id", coberturaId)
    .maybeSingle();
  const c = cob as { drive_crudo_id: string | null; drive_editado_id: string | null; drive_aprobado_id: string | null } | null;
  const folderId = fase === "crudo" ? c?.drive_crudo_id : fase === "editado" ? c?.drive_editado_id : c?.drive_aprobado_id;
  if (!folderId) return { ok: false, message: "La cobertura no tiene carpeta de Drive para esa fase." };

  // Descarga el asset y súbelo a Drive.
  let buffer: Buffer;
  let mime = "application/octet-stream";
  try {
    const res = await fetch(job.url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) return { ok: false, message: `No se pudo descargar el asset (${res.status}).` };
    mime = res.headers.get("content-type") || mime;
    buffer = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    return { ok: false, message: `Error descargando el asset: ${(e as Error).message.slice(0, 120)}` };
  }

  const ext = job.tipo === "voz" ? "mp3" : job.tipo === "video" ? "mp4" : "png";
  const name = `${(job.titulo || "avatar").replace(/[^a-zA-Z0-9._-]/g, "_")}-${Date.now()}.${ext}`;
  const up = await uploadBufferToFolder({ folderId, name, mime, buffer });
  if (!up) return { ok: false, message: "Google Drive no está conectado o no se pudo subir." };

  await supabase.from("avatar_jobs").update({ cobertura_id: coberturaId, drive_file_id: up.id }).eq("id", jobId);
  revalidatePath(`/dashboard/comunicaciones/coberturas/${coberturaId}`);
  return { ok: true, message: "Asset subido a la cobertura en Drive." };
}

/** Coberturas disponibles (para el selector de adjuntar). */
export async function listCoberturasLite(): Promise<{ id: string; nombre: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coberturas")
    .select("id, nombre")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data as { id: string; nombre: string }[]) ?? [];
}
