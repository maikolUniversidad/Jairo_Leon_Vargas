"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth";
import { MISREDES_DEFAULTS, type MisredesConfig } from "@/lib/misredes-shared";
import { type ActionResult } from "./types";

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function deepMerge<T>(base: T, extra: unknown): T {
  if (!isObj(base) || !isObj(extra)) return (extra ?? base) as T;
  const out: Record<string, unknown> = { ...base };
  for (const k of Object.keys(extra)) {
    out[k] = isObj(out[k]) ? deepMerge(out[k], extra[k]) : extra[k];
  }
  return out as T;
}

/** Lee la configuración de la página /misredes (solo administradores). */
export async function getMisredesConfig(): Promise<MisredesConfig> {
  const user = await getSessionUser();
  if (!user?.isAdmin) return MISREDES_DEFAULTS;
  const admin = createAdminClient();
  const { data } = await admin.from("linktree_config").select("data").eq("id", 1).maybeSingle();
  return deepMerge(MISREDES_DEFAULTS, (data?.data as unknown) ?? {});
}

/** Guarda la configuración de la página /misredes (solo administradores). */
export async function saveMisredesConfig(config: MisredesConfig): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user?.isAdmin) return { ok: false, message: "No autorizado." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("linktree_config")
    .upsert({ id: 1, data: config, updated_at: new Date().toISOString() });
  if (error) return { ok: false, message: "No se pudo guardar." };
  return { ok: true, message: "Cambios publicados en /misredes." };
}
