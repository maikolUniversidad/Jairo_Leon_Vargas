import { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { buildPersonaContext, type PersonaTipo } from "@/lib/ia/personaContext";
import { embedQuery, embeddingsAvailable } from "@/lib/ia/embeddings";
import { modeloInfo } from "@/lib/ia/types";
import {
  streamChat,
  completeWithTools,
  resolveProvider,
  type ProviderMessage,
  type ContentPart,
} from "@/lib/ia/provider";
import { getToolDefs, runTool } from "@/lib/ia/dataTools";

export const runtime = "nodejs";

interface AdjuntoApi {
  name: string;
  kind: "image" | "text";
  mime: string;
  dataUrl?: string;
  text?: string;
}
interface MsgIn {
  role: "user" | "assistant";
  content: string;
  attachments?: AdjuntoApi[];
}

const BASE =
  "Eres el Asistente IA del equipo de Jairo León Vargas (Pacto Histórico / Colombia Humana, Bogotá), " +
  "dentro de la plataforma UTL 360. Ayudas con ciudadanos, solicitudes, territorio, comunicaciones y producción de contenido. " +
  "Tono cercano, popular, respetuoso y no confrontacional. Responde en español de Colombia con formato Markdown claro. " +
  "REGLAS: produce borradores para revisión humana; NUNCA inventes hechos, cifras, nombres ni promesas; " +
  "si falta información, dilo. No hay publicación automática.";

const DATA_INSTR =
  "\n\nDATOS DE LA PLATAFORMA: tienes herramientas para consultar datos reales " +
  "(ciudadanos, solicitudes, tareas, agenda, contactos, territorio). Cuando la pregunta dependa de " +
  "cifras o registros de la plataforma, USA las herramientas y responde con los datos reales que " +
  "devuelvan; nunca inventes números. Si una herramienta devuelve 'sin_acceso', explica que ese dato " +
  "está fuera de los permisos del usuario. Para crear una tarea, confirma el título y usa 'crear_tarea' " +
  "solo cuando el usuario lo pida explícitamente.";

const CHART_INSTR =
  "\n\nGRÁFICAS: cuando resumas datos numéricos y una gráfica ayude, incluye un bloque de código con el lenguaje `chart` " +
  "que contenga SOLO un JSON con esta forma: " +
  '{"type":"bar|line|area|pie","title":"...","data":[{...}],"xKey":"campoX","series":[{"key":"campo","name":"Etiqueta"}],"valueKey":"value","nameKey":"name","unidad":"opcional"}. ' +
  "Usa únicamente datos reales de la conversación; no inventes cifras. Si no hay datos suficientes, no generes gráfica.";

function plainStream(text: string): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

/** Compone el contenido del último mensaje del usuario (texto + adjuntos). */
function composeUserContent(
  texto: string,
  adjuntos: AdjuntoApi[] | undefined,
  vision: boolean,
): string | ContentPart[] {
  const textos = (adjuntos ?? []).filter((a) => a.kind === "text" && a.text);
  const imagenes = (adjuntos ?? []).filter((a) => a.kind === "image" && a.dataUrl);

  let base = texto;
  for (const t of textos) {
    base += `\n\n[Archivo adjunto: ${t.name}]\n\`\`\`\n${t.text}\n\`\`\``;
  }
  if (imagenes.length && !vision) {
    base += `\n\n(Se adjuntaron ${imagenes.length} imagen(es), pero el modelo actual no analiza imágenes. Cambia a un modelo con visión, ej. GPT-4o mini.)`;
  }

  if (vision && imagenes.length) {
    const parts: ContentPart[] = [{ type: "text", text: base || "Analiza la(s) imagen(es) adjunta(s)." }];
    for (const img of imagenes) parts.push({ type: "image_url", image_url: { url: img.dataUrl! } });
    return parts;
  }
  return base;
}

export async function POST(req: NextRequest) {
  // Autenticación
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  let body: { mensajes?: MsgIn[]; modelo?: string; persona?: { id: string; tipo: PersonaTipo } | null };
  try {
    body = await req.json();
  } catch {
    return new Response("Cuerpo inválido", { status: 400 });
  }

  const mensajes = body.mensajes ?? [];
  const modelo = body.modelo || "deepseek-chat";
  if (mensajes.length === 0) return new Response("Sin mensajes", { status: 400 });

  // Verifica que haya llave para el proveedor del modelo.
  try {
    resolveProvider(modelo);
  } catch (e) {
    return plainStream(`⚠️ ${e instanceof Error ? e.message : "Modelo no disponible."}`);
  }

  const vision = modeloInfo(modelo)?.vision ?? false;

  // Contexto de persona (opcional).
  let personaCtx: string | null = null;
  if (body.persona?.id && body.persona?.tipo) {
    try {
      personaCtx = await buildPersonaContext(body.persona.id, body.persona.tipo);
    } catch {
      personaCtx = null;
    }
  }

  // RAG: recupera fragmentos de la base de conocimiento para la última pregunta.
  let ragContext = "";
  if (embeddingsAvailable()) {
    try {
      const ultima = [...mensajes].reverse().find((m) => m.role === "user")?.content?.trim();
      if (ultima) {
        const emb = await embedQuery(ultima);
        const { data: matches } = await supabase.rpc("match_kb_chunks", {
          query_embedding: emb,
          match_count: 6,
          similarity_threshold: 0.2,
        });
        const filas = (matches as { titulo: string; content: string }[] | null) ?? [];
        if (filas.length) {
          ragContext = filas.map((f, i) => `[${i + 1}] Fuente: ${f.titulo}\n${f.content}`).join("\n\n");
        }
      }
    } catch {
      ragContext = "";
    }
  }

  // Módulos visibles del usuario → determinan qué herramientas de datos expone.
  let viewableModules: string[] = [];
  try {
    viewableModules = (await getSessionUser())?.viewableModules ?? [];
  } catch {
    viewableModules = [];
  }
  const toolDefs = getToolDefs(viewableModules);

  const system =
    BASE +
    (toolDefs.length ? DATA_INSTR : "") +
    CHART_INSTR +
    (ragContext
      ? `\n\nBASE DE CONOCIMIENTO (fragmentos recuperados; úsalos como fuente principal y cita el título de la fuente entre paréntesis cuando los uses; si no responden la pregunta, dilo y responde con tu conocimiento general marcándolo):\n${ragContext}`
      : "") +
    (personaCtx ? `\n\nCONTEXTO DE LA PERSONA CONSULTADA:\n${personaCtx}` : "");

  // Construye los mensajes para el proveedor.
  const providerMessages: ProviderMessage[] = [{ role: "system", content: system }];
  mensajes.forEach((m, i) => {
    const esUltimo = i === mensajes.length - 1;
    if (esUltimo && m.role === "user") {
      providerMessages.push({ role: "user", content: composeUserContent(m.content, m.attachments, vision) });
    } else {
      providerMessages.push({ role: m.role, content: m.content });
    }
  });

  const streamResponse = (stream: ReadableStream<Uint8Array>) =>
    new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });

  // Bucle de herramientas: el modelo consulta datos reales según el prompt.
  if (toolDefs.length > 0) {
    try {
      let usedTools = false;
      for (let round = 0; round < 3; round++) {
        const { content, toolCalls } = await completeWithTools(modelo, providerMessages, toolDefs);
        if (toolCalls.length === 0) {
          // Sin (más) herramientas: si no se usó ninguna, entregamos la respuesta ya generada.
          if (!usedTools) return plainStream(content || "…");
          break; // Ya hay contexto de datos → generamos la respuesta final en streaming.
        }
        usedTools = true;
        providerMessages.push({ role: "assistant", content: content || null, tool_calls: toolCalls });
        for (const tc of toolCalls) {
          const result = await runTool(tc.function.name, tc.function.arguments, viewableModules);
          providerMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result).slice(0, 8000),
          });
        }
      }
      // Respuesta final (streaming) con los datos ya recuperados, sin más herramientas.
      return streamResponse(await streamChat(modelo, providerMessages));
    } catch {
      // El modelo no soporta herramientas o falló el bucle: seguimos con chat normal.
    }
  }

  try {
    return streamResponse(await streamChat(modelo, providerMessages));
  } catch (e) {
    return plainStream(`⚠️ ${e instanceof Error ? e.message : "Error al contactar al asistente."}`);
  }
}
