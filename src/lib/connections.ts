import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Conexiones de redes/fuentes de datos para el monitoreo.
 * · Secretos (tokens/keys) → app_secrets, key `conexion:<provider>` (service role).
 * · Estado público → settings, key `conexiones`.
 */

export interface ProviderField {
  name: string;
  label: string;
  placeholder?: string;
}
export interface ProviderDef {
  key: string;
  label: string;
  fields: ProviderField[];
  /** Se puede verificar automáticamente contra su API. */
  testable: boolean;
  /** Variable de entorno equivalente (respaldo si no hay secreto en BD). */
  envKey?: string;
  help?: string;
}

export const CONNECTION_PROVIDERS: ProviderDef[] = [
  {
    key: "x",
    label: "X / Twitter",
    fields: [{ name: "bearer_token", label: "Bearer Token", placeholder: "AAAAAAAA..." }],
    testable: true,
    envKey: "X_BEARER_TOKEN",
    help: "API v2. Crea un proyecto en developer.x.com y copia el Bearer Token.",
  },
  {
    key: "newsapi",
    label: "NewsAPI",
    fields: [{ name: "api_key", label: "API Key" }],
    testable: true,
    envKey: "NEWSAPI_KEY",
    help: "newsapi.org — noticias adicionales a Google News.",
  },
  {
    key: "youtube",
    label: "YouTube (Data API v3)",
    fields: [{ name: "api_key", label: "API Key" }],
    testable: true,
    envKey: "YOUTUBE_API_KEY",
    help: "Google Cloud → YouTube Data API v3 → clave de API.",
  },
  {
    key: "facebook",
    label: "Facebook / Meta",
    fields: [{ name: "access_token", label: "Access Token" }],
    testable: true,
    envKey: "FACEBOOK_TOKEN",
    help: "Graph API. Token de página/usuario con permisos de lectura.",
  },
  {
    key: "instagram",
    label: "Instagram (Graph)",
    fields: [{ name: "access_token", label: "Access Token" }],
    testable: false,
    envKey: "INSTAGRAM_TOKEN",
    help: "Requiere Instagram Graph API con cuenta profesional vinculada.",
  },
  {
    key: "tiktok",
    label: "TikTok",
    fields: [{ name: "access_token", label: "Access Token" }],
    testable: false,
    envKey: "TIKTOK_TOKEN",
    help: "Requiere aprobación de TikTok for Developers.",
  },
  {
    key: "elevenlabs",
    label: "ElevenLabs (voz de avatares)",
    fields: [{ name: "api_key", label: "API Key", placeholder: "sk_..." }],
    testable: true,
    envKey: "ELEVENLABS_API_KEY",
    help: "elevenlabs.io → Profile → API Key. Habilita la generación automática de voz para los avatares.",
  },
  {
    key: "higgsfield",
    label: "Higgsfield (imagen/video de avatares)",
    fields: [
      { name: "api_key", label: "API Key" },
      { name: "api_url", label: "API URL (opcional)", placeholder: "https://api.higgsfield.ai" },
    ],
    testable: false,
    envKey: "HIGGSFIELD_API_KEY",
    help: "Genera imagen y video de los avatares. Sin API, los trabajos quedan pendientes para completarse de forma asistida.",
  },
];

export interface ConnectionStatus {
  connected: boolean;
  checked_at?: string;
  detail?: string;
}

function providerDef(key: string): ProviderDef | undefined {
  return CONNECTION_PROVIDERS.find((p) => p.key === key);
}

/* ─────────────── Secretos ─────────────── */

export async function getConnectionSecret(provider: string): Promise<Record<string, string> | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_secrets")
    .select("value")
    .eq("key", `conexion:${provider}`)
    .maybeSingle();
  return (data?.value as Record<string, string>) ?? null;
}

export async function saveConnectionSecret(provider: string, fields: Record<string, string>) {
  const admin = createAdminClient();
  await admin.from("app_secrets").upsert({
    key: `conexion:${provider}`,
    value: fields,
    updated_at: new Date().toISOString(),
  });
}

export async function deleteConnectionSecret(provider: string) {
  const admin = createAdminClient();
  await admin.from("app_secrets").delete().eq("key", `conexion:${provider}`);
}

/**
 * Devuelve una credencial: primero desde la conexión guardada, si no, del env.
 * Lo usan los colectores del monitoreo.
 */
export async function getCredential(provider: string, field: string): Promise<string | null> {
  const secret = await getConnectionSecret(provider);
  if (secret?.[field]) return secret[field];
  const def = providerDef(provider);
  if (def?.envKey && process.env[def.envKey]) return process.env[def.envKey] as string;
  return null;
}

/* ─────────────── Estado público (settings) ─────────────── */

export async function getConnectionsStatus(): Promise<Record<string, ConnectionStatus>> {
  const admin = createAdminClient();
  const { data } = await admin.from("settings").select("value").eq("key", "conexiones").maybeSingle();
  return (data?.value as Record<string, ConnectionStatus>) ?? {};
}

async function setConnectionStatus(provider: string, status: ConnectionStatus) {
  const admin = createAdminClient();
  const current = await getConnectionsStatus();
  current[provider] = status;
  await admin
    .from("settings")
    .upsert({ key: "conexiones", value: current, updated_at: new Date().toISOString() });
}

/* ─────────────── Verificación por proveedor ─────────────── */

async function ping(provider: string, cred: Record<string, string>): Promise<ConnectionStatus> {
  const now = new Date().toISOString();
  try {
    if (provider === "x") {
      const r = await fetch(
        "https://api.twitter.com/2/tweets/search/recent?query=colombia&max_results=10",
        { headers: { Authorization: `Bearer ${cred.bearer_token}` }, signal: AbortSignal.timeout(15_000) },
      );
      return r.ok
        ? { connected: true, checked_at: now, detail: "API v2 respondió correctamente." }
        : { connected: false, checked_at: now, detail: `X respondió ${r.status}.` };
    }
    if (provider === "newsapi") {
      const r = await fetch(
        `https://newsapi.org/v2/top-headlines?country=co&pageSize=1&apiKey=${cred.api_key}`,
        { signal: AbortSignal.timeout(15_000) },
      );
      const j = await r.json().catch(() => ({}));
      return r.ok && j.status === "ok"
        ? { connected: true, checked_at: now, detail: "Clave válida." }
        : { connected: false, checked_at: now, detail: j.message ?? `NewsAPI respondió ${r.status}.` };
    }
    if (provider === "youtube") {
      const r = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=${cred.api_key}`,
        { signal: AbortSignal.timeout(15_000) },
      );
      return r.ok
        ? { connected: true, checked_at: now, detail: "Clave válida." }
        : { connected: false, checked_at: now, detail: `YouTube respondió ${r.status}.` };
    }
    if (provider === "facebook") {
      const r = await fetch(
        `https://graph.facebook.com/v19.0/me?access_token=${encodeURIComponent(cred.access_token ?? "")}`,
        { signal: AbortSignal.timeout(15_000) },
      );
      return r.ok
        ? { connected: true, checked_at: now, detail: "Token válido." }
        : { connected: false, checked_at: now, detail: `Meta respondió ${r.status}.` };
    }
    if (provider === "elevenlabs") {
      const r = await fetch("https://api.elevenlabs.io/v1/user", {
        headers: { "xi-api-key": cred.api_key ?? "" },
        signal: AbortSignal.timeout(15_000),
      });
      return r.ok
        ? { connected: true, checked_at: now, detail: "Clave válida." }
        : { connected: false, checked_at: now, detail: `ElevenLabs respondió ${r.status}.` };
    }
    // No verificable automáticamente: se guarda como "conectado" sin ping.
    return { connected: true, checked_at: now, detail: "Guardado (sin verificación automática)." };
  } catch (e) {
    return { connected: false, checked_at: now, detail: `Error: ${(e as Error).message.slice(0, 80)}` };
  }
}

/** Prueba la conexión de un proveedor con su credencial guardada. */
export async function testConnection(provider: string): Promise<ConnectionStatus> {
  const cred = await getConnectionSecret(provider);
  if (!cred || Object.values(cred).every((v) => !v)) {
    const st: ConnectionStatus = {
      connected: false,
      checked_at: new Date().toISOString(),
      detail: "Sin credencial guardada.",
    };
    await setConnectionStatus(provider, st);
    return st;
  }
  const st = await ping(provider, cred);
  await setConnectionStatus(provider, st);
  return st;
}

export async function clearConnectionStatus(provider: string) {
  await setConnectionStatus(provider, { connected: false, detail: "Desconectado." });
}
