import { createClient } from "@/lib/supabase/client";
import { createSignedUpload } from "@/actions/storage";

export interface DocUploadResult {
  ok: boolean;
  path?: string;
  name?: string;
  mime?: string;
  size?: number;
  message?: string;
}

/**
 * Sube un documento DIRECTO al bucket privado `documentos` con URL firmada.
 * A diferencia de uploadFileViaSignedUrl, NO publica en Google Drive ni expone
 * una URL pública: el archivo queda privado y solo se descarga con URL firmada
 * generada en el servidor (tras validar permisos por rol en la RLS).
 */
export async function uploadDocumentFile(
  folderId: string | null,
  file: File,
): Promise<DocUploadResult> {
  if (!file || file.size === 0) return { ok: false, message: "Archivo vacío." };

  const prefix = folderId ? `folder/${folderId}` : "root";
  const signed = await createSignedUpload("documentos", prefix, file.name);
  if (!signed.ok || !signed.data) return { ok: false, message: signed.message };

  const supabase = createClient();
  const { error } = await supabase.storage
    .from("documentos")
    .uploadToSignedUrl(signed.data.path, signed.data.token, file, {
      contentType: file.type || "application/octet-stream",
    });
  if (error) return { ok: false, message: `No se pudo subir: ${error.message}` };

  return {
    ok: true,
    path: signed.data.path,
    name: file.name,
    mime: file.type,
    size: file.size,
  };
}
