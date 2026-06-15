import { createClient } from "@/lib/supabase/client";
import { createSignedUpload } from "@/actions/storage";

export interface AvatarUploadResult {
  ok: boolean;
  url?: string;
  message?: string;
}

/**
 * Sube una foto de perfil al bucket público `avatars` con URL firmada y
 * devuelve su URL pública. No pasa por Google Drive (la foto debe mostrarse
 * directamente en la interfaz).
 */
export async function uploadAvatar(userId: string, file: File): Promise<AvatarUploadResult> {
  if (!file || file.size === 0) return { ok: false, message: "Imagen vacía." };
  if (!file.type.startsWith("image/")) return { ok: false, message: "Debe ser una imagen." };
  if (file.size > 5 * 1024 * 1024) return { ok: false, message: "La imagen supera 5 MB." };

  const signed = await createSignedUpload("avatars", userId, file.name);
  if (!signed.ok || !signed.data) return { ok: false, message: signed.message };

  const supabase = createClient();
  const { error } = await supabase.storage
    .from("avatars")
    .uploadToSignedUrl(signed.data.path, signed.data.token, file, {
      contentType: file.type || "image/jpeg",
    });
  if (error) return { ok: false, message: `No se pudo subir: ${error.message}` };

  // La ruta lleva un timestamp único (Date.now()), así que la URL pública
  // cambia en cada subida y el navegador no muestra una foto cacheada.
  const { data } = supabase.storage.from("avatars").getPublicUrl(signed.data.path);
  return { ok: true, url: data.publicUrl };
}
