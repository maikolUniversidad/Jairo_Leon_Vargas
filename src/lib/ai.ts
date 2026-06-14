import "server-only";

/**
 * Cliente de IA server-only. Soporta DeepSeek y OpenAI (ambos exponen la API
 * de chat completions compatible con OpenAI). El proveedor se elige con
 * AI_PROVIDER. Las claves NUNCA deben exponerse al cliente.
 */
type Provider = "deepseek" | "openai";

interface ProviderConfig {
  url: string;
  model: string;
  key: string;
  name: Provider;
}

function getConfig(): ProviderConfig | null {
  const provider = (process.env.AI_PROVIDER as Provider) || "deepseek";

  if (provider === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return null;
    return {
      url: "https://api.openai.com/v1/chat/completions",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      key,
      name: "openai",
    };
  }

  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  return {
    url: "https://api.deepseek.com/chat/completions",
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    key,
    name: "deepseek",
  };
}

/** ¿Hay un proveedor de IA configurado y con clave? */
export function aiAvailable(): boolean {
  return getConfig() !== null;
}

/** Nombre del proveedor activo (para registro/log). */
export function aiProviderName(): string {
  return getConfig()?.name ?? "mock";
}

interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
}

/**
 * Genera una respuesta de chat. Lanza si no hay proveedor o si la API falla.
 * El llamador debe capturar el error y aplicar un fallback (p. ej. mock).
 */
export async function generateCompletion(
  system: string,
  user: string,
  opts: CompletionOptions = {},
): Promise<string> {
  const cfg = getConfig();
  if (!cfg) throw new Error("No hay proveedor de IA configurado.");

  const res = await fetch(cfg.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.key}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: opts.temperature ?? 0.6,
      max_tokens: opts.maxTokens ?? 900,
    }),
    // Evita esperas eternas si el proveedor no responde.
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`IA ${cfg.name} respondió ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("La IA no devolvió contenido.");
  return content;
}
