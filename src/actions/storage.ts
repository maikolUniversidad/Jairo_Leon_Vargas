"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { type ActionResult } from "./types";

type Bucket = "task-files" | "contact-files" | "workspace-covers" | "coberturas" | "documentos" | "avatars" | "contenido";

/**
 * Crea una URL de subida firmada para que el navegador suba el archivo
 * DIRECTO a Supabase Storage (sin pasar por Vercel → sin límite de 4.5 MB
 * de los server actions, y sin problemas de RLS porque el token autoriza).
 * El servidor solo verifica sesión y reserva la ruta.
 */
export async function createSignedUpload(
  bucket: Bucket,
  prefix: string,
  filename: string,
): Promise<ActionResult<{ path: string; token: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión no válida." };

  const safePrefix = (prefix || "general").replace(/[^a-zA-Z0-9/_-]/g, "");
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${safePrefix}/${Date.now()}-${safeName}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) {
    return { ok: false, message: `No se pudo preparar la subida: ${error?.message ?? ""}` };
  }
  return { ok: true, message: "ok", data: { path: data.path, token: data.token } };
}
