import "server-only";

import { getCredential } from "@/lib/connections";

/**
 * Cliente server-only de ElevenLabs (voz de los avatares).
 * La clave se lee desde la conexión guardada en Configuración → Integraciones
 * (app_secrets, key `conexion:elevenlabs`) y, como respaldo, desde ELEVENLABS_API_KEY.
 */

const BASE = "https://api.elevenlabs.io/v1";

async function apiKey(): Promise<string | null> {
  return getCredential("elevenlabs", "api_key");
}

/** ¿Hay una clave de ElevenLabs configurada? */
export async function elevenLabsAvailable(): Promise<boolean> {
  return !!(await apiKey());
}

export interface ElevenVoice {
  voice_id: string;
  name: string;
  category?: string;
  preview_url?: string;
}

/** Lista las voces disponibles en la cuenta de ElevenLabs. */
export async function listElevenVoices(): Promise<ElevenVoice[]> {
  const key = await apiKey();
  if (!key) return [];
  const res = await fetch(`${BASE}/voices`, {
    headers: { "xi-api-key": key },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { voices?: ElevenVoice[] };
  return (data.voices ?? []).map((v) => ({
    voice_id: v.voice_id,
    name: v.name,
    category: v.category,
    preview_url: v.preview_url,
  }));
}

export interface TtsSettings {
  model?: string;
  stability?: number;
  similarity_boost?: number;
  style?: number;
}

/**
 * Convierte texto a voz. Devuelve el audio (mp3) como Buffer.
 * Lanza si no hay clave o si la API falla; el llamador captura y reporta.
 */
export async function textToSpeech(
  voiceId: string,
  text: string,
  settings: TtsSettings = {},
): Promise<Buffer> {
  const key = await apiKey();
  if (!key) throw new Error("ElevenLabs no está conectado (configúralo en Integraciones).");
  if (!voiceId) throw new Error("El avatar no tiene una voz asignada.");

  const res = await fetch(`${BASE}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: settings.model || "eleven_multilingual_v2",
      voice_settings: {
        stability: settings.stability ?? 0.5,
        similarity_boost: settings.similarity_boost ?? 0.75,
        style: settings.style ?? 0,
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ElevenLabs respondió ${res.status}: ${detail.slice(0, 200)}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
