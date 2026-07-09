import "server-only";

import { getCredential } from "@/lib/connections";

/**
 * Cliente server-only de Higgsfield (imagen/video de los avatares).
 *
 * Arquitectura HÍBRIDA: si hay una API REST de Higgsfield configurada
 * (Configuración → Integraciones), se dispara la generación automática. Si NO,
 * la acción deja el trabajo en estado `pendiente` para completarlo de forma
 * asistida (subiendo el asset generado por otra vía) — el módulo nunca se bloquea.
 *
 * El endpoint exacto se resuelve por `api_url` (o HIGGSFIELD_API_URL). Este
 * cliente está aislado a propósito: cuando confirmes el contrato real de la API
 * de Higgsfield, solo se ajusta `submitGeneration` aquí, sin tocar la UI ni las
 * acciones.
 */

export interface HiggsfieldSubmit {
  tipo: "imagen" | "video" | "3d";
  modelo?: string | null;
  prompt: string;
  inputRefs?: string[];
  params?: Record<string, unknown>;
}

export interface HiggsfieldResult {
  /** true → se aceptó la generación (síncrona o encolada). */
  ok: boolean;
  /** true → devolvió el asset final ya. */
  done: boolean;
  outputUrl?: string;
  providerJobId?: string;
  message?: string;
}

async function creds(): Promise<{ key: string; url: string } | null> {
  const key = await getCredential("higgsfield", "api_key");
  if (!key) return null;
  const url =
    (await getCredential("higgsfield", "api_url")) ||
    process.env.HIGGSFIELD_API_URL ||
    process.env.HIGGSFIELD_BASE_URL ||
    "https://api.higgsfield.ai";
  return { key, url: url.replace(/\/$/, "") };
}

/** ¿Hay una API de Higgsfield configurada para generación automática? */
export async function higgsfieldAvailable(): Promise<boolean> {
  return (await creds()) !== null;
}

/**
 * Envía una generación a Higgsfield. Devuelve `ok:false` sin lanzar cuando no
 * hay API configurada, para que el llamador deje el trabajo pendiente (asistido).
 */
export async function submitGeneration(input: HiggsfieldSubmit): Promise<HiggsfieldResult> {
  const c = await creds();
  if (!c) {
    return {
      ok: false,
      done: false,
      message: "Higgsfield no está conectado: el trabajo queda pendiente (asistido).",
    };
  }

  try {
    const res = await fetch(`${c.url}/v1/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: input.tipo,
        model: input.modelo ?? undefined,
        prompt: input.prompt,
        input_images: input.inputRefs ?? [],
        params: input.params ?? {},
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, done: false, message: `Higgsfield respondió ${res.status}: ${detail.slice(0, 160)}` };
    }

    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      job_id?: string;
      status?: string;
      output_url?: string;
      url?: string;
    };
    const outputUrl = data.output_url || data.url;
    const providerJobId = data.id || data.job_id;
    return {
      ok: true,
      done: Boolean(outputUrl),
      outputUrl,
      providerJobId,
      message: outputUrl ? "Generado." : "Generación encolada en Higgsfield.",
    };
  } catch (e) {
    return { ok: false, done: false, message: `Error con Higgsfield: ${(e as Error).message.slice(0, 160)}` };
  }
}
