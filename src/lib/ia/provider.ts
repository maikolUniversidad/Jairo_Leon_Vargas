import "server-only";

/**
 * Proveedor de chat con STREAMING (OpenAI-compatible). Elige DeepSeek u OpenAI
 * según el modelo. Las llaves nunca se exponen al cliente.
 */

export type ChatRole = "system" | "user" | "assistant";

/** Parte de contenido: texto o imagen (para modelos con visión). */
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: ChatRole;
  content: string | ContentPart[];
}

/** Llamada a herramienta devuelta por el modelo (function calling). */
export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

/** Definición de herramienta (schema OpenAI-compatible). */
export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** Mensaje ampliado que admite tool_calls (assistant) y resultados (tool). */
export type ProviderMessage =
  | { role: ChatRole; content: string | ContentPart[] }
  | { role: "assistant"; content: string | null; tool_calls: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

interface Resolved {
  url: string;
  key: string;
  model: string;
  name: "deepseek" | "openai";
  vision: boolean;
}

/** Resuelve endpoint/llave/modelo. Lanza un Error legible si falta la llave. */
export function resolveProvider(modelo: string): Resolved {
  if (modelo.startsWith("gpt") || modelo.startsWith("o1") || modelo.startsWith("o3")) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("Falta OPENAI_API_KEY para usar este modelo.");
    return { url: "https://api.openai.com/v1/chat/completions", key, model: modelo, name: "openai", vision: true };
  }
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("Falta DEEPSEEK_API_KEY para usar este modelo.");
  return {
    url: "https://api.deepseek.com/chat/completions",
    key,
    model: modelo || "deepseek-chat",
    name: "deepseek",
    vision: false,
  };
}

/** ¿El proveedor de un modelo tiene llave configurada? */
export function providerAvailable(modelo: string): boolean {
  try {
    resolveProvider(modelo);
    return true;
  } catch {
    return false;
  }
}

/**
 * Completación NO-streaming con herramientas (function calling). Devuelve el
 * texto y/o las llamadas a herramientas que el modelo pide. Se usa para el
 * "loop" de herramientas antes de la respuesta final.
 */
export async function completeWithTools(
  modelo: string,
  messages: ProviderMessage[],
  tools: ToolDef[],
): Promise<{ content: string; toolCalls: ToolCall[] }> {
  const cfg = resolveProvider(modelo);

  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.3,
      max_tokens: 1500,
      stream: false,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`IA ${cfg.name} respondió ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
  };
  const msg = data.choices?.[0]?.message;
  return { content: msg?.content ?? "", toolCalls: msg?.tool_calls ?? [] };
}

/**
 * Llama al modelo con stream y devuelve un ReadableStream de TEXTO plano
 * (solo el contenido incremental del asistente). Lanza si la API responde mal.
 */
export async function streamChat(modelo: string, messages: ProviderMessage[]): Promise<ReadableStream<Uint8Array>> {
  const cfg = resolveProvider(modelo);

  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({ model: cfg.model, messages, stream: true, temperature: 0.6, max_tokens: 2000 }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`IA ${cfg.name} respondió ${res.status}: ${detail.slice(0, 200)}`);
  }

  const upstream = res.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await upstream.read();
      if (done) {
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // deja la línea incompleta en el buffer
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const payload = t.slice(5).trim();
        if (payload === "[DONE]") {
          controller.close();
          return;
        }
        try {
          const json = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
          const token = json.choices?.[0]?.delta?.content;
          if (token) controller.enqueue(encoder.encode(token));
        } catch {
          /* fragmento SSE incompleto: ignorar */
        }
      }
    },
    cancel() {
      upstream.cancel().catch(() => {});
    },
  });
}
