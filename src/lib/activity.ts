import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Registra una acción del usuario en activity_log (subidas, descargas, etc.).
 * Best-effort: nunca rompe el flujo principal.
 */
export async function logActivity(
  accion: string,
  entidad?: string,
  entidadId?: string,
  detalle?: string,
): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("activity_log").insert({
      user_id: user.id,
      accion,
      entidad: entidad ?? null,
      entidad_id: entidadId ?? null,
      detalle: detalle ?? null,
    });
  } catch {
    /* ignore */
  }
}
