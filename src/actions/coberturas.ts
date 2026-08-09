"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createCoberturaFolders,
  createResumableUpdate,
  createResumableUpload,
  deleteDriveFile,
  driveViewLink,
  getDriveConfig,
  makeDriveFilePublic,
  moveDriveFile,
  renameDriveFile,
  uploadBufferToFolder,
} from "@/lib/google-drive";
import { logActivity } from "@/lib/activity";
import { type ActionResult } from "./types";

export type Fase = "crudo" | "editado" | "aprobado";

const FASES: Fase[] = ["crudo", "editado", "aprobado"];

const FASE_LABEL: Record<Fase, string> = {
  crudo: "Contenido Crudo",
  editado: "Contenido Editado",
  aprobado: "Contenido Aprobado",
};

export interface Cobertura {
  id: string;
  nombre: string;
  descripcion: string | null;
  fecha: string | null;
  lugar: string | null;
  estado: string;
  drive_link: string | null;
  drive_folder_id: string | null;
  drive_crudo_id: string | null;
  drive_editado_id: string | null;
  drive_aprobado_id: string | null;
}

export interface CoberturaFile {
  id: string;
  cobertura_id: string;
  fase: Fase;
  nombre: string;
  url: string;
  drive_file_id: string | null;
  storage_path: string | null;
  mime: string | null;
  size: number | null;
  descripcion: string | null;
  tags: string[];
  destacado: boolean;
  orden: number;
  origen_file_id: string | null;
  version: number;
  created_at: string;
}

export async function listCoberturas(): Promise<Cobertura[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coberturas")
    .select("*")
    .is("deleted_at", null)
    .order("fecha", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(500);
  return (data as Cobertura[]) ?? [];
}

export async function getCoberturaDetail(id: string): Promise<{
  cobertura: Cobertura | null;
  files: Record<Fase, CoberturaFile[]>;
}> {
  const supabase = await createClient();
  const [{ data: cob }, { data: files }] = await Promise.all([
    supabase.from("coberturas").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
    supabase
      .from("cobertura_files")
      .select("*")
      .eq("cobertura_id", id)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: false }),
  ]);
  const grouped: Record<Fase, CoberturaFile[]> = { crudo: [], editado: [], aprobado: [] };
  for (const f of (files as CoberturaFile[]) ?? []) grouped[f.fase]?.push(f);
  return { cobertura: (cob as Cobertura) ?? null, files: grouped };
}

export async function createCobertura(input: {
  nombre: string;
  descripcion?: string;
  fecha?: string;
  lugar?: string;
}): Promise<ActionResult<{ id: string }>> {
  if (!input.nombre?.trim()) return { ok: false, message: "El nombre es obligatorio." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("coberturas")
    .insert({
      nombre: input.nombre.trim(),
      descripcion: input.descripcion?.trim() || null,
      fecha: input.fecha || null,
      lugar: input.lugar?.trim() || null,
      responsable_id: user?.id ?? null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: "No se pudo crear la cobertura (¿permisos?)." };

  // Crea la carpeta en Drive con sus 3 subcarpetas (si Drive está conectado).
  try {
    const folders = await createCoberturaFolders(input.nombre.trim());
    if (folders) {
      const admin = createAdminClient();
      await admin
        .from("coberturas")
        .update({
          drive_folder_id: folders.root,
          drive_crudo_id: folders.crudo,
          drive_editado_id: folders.editado,
          drive_aprobado_id: folders.aprobado,
          drive_link: folders.link,
        })
        .eq("id", data.id);
    }
  } catch {
    /* si Drive falla, la cobertura igual queda creada (se puede reparar luego) */
  }

  revalidatePath("/dashboard/comunicaciones/coberturas");
  return { ok: true, message: "Cobertura creada.", data: { id: data.id } };
}

export async function updateCoberturaEstado(id: string, estado: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("coberturas").update({ estado }).eq("id", id);
  if (error) return { ok: false, message: "No se pudo actualizar." };
  revalidatePath(`/dashboard/comunicaciones/coberturas/${id}`);
  return { ok: true, message: "Estado actualizado." };
}

export async function softDeleteCobertura(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("coberturas")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: "No se pudo eliminar." };
  revalidatePath("/dashboard/comunicaciones/coberturas");
  return { ok: true, message: "Cobertura eliminada." };
}

/** Crea/repara la carpeta de Drive de una cobertura existente. */
export async function repairCoberturaDrive(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: cob } = await supabase.from("coberturas").select("nombre, drive_folder_id").eq("id", id).maybeSingle();
  if (!cob) return { ok: false, message: "Cobertura no encontrada." };
  const cfg = await getDriveConfig();
  if (!cfg.connected) return { ok: false, message: "Conecta Google Drive primero (Configuración → Integraciones)." };
  const folders = await createCoberturaFolders(cob.nombre);
  if (!folders) return { ok: false, message: "No se pudo crear la carpeta en Drive." };
  const admin = createAdminClient();
  await admin
    .from("coberturas")
    .update({
      drive_folder_id: folders.root,
      drive_crudo_id: folders.crudo,
      drive_editado_id: folders.editado,
      drive_aprobado_id: folders.aprobado,
      drive_link: folders.link,
    })
    .eq("id", id);
  revalidatePath(`/dashboard/comunicaciones/coberturas/${id}`);
  return { ok: true, message: "Carpeta de Drive creada/reparada." };
}

/**
 * Registra un archivo ya subido a Supabase (bucket 'coberturas'). Si Drive está
 * conectado, lo mueve a la subcarpeta de la fase y borra la copia temporal.
 */
export async function addCoberturaFile(input: {
  cobertura_id: string;
  fase: Fase;
  path: string;
  name: string;
  mime: string;
  size?: number;
  origen_file_id?: string | null;
}): Promise<ActionResult<CoberturaFile>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = createAdminClient();

  const publicUrl = admin.storage.from("coberturas").getPublicUrl(input.path).data.publicUrl;
  let url = publicUrl;
  let driveFileId: string | null = null;
  let storagePath: string | null = input.path;

  try {
    const { data: cob } = await admin
      .from("coberturas")
      .select("drive_crudo_id, drive_editado_id, drive_aprobado_id")
      .eq("id", input.cobertura_id)
      .maybeSingle();
    const folderId =
      input.fase === "crudo" ? cob?.drive_crudo_id
      : input.fase === "editado" ? cob?.drive_editado_id
      : cob?.drive_aprobado_id;

    if (folderId) {
      const { data: blob } = await admin.storage.from("coberturas").download(input.path);
      if (blob) {
        const buffer = Buffer.from(await blob.arrayBuffer());
        const res = await uploadBufferToFolder({ folderId, name: input.name, mime: input.mime, buffer });
        if (res) {
          url = res.link;
          driveFileId = res.id;
          await admin.storage.from("coberturas").remove([input.path]);
          storagePath = null;
        }
      }
    }
  } catch {
    /* deja la copia de Supabase si Drive falla */
  }

  const { data, error } = await supabase
    .from("cobertura_files")
    .insert({
      cobertura_id: input.cobertura_id,
      fase: input.fase,
      nombre: input.name,
      url,
      drive_file_id: driveFileId,
      storage_path: storagePath,
      mime: input.mime || null,
      size: input.size ?? null,
      orden: await nextOrden(input.cobertura_id, input.fase),
      origen_file_id: input.origen_file_id ?? null,
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false, message: "No se pudo registrar el archivo." };

  await logActivity("subida", "cobertura", input.cobertura_id, `${input.fase}: ${input.name}`);
  revalidatePath(`/dashboard/comunicaciones/coberturas/${input.cobertura_id}`);
  return { ok: true, message: "Archivo agregado.", data: data as CoberturaFile };
}

export async function removeCoberturaFile(id: string, storagePath?: string | null): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: file } = await supabase
    .from("cobertura_files")
    .select("drive_file_id, storage_path, nombre, cobertura_id")
    .eq("id", id)
    .maybeSingle();

  const path = storagePath ?? file?.storage_path ?? null;
  if (path) await supabase.storage.from("coberturas").remove([path]);

  const { error } = await supabase.from("cobertura_files").delete().eq("id", id);
  if (error) return { ok: false, message: "No se pudo eliminar." };

  // Solo después de borrar la fila: si Drive falla, no dejamos una tarjeta
  // apuntando a un archivo que ya no existe.
  if (file?.drive_file_id) await deleteDriveFile(file.drive_file_id);
  if (file) await logActivity("eliminacion", "cobertura", file.cobertura_id, file.nombre);

  return { ok: true, message: "Archivo eliminado." };
}

/* ────────────────────── Galería: subida, orden y ficha ────────────────────── */

/** Id de la subcarpeta de Drive que corresponde a una fase. */
async function faseFolderId(coberturaId: string, fase: Fase): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("coberturas")
    .select("drive_crudo_id, drive_editado_id, drive_aprobado_id")
    .eq("id", coberturaId)
    .maybeSingle();
  if (!data) return null;
  if (fase === "crudo") return data.drive_crudo_id;
  if (fase === "editado") return data.drive_editado_id;
  return data.drive_aprobado_id;
}

export type UploadTicket =
  /** Drive conectado: el navegador sube los trozos directamente a Google. */
  | { mode: "drive"; uploadUrl: string }
  /** Sin Drive: se usa el bucket de Supabase, como antes. */
  | { mode: "storage" };

/**
 * Prepara la subida de un archivo. Con Drive conectado devuelve una sesión
 * reanudable para que los bytes vayan del navegador a Google sin pasar por
 * Vercel: así no hay límite de tamaño ni de duración de la función.
 */
export async function startCoberturaUpload(input: {
  cobertura_id: string;
  fase: Fase;
  name: string;
  mime: string;
  size: number;
}): Promise<ActionResult<UploadTicket>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión no válida." };
  if (!FASES.includes(input.fase)) return { ok: false, message: "Fase no válida." };

  const folderId = await faseFolderId(input.cobertura_id, input.fase);
  if (!folderId) return { ok: true, message: "ok", data: { mode: "storage" } };

  const uploadUrl = await createResumableUpload({
    folderId,
    name: input.name,
    mime: input.mime,
    size: input.size,
  });
  if (!uploadUrl) return { ok: true, message: "ok", data: { mode: "storage" } };

  return { ok: true, message: "ok", data: { mode: "drive", uploadUrl } };
}

/** Registra en la base de datos un archivo que el navegador ya subió a Drive. */
export async function finishCoberturaUpload(input: {
  cobertura_id: string;
  fase: Fase;
  drive_file_id: string;
  name: string;
  mime: string;
  size: number;
  origen_file_id?: string | null;
}): Promise<ActionResult<CoberturaFile>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await makeDriveFilePublic(input.drive_file_id);

  const { data, error } = await supabase
    .from("cobertura_files")
    .insert({
      cobertura_id: input.cobertura_id,
      fase: input.fase,
      nombre: input.name,
      url: driveViewLink(input.drive_file_id),
      drive_file_id: input.drive_file_id,
      storage_path: null,
      mime: input.mime || null,
      size: input.size ?? null,
      orden: await nextOrden(input.cobertura_id, input.fase),
      origen_file_id: input.origen_file_id ?? null,
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false, message: "No se pudo registrar el archivo." };

  await logActivity("subida", "cobertura", input.cobertura_id, `${input.fase}: ${input.name}`);
  revalidatePath(`/dashboard/comunicaciones/coberturas/${input.cobertura_id}`);
  return { ok: true, message: "Archivo agregado.", data: data as CoberturaFile };
}

async function nextOrden(coberturaId: string, fase: Fase): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("cobertura_files")
    .select("orden")
    .eq("cobertura_id", coberturaId)
    .eq("fase", fase)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.orden ?? 0) + 1;
}

/**
 * Cambia un archivo de fase y fija el orden de la columna destino.
 * Mueve también el archivo en Drive, para que la carpeta refleje lo que se ve.
 */
export async function moveCoberturaFile(input: {
  file_id: string;
  fase: Fase;
  /** Ids de la columna destino en su orden final, incluido el que se mueve. */
  orden_destino: string[];
}): Promise<ActionResult> {
  if (!FASES.includes(input.fase)) return { ok: false, message: "Fase no válida." };
  const supabase = await createClient();

  const { data: file } = await supabase
    .from("cobertura_files")
    .select("cobertura_id, fase, nombre, drive_file_id")
    .eq("id", input.file_id)
    .maybeSingle();
  if (!file) return { ok: false, message: "Archivo no encontrado." };

  const { error } = await supabase
    .from("cobertura_files")
    .update({ fase: input.fase })
    .eq("id", input.file_id);
  if (error) return { ok: false, message: "No se pudo mover el archivo." };

  await applyOrden(input.orden_destino);

  if (file.fase !== input.fase && file.drive_file_id) {
    const folderId = await faseFolderId(file.cobertura_id, input.fase);
    // Si Drive falla, la tarjeta ya está en su nueva columna; la carpeta se
    // corrige al volver a moverla o desde "Crear carpeta en Drive".
    if (folderId) await moveDriveFile(file.drive_file_id, folderId);
    await logActivity(
      "movimiento",
      "cobertura",
      file.cobertura_id,
      `${file.nombre}: ${FASE_LABEL[file.fase as Fase]} → ${FASE_LABEL[input.fase]}`,
    );
  }

  revalidatePath(`/dashboard/comunicaciones/coberturas/${file.cobertura_id}`);
  return { ok: true, message: `Movido a ${FASE_LABEL[input.fase]}.` };
}

/** Reordena una columna sin cambiar de fase. */
export async function reorderCoberturaFiles(ids: string[]): Promise<ActionResult> {
  await applyOrden(ids);
  return { ok: true, message: "Orden actualizado." };
}

/** Una sola sentencia para toda la columna: arrastrar no debe costar N viajes. */
async function applyOrden(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = await createClient();
  await supabase.rpc("reordenar_cobertura_files", { p_ids: ids });
}

/** Edita la ficha de un archivo. El renombrado se refleja también en Drive. */
export async function updateCoberturaFileMeta(input: {
  file_id: string;
  nombre?: string;
  descripcion?: string | null;
  tags?: string[];
  destacado?: boolean;
}): Promise<ActionResult<CoberturaFile>> {
  const supabase = await createClient();

  const nombre = input.nombre?.trim();
  if (input.nombre !== undefined && !nombre) {
    return { ok: false, message: "Revisa los campos.", fieldErrors: { nombre: "El nombre no puede quedar vacío." } };
  }

  const patch: Record<string, unknown> = {};
  if (nombre) patch.nombre = nombre;
  if (input.descripcion !== undefined) patch.descripcion = input.descripcion?.trim() || null;
  if (input.tags !== undefined) patch.tags = input.tags.map((t) => t.trim()).filter(Boolean);
  if (input.destacado !== undefined) patch.destacado = input.destacado;
  if (Object.keys(patch).length === 0) return { ok: false, message: "No hay cambios que guardar." };

  const { data, error } = await supabase
    .from("cobertura_files")
    .update(patch)
    .eq("id", input.file_id)
    .select("*")
    .single();
  if (error || !data) return { ok: false, message: "No se pudo guardar la ficha." };

  if (nombre && data.drive_file_id) await renameDriveFile(data.drive_file_id, nombre);

  revalidatePath(`/dashboard/comunicaciones/coberturas/${data.cobertura_id}`);
  return { ok: true, message: "Ficha guardada.", data: data as CoberturaFile };
}

/**
 * Prepara el reemplazo del contenido de un archivo conservando su id, su enlace
 * y su posición. Drive guarda la versión anterior en su historial de revisiones.
 */
export async function startCoberturaReplace(input: {
  file_id: string;
  mime: string;
  size: number;
}): Promise<ActionResult<UploadTicket>> {
  const supabase = await createClient();
  const { data: file } = await supabase
    .from("cobertura_files")
    .select("drive_file_id")
    .eq("id", input.file_id)
    .maybeSingle();
  if (!file) return { ok: false, message: "Archivo no encontrado." };
  if (!file.drive_file_id) {
    return { ok: false, message: "Solo se pueden reemplazar archivos alojados en Drive." };
  }

  const uploadUrl = await createResumableUpdate({
    fileId: file.drive_file_id,
    mime: input.mime,
    size: input.size,
  });
  if (!uploadUrl) return { ok: false, message: "No se pudo preparar el reemplazo en Drive." };

  return { ok: true, message: "ok", data: { mode: "drive", uploadUrl } };
}

/** Cierra el reemplazo: actualiza nombre, tipo, tamaño y sube el número de versión. */
export async function finishCoberturaReplace(input: {
  file_id: string;
  name: string;
  mime: string;
  size: number;
}): Promise<ActionResult<CoberturaFile>> {
  const supabase = await createClient();
  const { data: prev } = await supabase
    .from("cobertura_files")
    .select("version, drive_file_id, cobertura_id")
    .eq("id", input.file_id)
    .maybeSingle();
  if (!prev) return { ok: false, message: "Archivo no encontrado." };

  const { data, error } = await supabase
    .from("cobertura_files")
    .update({
      nombre: input.name,
      mime: input.mime || null,
      size: input.size ?? null,
      version: (prev.version ?? 1) + 1,
    })
    .eq("id", input.file_id)
    .select("*")
    .single();
  if (error || !data) return { ok: false, message: "No se pudo registrar la nueva versión." };

  if (prev.drive_file_id) await renameDriveFile(prev.drive_file_id, input.name);
  await logActivity(
    "version",
    "cobertura",
    prev.cobertura_id,
    `${input.name} → v${(prev.version ?? 1) + 1}`,
  );

  revalidatePath(`/dashboard/comunicaciones/coberturas/${prev.cobertura_id}`);
  return { ok: true, message: `Versión ${(prev.version ?? 1) + 1} guardada.`, data: data as CoberturaFile };
}
