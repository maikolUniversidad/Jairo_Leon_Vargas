import { createClient } from "@/lib/supabase/client";
import { createSignedUpload } from "@/actions/storage";
import { finalizeToDrive } from "@/actions/google";
import { addCoberturaFile, type Fase } from "@/actions/coberturas";

type Bucket = "task-files" | "contact-files" | "workspace-covers" | "coberturas" | "contenido" | "avatars";

export interface UploadResult {
  ok: boolean;
  url?: string;
  path?: string;
  name?: string;
  mime?: string;
  size?: number;
  message?: string;
}

/**
 * Sube un archivo del navegador DIRECTO a Supabase Storage usando una URL
 * firmada generada en el servidor. Evita el límite de 4.5 MB de Vercel y los
 * problemas de RLS del cliente. Funciona con buckets públicos (devuelve URL pública).
 */
export async function uploadFileViaSignedUrl(
  bucket: Bucket,
  prefix: string,
  file: File,
): Promise<UploadResult> {
  if (!file || file.size === 0) return { ok: false, message: "Archivo vacío." };

  const signed = await createSignedUpload(bucket, prefix, file.name);
  if (!signed.ok || !signed.data) return { ok: false, message: signed.message };

  const supabase = createClient();
  const { error } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(signed.data.path, signed.data.token, file, {
      contentType: file.type || "application/octet-stream",
    });
  if (error) return { ok: false, message: `No se pudo subir: ${error.message}` };

  // Si Google Drive está conectado, mueve el archivo a Drive y usa su enlace.
  const fin = await finalizeToDrive(bucket, signed.data.path, file.name, file.type);

  return {
    ok: true,
    url: fin.url,
    path: fin.storage_path ?? undefined,
    name: file.name,
    mime: file.type,
    size: file.size,
  };
}

/**
 * Sube un archivo de cobertura a la fase indicada (crudo/editado/aprobado):
 * va al bucket de staging y el servidor lo mueve a la subcarpeta de Drive.
 */
export async function uploadCoberturaFile(
  coberturaId: string,
  fase: Fase,
  file: File,
): Promise<{ ok: boolean; message?: string }> {
  if (!file || file.size === 0) return { ok: false, message: "Archivo vacío." };
  const signed = await createSignedUpload("coberturas", `${coberturaId}/${fase}`, file.name);
  if (!signed.ok || !signed.data) return { ok: false, message: signed.message };

  const supabase = createClient();
  const { error } = await supabase.storage
    .from("coberturas")
    .uploadToSignedUrl(signed.data.path, signed.data.token, file, {
      contentType: file.type || "application/octet-stream",
    });
  if (error) return { ok: false, message: `No se pudo subir: ${error.message}` };

  return addCoberturaFile({
    cobertura_id: coberturaId,
    fase,
    path: signed.data.path,
    name: file.name,
    mime: file.type,
    size: file.size,
  });
}
