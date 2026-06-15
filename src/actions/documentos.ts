"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createDriveSubfolder,
  getDocumentosRootId,
  uploadBufferToFolder,
} from "@/lib/google-drive";
import { getSessionUser } from "@/lib/auth";
import { documentFolderSchema, documentSchema } from "@/lib/validations";
import { type ActionResult, zodToFieldErrors } from "./types";

/**
 * Asegura que una carpeta documental tenga su carpeta espejo en Drive (creando
 * la cadena de padres si hace falta). Devuelve el id de Drive o null si Drive
 * no está conectado. Best-effort: no rompe si Drive falla.
 */
async function ensureFolderDrive(folderId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: f } = await admin
    .from("document_folders")
    .select("id, nombre, parent_id, drive_folder_id")
    .eq("id", folderId)
    .maybeSingle();
  if (!f) return null;
  if (f.drive_folder_id) return f.drive_folder_id as string;

  const parentDrive = f.parent_id
    ? await ensureFolderDrive(f.parent_id as string)
    : await getDocumentosRootId();
  if (!parentDrive) return null;

  const newId = await createDriveSubfolder(parentDrive, f.nombre as string);
  if (!newId) return null;
  await admin.from("document_folders").update({ drive_folder_id: newId }).eq("id", folderId);
  return newId;
}

/* ───────────────────────── Carpetas ───────────────────────── */

export async function createFolder(raw: unknown): Promise<ActionResult> {
  const parsed = documentFolderSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos de la carpeta.",
      fieldErrors: zodToFieldErrors(parsed.error),
    };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión no válida." };

  const { data: created, error } = await supabase
    .from("document_folders")
    .insert({
      nombre: v.nombre,
      descripcion: v.descripcion || null,
      parent_id: v.parent_id || null,
      allowed_roles: v.allowed_roles ?? [],
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false, message: "No se pudo crear la carpeta (¿permisos?)." };

  // Espeja la carpeta en Drive (si está conectado). Best-effort.
  try {
    await ensureFolderDrive(created.id);
  } catch {
    /* si Drive falla, la carpeta queda igual; se puede sincronizar luego */
  }

  revalidatePath("/dashboard/documentos");
  return { ok: true, message: "Carpeta creada." };
}

export async function updateFolder(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = documentFolderSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos de la carpeta.",
      fieldErrors: zodToFieldErrors(parsed.error),
    };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("document_folders")
    .update({
      nombre: v.nombre,
      descripcion: v.descripcion || null,
      parent_id: v.parent_id || null,
      allowed_roles: v.allowed_roles ?? [],
    })
    .eq("id", id);
  if (error) return { ok: false, message: "No se pudo actualizar la carpeta (¿permisos?)." };
  revalidatePath("/dashboard/documentos");
  return { ok: true, message: "Carpeta actualizada." };
}

export async function deleteFolder(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  // No permitir borrar si tiene documentos o subcarpetas activas.
  const [{ count: docs }, { count: subs }] = await Promise.all([
    supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("folder_id", id)
      .is("deleted_at", null),
    supabase
      .from("document_folders")
      .select("*", { count: "exact", head: true })
      .eq("parent_id", id)
      .is("deleted_at", null),
  ]);
  if ((docs ?? 0) > 0 || (subs ?? 0) > 0) {
    return { ok: false, message: "La carpeta no está vacía. Mueve o elimina su contenido primero." };
  }
  const { error } = await supabase
    .from("document_folders")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: "No se pudo eliminar la carpeta (¿permisos?)." };
  revalidatePath("/dashboard/documentos");
  return { ok: true, message: "Carpeta eliminada." };
}

/* ───────────────────────── Documentos ───────────────────────── */

export async function createDocument(raw: unknown): Promise<ActionResult> {
  const parsed = documentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del documento.",
      fieldErrors: zodToFieldErrors(parsed.error),
    };
  }
  const v = parsed.data;
  if (!v.storage_path && !v.archivo_url) {
    return { ok: false, message: "Sube un archivo o agrega un enlace." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión no válida." };

  let archivoUrl = v.archivo_url || null;
  let storagePath = v.storage_path || null;
  let driveFileId: string | null = null;

  // Documentos NO reservados → se mueven a Drive (a la carpeta espejo). Los
  // 'reservado' permanecen en el bucket privado (descarga por URL firmada).
  if (storagePath && v.confidencialidad !== "reservado") {
    try {
      const driveFolderId = v.folder_id
        ? await ensureFolderDrive(v.folder_id)
        : await getDocumentosRootId();
      if (driveFolderId) {
        const admin = createAdminClient();
        const { data: blob } = await admin.storage.from("documentos").download(storagePath);
        if (blob) {
          const buffer = Buffer.from(await blob.arrayBuffer());
          const res = await uploadBufferToFolder({
            folderId: driveFolderId,
            name: v.original_name || v.titulo,
            mime: v.mime || "application/octet-stream",
            buffer,
          });
          if (res) {
            archivoUrl = res.link;
            driveFileId = res.id;
            await admin.storage.from("documentos").remove([storagePath]);
            storagePath = null;
          }
        }
      }
    } catch {
      /* si Drive falla, se queda en el bucket privado */
    }
  }

  const { error } = await supabase.from("documents").insert({
    titulo: v.titulo,
    descripcion: v.descripcion || null,
    tipo_documento: v.tipo_documento || "general",
    folder_id: v.folder_id || null,
    confidencialidad: v.confidencialidad,
    estado: v.estado,
    contexto_operativo: v.contexto_operativo,
    tags: v.tags ?? [],
    archivo_url: archivoUrl,
    storage_path: storagePath,
    drive_file_id: driveFileId,
    original_name: v.original_name || null,
    mime: v.mime || null,
    size: v.size ?? null,
    creado_por: user.id,
  });
  if (error) return { ok: false, message: "No se pudo guardar el documento (¿permisos?)." };
  revalidatePath("/dashboard/documentos");
  return { ok: true, message: "Documento guardado." };
}

/** Sincroniza/crea en Drive las carpetas documentales que aún no tienen espejo. Solo gestores. */
export async function syncDocumentsToDrive(): Promise<ActionResult<{ creadas: number }>> {
  const user = await getSessionUser();
  const canManage =
    !!user &&
    (user.isAdmin ||
      user.roles.some((r) =>
        ["direccion_general", "coordinador_utl", "juridico_legislativo", "comunicaciones"].includes(r),
      ));
  if (!canManage) return { ok: false, message: "No autorizado." };

  const root = await getDocumentosRootId();
  if (!root) return { ok: false, message: "Conecta Google Drive primero (Configuración → Integraciones)." };

  const admin = createAdminClient();
  const { data: folders } = await admin
    .from("document_folders")
    .select("id, drive_folder_id")
    .is("deleted_at", null);

  let creadas = 0;
  for (const f of folders ?? []) {
    if (!f.drive_folder_id) {
      const id = await ensureFolderDrive(f.id as string);
      if (id) creadas++;
    }
  }
  revalidatePath("/dashboard/documentos");
  return { ok: true, message: `Sincronizado con Drive. ${creadas} carpeta(s) creada(s).`, data: { creadas } };
}

export async function updateDocument(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = documentSchema.partial().safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Datos inválidos." };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("documents")
    .update({
      ...(v.titulo !== undefined ? { titulo: v.titulo } : {}),
      ...(v.descripcion !== undefined ? { descripcion: v.descripcion || null } : {}),
      ...(v.tipo_documento !== undefined ? { tipo_documento: v.tipo_documento || "general" } : {}),
      ...(v.folder_id !== undefined ? { folder_id: v.folder_id || null } : {}),
      ...(v.confidencialidad !== undefined ? { confidencialidad: v.confidencialidad } : {}),
      ...(v.estado !== undefined ? { estado: v.estado } : {}),
      ...(v.contexto_operativo !== undefined ? { contexto_operativo: v.contexto_operativo } : {}),
      ...(v.tags !== undefined ? { tags: v.tags } : {}),
    })
    .eq("id", id);
  if (error) return { ok: false, message: "No se pudo actualizar (¿permisos?)." };
  revalidatePath("/dashboard/documentos");
  return { ok: true, message: "Documento actualizado." };
}

export async function deleteDocument(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: "No se pudo eliminar (¿permisos?)." };

  // Borra el objeto privado de Storage (libera espacio; la fila queda para auditoría).
  const path = (doc as { storage_path: string | null } | null)?.storage_path;
  if (path) {
    const admin = createAdminClient();
    await admin.storage.from("documentos").remove([path]);
  }
  revalidatePath("/dashboard/documentos");
  return { ok: true, message: "Documento eliminado." };
}

/**
 * Devuelve una URL firmada (corta) para descargar/ver un documento.
 * Primero lee la fila con el cliente del usuario: si la RLS no se la entrega
 * (no tiene permiso por su rol), no se genera ningún enlace.
 */
export async function getDocumentDownloadUrl(
  id: string,
): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path, archivo_url")
    .eq("id", id)
    .maybeSingle();

  if (!doc) return { ok: false, message: "No tienes acceso a este documento." };

  const row = doc as { storage_path: string | null; archivo_url: string | null };
  if (row.storage_path) {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from("documentos")
      .createSignedUrl(row.storage_path, 120);
    if (error || !data) return { ok: false, message: "No se pudo generar el enlace." };
    return { ok: true, message: "ok", data: { url: data.signedUrl } };
  }
  if (row.archivo_url) return { ok: true, message: "ok", data: { url: row.archivo_url } };
  return { ok: false, message: "El documento no tiene archivo asociado." };
}
