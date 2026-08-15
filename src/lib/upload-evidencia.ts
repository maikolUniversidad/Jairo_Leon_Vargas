import { createClient } from "@/lib/supabase/client";
import { createSignedUpload } from "@/actions/storage";

export interface EvidenciaUploadResult {
  ok: boolean;
  path?: string;
  url?: string;
  mime?: string;
  message?: string;
}

const LIMITE = 100 * 1024 * 1024; // 100 MB (coincide con el bucket)

/**
 * Sube una foto o video de evidencia (entrega/recepción/accidente) al bucket
 * público `inventario` con URL firmada — directo desde el navegador, sin pasar
 * por el server action (evita el límite de 4.5 MB). Devuelve ruta y URL pública.
 */
export async function uploadEvidencia(equipoId: string, file: File): Promise<EvidenciaUploadResult> {
  if (!file || file.size === 0) return { ok: false, message: "Archivo vacío." };
  const esVideo = file.type.startsWith("video/");
  const esFoto = file.type.startsWith("image/");
  if (!esVideo && !esFoto) return { ok: false, message: "Debe ser una foto o un video." };
  if (file.size > LIMITE) return { ok: false, message: "El archivo supera 100 MB." };

  const signed = await createSignedUpload("inventario", equipoId, file.name);
  if (!signed.ok || !signed.data) return { ok: false, message: signed.message };

  const supabase = createClient();
  const { error } = await supabase.storage
    .from("inventario")
    .uploadToSignedUrl(signed.data.path, signed.data.token, file, {
      contentType: file.type || (esVideo ? "video/mp4" : "image/jpeg"),
    });
  if (error) return { ok: false, message: `No se pudo subir: ${error.message}` };

  const { data } = supabase.storage.from("inventario").getPublicUrl(signed.data.path);
  return { ok: true, path: signed.data.path, url: data.publicUrl, mime: file.type };
}
