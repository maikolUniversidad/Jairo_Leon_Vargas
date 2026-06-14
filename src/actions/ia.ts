"use server";

import { createClient } from "@/lib/supabase/server";
import { generateCompletion, aiAvailable, aiProviderName } from "@/lib/ai";
import { type ActionResult } from "./types";

export type IaTask =
  | "copy_politico"
  | "resumen_solicitudes"
  | "clasificar_caso"
  | "generar_acta"
  | "generar_comunicado"
  | "resumen_territorial"
  | "buscar_documentos";

/** Contexto común: human-in-the-loop, sin inventar hechos, tono del proyecto. */
const BASE =
  "Eres un asistente del equipo de Jairo León Vargas (Pacto Histórico / Colombia Humana, Bogotá). " +
  "Tono cercano, popular, respetuoso y no confrontacional. " +
  "REGLAS: produce SIEMPRE un BORRADOR para revisión humana; NUNCA inventes hechos, cifras, nombres ni promesas; " +
  "si falta información, indícalo explícitamente; responde en español de Colombia.";

const SYSTEM: Record<IaTask, string> = {
  copy_politico:
    `${BASE} Tarea: redactar copys para redes/comunidad. Devuelve 2-3 variantes cortas con hashtags pertinentes.`,
  resumen_solicitudes:
    `${BASE} Tarea: resumir una o varias solicitudes ciudadanas en máximo 120 palabras, extrayendo tema, localidad/barrio y urgencia si aparecen.`,
  clasificar_caso:
    `${BASE} Tarea: clasificar la solicitud. Devuelve SOLO un JSON válido con las claves: categoria (servicio|propuesta|agenda|prensa|peticion_formal|otro), urgencia (baja|media|alta), localidad, barrio, tema, responsable_sugerido, faltantes (array).`,
  generar_acta:
    `${BASE} Tarea: redactar un acta de reunión con secciones: Asistentes, Temas tratados, Acuerdos/Compromisos (con responsable), Próximos pasos. Marca como [pendiente] lo que no esté en la entrada.`,
  generar_comunicado:
    `${BASE} Tarea: redactar un comunicado con Titular y Cuerpo (3-4 párrafos). Cierra recordando que requiere aprobación de Comunicaciones antes de publicar.`,
  resumen_territorial:
    `${BASE} Tarea: construir un brief territorial por zona: problemas recurrentes (agrupados), compromisos vencidos, y 3 acciones de corto plazo. Marca claramente cualquier inferencia.`,
  buscar_documentos:
    `${BASE} Tarea: a partir de la consulta, sugiere términos de búsqueda y qué documentos/fuentes del corpus aprobado revisar. Aclara que no tienes acceso al índice real todavía.`,
};

/** Plantillas de respaldo (cuando no hay clave de IA o la API falla). */
const MOCK: Record<IaTask, (i: string) => string> = {
  copy_politico: (i) =>
    `📣 (BORRADOR mock · revisión humana)\n"${i}"\n— Una voz desde el territorio para construir con la gente. #Bogotá`,
  resumen_solicitudes: (i) => `🧾 Resumen (mock):\n${i.slice(0, 200)}...`,
  clasificar_caso: (i) =>
    `{ "categoria": "servicio", "urgencia": "media", "tema": "${i.slice(0, 40)}", "faltantes": [] }`,
  generar_acta: (i) => `📄 Acta (mock):\nTemas: ${i.slice(0, 120)}...\nCompromisos: [pendiente]`,
  generar_comunicado: (i) => `📰 Comunicado (mock):\nTitular: ${i.slice(0, 80)}\nCuerpo: [pendiente]`,
  resumen_territorial: (i) => `🗺️ Brief (mock): ${i.slice(0, 80)}\n• Problemas\n• Compromisos\n• Acciones`,
  buscar_documentos: (i) => `🔎 (mock) Búsqueda: "${i}". Índice no conectado.`,
};

/**
 * Ejecuta una tarea de IA con el proveedor configurado (DeepSeek/OpenAI).
 * Si no hay clave o la API falla, cae a una plantilla mock. Registra en ai_logs.
 * Regla del proyecto: NUNCA publicación automática; toda salida es borrador.
 */
export async function runAiTask(
  task: IaTask,
  input: string,
): Promise<ActionResult<{ output: string; fuente: string }>> {
  if (!input.trim()) return { ok: false, message: "Escribe una entrada." };

  let output: string;
  let fuente: string;

  try {
    if (aiAvailable()) {
      output = await generateCompletion(SYSTEM[task], input.trim(), {
        temperature: task === "clasificar_caso" ? 0.1 : 0.6,
      });
      fuente = aiProviderName();
    } else {
      output = MOCK[task](input.trim());
      fuente = "mock";
    }
  } catch {
    output = MOCK[task](input.trim());
    fuente = "mock-fallback";
  }

  // Log best-effort (no bloquea la respuesta).
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("ai_logs").insert({
        user_id: user.id,
        tarea_ia: task,
        prompt: input.slice(0, 2000),
        resultado: output.slice(0, 4000),
        estado: "generado",
        fuente,
      });
    }
  } catch {
    /* ai_logs puede no existir aún; ignorar */
  }

  const message =
    fuente === "mock"
      ? "Generado (mock · sin clave de IA)."
      : fuente === "mock-fallback"
        ? "La IA falló; se mostró un borrador de respaldo."
        : `Generado con ${fuente}.`;

  return { ok: true, message, data: { output, fuente } };
}
