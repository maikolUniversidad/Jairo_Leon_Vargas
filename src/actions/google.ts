"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth";
import {
  getDriveConfig,
  disconnectDrive,
  getDrive,
  ensureFolderTree,
  uploadBufferToDrive,
} from "@/lib/google-drive";
import { type DriveConfig } from "@/lib/drive-shared";
import { type ActionResult } from "./types";

export async function getDriveStatus(): Promise<DriveConfig> {
  const user = await getSessionUser();
  if (!user?.isAdmin) return { connected: false };
  return getDriveConfig();
}

export async function disconnectDriveAction(): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user?.isAdmin) return { ok: false, message: "No autorizado." };
  await disconnectDrive();
  revalidatePath("/dashboard/configuracion");
  return { ok: true, message: "Google Drive desconectado." };
}

export async function repairDriveTree(): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user?.isAdmin) return { ok: false, message: "No autorizado." };
  const drive = await getDrive();
  if (!drive) return { ok: false, message: "Drive no está conectado." };
  const cfg = await getDriveConfig();
  await ensureFolderTree(drive, cfg.email ?? null);
  revalidatePath("/dashboard/configuracion");
  return { ok: true, message: "Árbol de carpetas verificado/creado en Drive." };
}

/** ¿A qué carpeta de Drive va este archivo? null = no enviar a Drive. */
function folderKeyFor(bucket: string, path: string): string | null {
  if (bucket === "task-files") return "tareas";
  if (bucket === "contact-files") return path.startsWith("fotos/") ? null : "contactos";
  return null; // workspace-covers y otros se quedan en Supabase
}

/**
 * Tras subir a Supabase, si Drive está conectado y el archivo aplica, lo
 * copia a la carpeta correspondiente de Drive, borra la copia temporal de
 * Supabase y devuelve el enlace de Drive. Si algo falla, deja el de Supabase.
 */
export async function finalizeToDrive(
  bucket: string,
  path: string,
  name: string,
  mime: string,
): Promise<{ url: string; storage_path: string | null; drive: boolean }> {
  const admin = createAdminClient();
  const publicUrl = admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;

  const folderKey = folderKeyFor(bucket, path);
  if (!folderKey) return { url: publicUrl, storage_path: path, drive: false };

  try {
    const cfg = await getDriveConfig();
    if (!cfg.connected) return { url: publicUrl, storage_path: path, drive: false };

    const { data: blob, error } = await admin.storage.from(bucket).download(path);
    if (error || !blob) return { url: publicUrl, storage_path: path, drive: false };
    const buffer = Buffer.from(await blob.arrayBuffer());

    const res = await uploadBufferToDrive({ folderKey, name, mime: mime || "application/octet-stream", buffer });
    if (!res) return { url: publicUrl, storage_path: path, drive: false };

    // Drive es el sistema de archivo: borramos la copia temporal de Supabase.
    await admin.storage.from(bucket).remove([path]);
    return { url: res.link, storage_path: null, drive: true };
  } catch {
    return { url: publicUrl, storage_path: path, drive: false };
  }
}
