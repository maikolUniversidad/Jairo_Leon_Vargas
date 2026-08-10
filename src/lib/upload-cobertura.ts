import { createClient } from "@/lib/supabase/client";
import { createSignedUpload } from "@/actions/storage";
import {
  addCoberturaFile,
  finishCoberturaReplace,
  finishCoberturaUpload,
  startCoberturaReplace,
  startCoberturaUpload,
  type CoberturaFile,
  type Fase,
  type MetadataArchivo,
} from "@/actions/coberturas";

/** Trozo de 8 MB: múltiplo de 256 KB, como exige Drive para las subidas por partes. */
const CHUNK_SIZE = 8 * 1024 * 1024;

export interface MediaUploadResult {
  ok: boolean;
  message?: string;
  file?: CoberturaFile;
  /** true cuando el usuario canceló; no es un error que haya que mostrar. */
  cancelado?: boolean;
}

export interface MediaUploadOptions {
  onProgress?: (fraccion: number) => void;
  signal?: AbortSignal;
}

/* ────────────────────────── Subida reanudable a Drive ────────────────────────── */

class UploadCancelled extends Error {}

/**
 * Envía el archivo por trozos a la sesión reanudable de Drive y devuelve el id
 * del archivo creado. Los bytes van del navegador a Google directamente: no
 * pasan por Vercel, así que no hay límite de 4.5 MB ni de 300 s.
 */
async function enviarPorTrozos(
  uploadUrl: string,
  file: File,
  opts: MediaUploadOptions,
): Promise<string> {
  let offset = 0;

  while (offset < file.size) {
    if (opts.signal?.aborted) throw new UploadCancelled();

    const end = Math.min(offset + CHUNK_SIZE, file.size);
    const xhr = await enviarTrozo(uploadUrl, file, offset, end, opts);

    if (xhr.status === 308) {
      // Drive confirma hasta dónde recibió. Reanudamos justo después.
      const range = xhr.getResponseHeader("Range");
      const recibidoHasta = range ? Number(range.split("-")[1]) : NaN;
      offset = Number.isFinite(recibidoHasta) ? recibidoHasta + 1 : end;
      continue;
    }

    if (xhr.status === 200 || xhr.status === 201) {
      const id = (JSON.parse(xhr.responseText) as { id?: string }).id;
      if (!id) throw new Error("Drive no devolvió el identificador del archivo.");
      opts.onProgress?.(1);
      return id;
    }

    throw new Error(`Drive rechazó la subida (${xhr.status}).`);
  }

  throw new Error("La subida terminó sin respuesta de Drive.");
}

/**
 * Un trozo. Usa XMLHttpRequest porque `fetch` no expone el progreso de subida,
 * que es justo lo que necesitamos para la barra de cada archivo.
 */
function enviarTrozo(
  uploadUrl: string,
  file: File,
  start: number,
  end: number,
  opts: MediaUploadOptions,
): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Range", `bytes ${start}-${end - 1}/${file.size}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress?.(Math.min((start + e.loaded) / file.size, 0.999));
    };
    xhr.onload = () => resolve(xhr);
    xhr.onerror = () => reject(new Error("Sin conexión con Google Drive."));
    xhr.onabort = () => reject(new UploadCancelled());

    const abortar = () => xhr.abort();
    opts.signal?.addEventListener("abort", abortar, { once: true });
    xhr.onloadend = () => opts.signal?.removeEventListener("abort", abortar);

    xhr.send(file.slice(start, end));
  });
}

/* ────────────────────────── Camino alterno: Supabase ────────────────────────── */

/**
 * Se usa cuando Drive no está conectado, o si la subida directa falla. El
 * servidor mueve el archivo a Drive después, como venía haciendo hasta ahora.
 */
async function subirPorStorage(
  coberturaId: string,
  fase: Fase,
  file: File,
  meta: MetadataArchivo,
  origenFileId: string | null,
  opts: MediaUploadOptions,
): Promise<MediaUploadResult> {
  const signed = await createSignedUpload("coberturas", `${coberturaId}/${fase}`, file.name);
  if (!signed.ok || !signed.data) return { ok: false, message: signed.message };

  opts.onProgress?.(0.1);
  const supabase = createClient();
  const { error } = await supabase.storage
    .from("coberturas")
    .uploadToSignedUrl(signed.data.path, signed.data.token, file, {
      contentType: file.type || "application/octet-stream",
    });
  if (error) return { ok: false, message: `No se pudo subir: ${error.message}` };

  opts.onProgress?.(0.8);
  const res = await addCoberturaFile({
    cobertura_id: coberturaId,
    fase,
    path: signed.data.path,
    name: file.name,
    mime: file.type,
    size: file.size,
    origen_file_id: origenFileId,
    meta,
  });
  opts.onProgress?.(1);
  return res.ok
    ? { ok: true, message: res.message, file: res.data }
    : { ok: false, message: res.message };
}

/* ────────────────────────────── API pública ────────────────────────────── */

/**
 * Sube un archivo a la fase indicada de una cobertura.
 *
 * `meta` llega desde la pantalla de revisión previa y viaja con el archivo por
 * los dos caminos posibles (Drive directo o Supabase). El servidor la revalida.
 */
export async function subirArchivoCobertura(
  coberturaId: string,
  fase: Fase,
  file: File,
  meta: MetadataArchivo,
  opts: MediaUploadOptions & { origenFileId?: string | null } = {},
): Promise<MediaUploadResult> {
  if (!file || file.size === 0) return { ok: false, message: "El archivo está vacío." };
  const origenFileId = opts.origenFileId ?? null;

  const ticket = await startCoberturaUpload({
    cobertura_id: coberturaId,
    fase,
    name: file.name,
    mime: file.type,
    size: file.size,
    meta,
  });
  if (!ticket.ok) return { ok: false, message: ticket.message };

  if (ticket.data?.mode === "drive") {
    try {
      const driveFileId = await enviarPorTrozos(ticket.data.uploadUrl, file, opts);
      const res = await finishCoberturaUpload({
        cobertura_id: coberturaId,
        fase,
        drive_file_id: driveFileId,
        name: file.name,
        mime: file.type,
        size: file.size,
        origen_file_id: origenFileId,
        meta,
      });
      return res.ok
        ? { ok: true, message: res.message, file: res.data }
        : { ok: false, message: res.message };
    } catch (e) {
      if (e instanceof UploadCancelled || opts.signal?.aborted) {
        return { ok: false, cancelado: true, message: "Subida cancelada." };
      }
      // La causa habitual es que el navegador bloquee la petición a Google.
      // En vez de fallar, se reintenta por el camino de siempre.
      opts.onProgress?.(0);
    }
  }

  if (opts.signal?.aborted) return { ok: false, cancelado: true, message: "Subida cancelada." };
  return subirPorStorage(coberturaId, fase, file, meta, origenFileId, opts);
}

/**
 * Sustituye el contenido de un archivo existente conservando su id, su enlace y
 * su posición en el tablero. Drive guarda la versión previa en su historial.
 */
export async function reemplazarArchivoCobertura(
  fileId: string,
  file: File,
  opts: MediaUploadOptions = {},
): Promise<MediaUploadResult> {
  if (!file || file.size === 0) return { ok: false, message: "El archivo está vacío." };

  const ticket = await startCoberturaReplace({
    file_id: fileId,
    mime: file.type,
    size: file.size,
  });
  if (!ticket.ok || ticket.data?.mode !== "drive") {
    return { ok: false, message: ticket.ok ? "El reemplazo requiere Drive." : ticket.message };
  }

  try {
    await enviarPorTrozos(ticket.data.uploadUrl, file, opts);
  } catch (e) {
    if (e instanceof UploadCancelled || opts.signal?.aborted) {
      return { ok: false, cancelado: true, message: "Reemplazo cancelado." };
    }
    return { ok: false, message: e instanceof Error ? e.message : "No se pudo reemplazar." };
  }

  const res = await finishCoberturaReplace({
    file_id: fileId,
    name: file.name,
    mime: file.type,
    size: file.size,
  });
  return res.ok
    ? { ok: true, message: res.message, file: res.data }
    : { ok: false, message: res.message };
}
