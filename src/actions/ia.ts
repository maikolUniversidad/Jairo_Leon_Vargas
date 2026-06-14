"use server";

import { createClient } from "@/lib/supabase/server";
import { type ActionResult } from "./types";

export type IaTask =
  | "copy_politico"
  | "resumen_solicitudes"
  | "clasificar_caso"
  | "generar_acta"
  | "generar_comunicado"
  | "resumen_territorial"
  | "buscar_documentos";

const PLANTILLAS: Record<IaTask, (input: string) => string> = {
  copy_politico: (i) =>
    `📣 (BORRADOR · revisión humana obligatoria)\n\n"${i}"\n\nVersión sugerida:\n— Una voz desde el territorio para construir con la gente. #${i.split(" ")[0] ?? "Bogotá"}\n\n[Mock] Conecta OPENAI_API_KEY para generación real.`,
  resumen_solicitudes: (i) =>
    `🧾 Resumen (mock):\n${i.slice(0, 200)}...\n\n• Tema principal detectado\n• Localidad / barrio si aplica\n• Urgencia estimada\n\n[Pendiente] Conectar modelo + RAG sobre corpus aprobado.`,
  clasificar_caso: (i) =>
    `🏷️ Clasificación sugerida (mock):\n{ "categoria": "servicio", "urgencia": "media", "responsable_sugerido": "Atención Ciudadana" }\n\nEntrada: ${i.slice(0, 120)}...`,
  generar_acta: (i) =>
    `📄 Acta (borrador mock):\nAsistentes: [pendiente]\nTemas: ${i.slice(0, 120)}...\nCompromisos: [pendiente]\nPróximos pasos: [pendiente]`,
  generar_comunicado: (i) =>
    `📰 Comunicado (borrador mock):\nTitular: ${i.slice(0, 80)}\nCuerpo: [pendiente]\n\nNo publicar sin aprobación de Comunicaciones.`,
  resumen_territorial: (i) =>
    `🗺️ Brief territorial (mock):\nZona: ${i.slice(0, 60)}\n• Problemas recurrentes\n• Compromisos vencidos\n• 3 acciones de corto plazo`,
  buscar_documentos: (i) =>
    `🔎 Búsqueda semántica (mock) para: "${i}"\nNo hay índice conectado. Implementar file_search sobre corpus aprobado.`,
};

/**
 * MOCK de IA. Devuelve texto generado de forma determinista y registra la
 * interacción en ai_logs. Sustituir por una llamada real a OpenAI (server-side)
 * cuando OPENAI_API_KEY esté disponible. Regla: NUNCA publicación automática.
 */
export async function runAiTask(
  task: IaTask,
  input: string,
): Promise<ActionResult<{ output: string }>> {
  if (!input.trim()) return { ok: false, message: "Escribe una entrada." };

  const output = PLANTILLAS[task](input.trim());

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
        fuente: "mock",
      });
    }
  } catch {
    // El log es best-effort; no bloquea la respuesta.
  }

  return { ok: true, message: "Generado (mock).", data: { output } };
}
