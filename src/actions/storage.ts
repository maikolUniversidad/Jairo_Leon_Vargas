"use server";

import { createClient } from "@/lib/supabase/server";
import { type ActionResult } from "./types";

type Bucket = "task-files" | "contact-files" | "workspace-covers";

/**
 * Sube un archivo a Storage desde el servidor (sesión garantizada por cookies),
 * evitando problemas de RLS cuando el cliente del navegador no adjunta el token.
 * Recibe FormData con `file` y un `prefix` opcional para la ruta.
 */
export async function uploadToBucket(
  bucket: Bucket,
  formData: FormData,
): Promise<ActionResult<{ url: string; path: string; name: string; mime: string; size: number }>> {
  const file = formData.get("file");
  const prefix = (formData.get("prefix") as string | null)?.replace(/[^a-zA-Z0-9/_-]/g, "") || "general";

  if (!(file instanceof File)) return { ok: false, message: "No se recibió el archivo." };
  if (file.size === 0) return { ok: false, message: "El archivo está vacío." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión no válida." };

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${prefix}/${Date.now()}-${safe}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) {
    return { ok: false, message: `No se pudo subir: ${error.message}` };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return {
    ok: true,
    message: "Archivo subido.",
    data: { url: data.publicUrl, path, name: file.name, mime: file.type, size: file.size },
  };
}
