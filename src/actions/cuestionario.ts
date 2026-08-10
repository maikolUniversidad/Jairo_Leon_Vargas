"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { extraerDeDictado, extraerFicha as extraerConIA } from "@/lib/ia/extraer-ficha";
import {
  type CampoPregunta,
  type FichaExtraida,
  type Pregunta,
  type Respuesta,
} from "@/lib/cuestionario-shared";
import {
  normalizar,
  resolverPersonas,
  type PersonaConocida,
  type PersonaResuelta,
} from "@/lib/personas-match";
import { type ActionResult } from "./types";

/** Lo que devuelve un dictado: la ficha propuesta y quiénes se nombraron. */
export interface ResultadoDictado {
  ficha: FichaExtraida;
  personas: PersonaResuelta[];
}

/**
 * Todo el mundo con quien se puede emparejar un nombre dicho: usuarios de la
 * plataforma primero, porque son los que identifican al equipo.
 */
async function personasConocidas(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<PersonaConocida[]> {
  const [{ data: perfiles }, { data: contactos }, { data: ciudadanos }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").limit(500),
    supabase.from("contacts").select("id, nombre, apellido").is("deleted_at", null).limit(600),
    supabase.from("citizens").select("id, nombre, apellido").is("deleted_at", null).limit(600),
  ]);

  const out: PersonaConocida[] = [];
  for (const p of (perfiles ?? []) as { id: string; full_name: string | null }[]) {
    const nombre = p.full_name?.trim();
    if (nombre) out.push({ id: p.id, tipo: "usuario", nombre });
  }
  for (const c of (contactos ?? []) as { id: string; nombre: string; apellido: string | null }[]) {
    const nombre = [c.nombre, c.apellido].filter(Boolean).join(" ").trim();
    if (nombre) out.push({ id: c.id, tipo: "contacto", nombre });
  }
  for (const c of (ciudadanos ?? []) as { id: string; nombre: string; apellido: string | null }[]) {
    const nombre = [c.nombre, c.apellido].filter(Boolean).join(" ").trim();
    if (nombre) out.push({ id: c.id, tipo: "ciudadano", nombre });
  }
  return out;
}

/**
 * Cuestionario por voz de la ficha de una cobertura.
 *
 * El avance se guarda respuesta a respuesta, no al terminar: si se cae la
 * conexión o cierran la pestaña a mitad, lo grabado no se pierde.
 */

/** Preguntas activas, en orden. */
export async function listPreguntas(): Promise<Pregunta[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cobertura_preguntas")
    .select("id, pregunta, ayuda, campo, orden, activa, momento")
    .eq("activa", true)
    .order("orden");
  return (data as Pregunta[]) ?? [];
}

/** Lo ya respondido en una cobertura. */
export async function getRespuestas(coberturaId: string): Promise<Respuesta[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cobertura_respuestas")
    .select("pregunta_id, transcripcion, audio_path, duracion_seg, updated_at")
    .eq("cobertura_id", coberturaId);
  return (data as Respuesta[]) ?? [];
}

/**
 * Guarda —o reemplaza— la respuesta a una pregunta.
 * El `unique (cobertura_id, pregunta_id)` de 0036 hace que volver a grabar
 * sustituya en vez de acumular.
 */
export async function guardarRespuesta(input: {
  cobertura_id: string;
  pregunta_id: string;
  transcripcion: string;
  audio_path?: string | null;
  duracion_seg?: number | null;
}): Promise<ActionResult> {
  const texto = input.transcripcion.trim();
  if (!texto) return { ok: false, message: "La respuesta está vacía." };

  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Sesión no válida." };

  const supabase = await createClient();
  const { error } = await supabase.from("cobertura_respuestas").upsert(
    {
      cobertura_id: input.cobertura_id,
      pregunta_id: input.pregunta_id,
      transcripcion: texto,
      audio_path: input.audio_path ?? null,
      duracion_seg: input.duracion_seg ?? null,
      created_by: user.id,
    },
    { onConflict: "cobertura_id,pregunta_id" },
  );
  if (error) return { ok: false, message: "No se pudo guardar la respuesta." };

  // A propósito SIN revalidatePath: revalidar en medio del cuestionario hace que
  // el server component mande un arreglo de respuestas nuevo, y el diálogo se
  // reinicia justo cuando la persona está avanzando. Se revalida al terminar.
  return { ok: true, message: "Respuesta guardada." };
}

/** Borra una respuesta para volver a grabarla desde cero. */
export async function borrarRespuesta(
  coberturaId: string,
  preguntaId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cobertura_respuestas")
    .delete()
    .eq("cobertura_id", coberturaId)
    .eq("pregunta_id", preguntaId);
  if (error) return { ok: false, message: "No se pudo borrar la respuesta." };

  revalidatePath(`/dashboard/comunicaciones/coberturas/${coberturaId}`);
  return { ok: true, message: "Respuesta borrada." };
}

/**
 * Guarda una grabación corrida y reparte lo dicho entre los campos.
 *
 * Quedan las dos cosas: la transcripción completa sin tocar en
 * `cobertura_dictados`, y lo clasificado por pregunta en `cobertura_respuestas`.
 * Lo primero es el registro de lo que se contó; lo segundo, lo que alimenta la
 * ficha y lo que se revisa campo por campo antes de guardar.
 */
export async function guardarDictado(input: {
  cobertura_id: string;
  transcripcion: string;
  duracion_seg?: number | null;
}): Promise<ActionResult<ResultadoDictado>> {
  const texto = input.transcripcion.trim();
  if (!texto) return { ok: false, message: "No se transcribió nada." };

  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Sesión no válida." };

  const supabase = await createClient();

  // La transcripción se guarda ANTES de llamar a la IA: si el modelo falla o
  // tarda, lo que la persona dijo no se pierde.
  const { error } = await supabase.from("cobertura_dictados").insert({
    cobertura_id: input.cobertura_id,
    transcripcion: texto,
    duracion_seg: input.duracion_seg ?? null,
    created_by: user.id,
  });
  if (error) return { ok: false, message: "No se pudo guardar lo dictado." };

  const preguntas = await listPreguntas();
  if (preguntas.length === 0) {
    return { ok: false, message: "No hay preguntas configuradas." };
  }

  let extraccion: Awaited<ReturnType<typeof extraerDeDictado>>;
  try {
    extraccion = await extraerDeDictado(
      texto,
      preguntas.map((p) => ({ pregunta: p.pregunta, campo: p.campo })),
    );
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "No se pudo repartir lo dictado.",
    };
  }

  const ficha = extraccion.ficha;
  if (Object.keys(ficha).length === 0 && extraccion.personas.length === 0) {
    return { ok: false, message: "La IA no pudo sacar información de lo dictado." };
  }

  // Los nombres dichos se emparejan con quien ya está en la plataforma. No se
  // guardan aún: se proponen en la revisión, porque vincular a la persona
  // equivocada en el registro de una jornada es difícil de detectar después.
  const personas = resolverPersonas(extraccion.personas, await personasConocidas(supabase));

  // Cada campo con contenido se guarda como la respuesta de su pregunta: así el
  // carrusel muestra qué quedó cubierto y qué no se alcanzó a contar.
  const porCampo = new Map(preguntas.map((p) => [p.campo, p.id]));
  const filas = Object.entries(ficha)
    .map(([campo, valor]) => {
      const preguntaId = porCampo.get(campo as CampoPregunta);
      if (!preguntaId || valor === undefined || valor === null) return null;
      const transcripcion = Array.isArray(valor) ? valor.join(", ") : String(valor);
      return transcripcion.trim()
        ? {
            cobertura_id: input.cobertura_id,
            pregunta_id: preguntaId,
            transcripcion,
            created_by: user.id,
          }
        : null;
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  if (filas.length > 0) {
    await supabase
      .from("cobertura_respuestas")
      .upsert(filas, { onConflict: "cobertura_id,pregunta_id" });
  }

  revalidatePath(`/dashboard/comunicaciones/coberturas/${input.cobertura_id}`);
  return { ok: true, message: "Listo. Revisa lo que se entendió.", data: { ficha, personas } };
}

/**
 * Suma a «quiénes estuvieron» las personas nombradas en el dictado.
 *
 * Se llama desde la revisión, con lo que el usuario dejó marcado: nunca de
 * forma automática. Vincular a la persona equivocada en el registro de una
 * jornada es difícil de detectar después.
 */
export async function agregarAsistentesDictados(
  coberturaId: string,
  personas: PersonaResuelta[],
): Promise<ActionResult<{ agregados: number }>> {
  if (personas.length === 0) return { ok: true, message: "Sin personas que agregar.", data: { agregados: 0 } };

  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Sesión no válida." };

  const supabase = await createClient();

  // Ya registrados, para no duplicar a quien se nombró en un dictado anterior.
  const { data: previos } = await supabase
    .from("cobertura_asistentes")
    .select("nombre, user_id, contacto_id, ciudadano_id")
    .eq("cobertura_id", coberturaId);

  const yaEstan = new Set(
    ((previos ?? []) as { nombre: string }[]).map((a) => normalizar(a.nombre)),
  );

  const filas = personas
    .filter((p) => !yaEstan.has(normalizar(p.nombre)))
    .map((p) => ({
      cobertura_id: coberturaId,
      nombre: p.nombre,
      rol: p.rol ?? null,
      organizacion: p.organizacion ?? null,
      vinculo: p.vinculo,
      user_id: p.match?.tipo === "usuario" ? p.match.id : null,
      contacto_id: p.match?.tipo === "contacto" ? p.match.id : null,
      ciudadano_id: p.match?.tipo === "ciudadano" ? p.match.id : null,
      created_by: user.id,
    }));

  if (filas.length === 0) {
    return { ok: true, message: "Ya estaban registrados.", data: { agregados: 0 } };
  }

  const { error } = await supabase.from("cobertura_asistentes").insert(filas);
  if (error) return { ok: false, message: "No se pudieron agregar los asistentes." };

  revalidatePath(`/dashboard/comunicaciones/coberturas/${coberturaId}`);
  return {
    ok: true,
    message: `${filas.length} persona${filas.length === 1 ? "" : "s"} agregada${filas.length === 1 ? "" : "s"}.`,
    data: { agregados: filas.length },
  };
}

/** El dictado más reciente de una cobertura, para poder releerlo. */
export async function ultimoDictado(
  coberturaId: string,
): Promise<{ transcripcion: string; created_at: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cobertura_dictados")
    .select("transcripcion, created_at")
    .eq("cobertura_id", coberturaId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { transcripcion: string; created_at: string } | null) ?? null;
}

/**
 * Manda lo respondido a la IA y devuelve la ficha propuesta.
 *
 * NO escribe nada: lo propuesto pasa por la revisión lado a lado, donde se
 * elige campo por campo. Nada entra a la ficha sin que alguien lo mire.
 */
export async function extraerFicha(
  coberturaId: string,
): Promise<ActionResult<FichaExtraida>> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("cobertura_respuestas")
    .select("transcripcion, cobertura_preguntas(pregunta, campo, orden)")
    .eq("cobertura_id", coberturaId);

  interface PreguntaEmbebida {
    pregunta: string;
    campo: CampoPregunta;
    orden: number;
  }

  // PostgREST devuelve un objeto para una relación a-uno, pero los tipos
  // generados la declaran como arreglo. Se acepta cualquiera de las dos formas.
  const primera = (v: unknown): PreguntaEmbebida | null => {
    const p = Array.isArray(v) ? v[0] : v;
    return p && typeof p === "object" ? (p as PreguntaEmbebida) : null;
  };

  const respuestas = (data ?? [])
    .map((fila) => {
      const f = fila as { transcripcion: string; cobertura_preguntas: unknown };
      const p = primera(f.cobertura_preguntas);
      return p ? { pregunta: p.pregunta, campo: p.campo, transcripcion: f.transcripcion, orden: p.orden } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .map(({ pregunta, campo, transcripcion }) => ({ pregunta, campo, transcripcion }));

  if (respuestas.length === 0) {
    return { ok: false, message: "Todavía no hay respuestas que procesar." };
  }

  try {
    const { ficha } = await extraerConIA(respuestas);
    if (Object.keys(ficha).length === 0) {
      return { ok: false, message: "La IA no pudo sacar información de lo respondido." };
    }
    return { ok: true, message: "Ficha propuesta.", data: ficha };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "No se pudo procesar lo respondido.",
    };
  }
}
