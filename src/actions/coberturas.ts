"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCoberturaFolders, uploadBufferToFolder, getDriveConfig } from "@/lib/google-drive";
import { type ActionResult } from "./types";

export type Fase = "crudo" | "editado" | "aprobado";

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
  fase: Fase;
  nombre: string;
  url: string;
  storage_path: string | null;
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
    supabase.from("cobertura_files").select("*").eq("cobertura_id", id).order("created_at", { ascending: false }),
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
}): Promise<ActionResult> {
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

  const { error } = await supabase.from("cobertura_files").insert({
    cobertura_id: input.cobertura_id,
    fase: input.fase,
    nombre: input.name,
    url,
    drive_file_id: driveFileId,
    storage_path: storagePath,
    mime: input.mime || null,
    size: input.size ?? null,
    created_by: user?.id ?? null,
  });
  if (error) return { ok: false, message: "No se pudo registrar el archivo." };

  revalidatePath(`/dashboard/comunicaciones/coberturas/${input.cobertura_id}`);
  return { ok: true, message: "Archivo agregado." };
}

export async function removeCoberturaFile(id: string, storagePath?: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  if (storagePath) await supabase.storage.from("coberturas").remove([storagePath]);
  const { error } = await supabase.from("cobertura_files").delete().eq("id", id);
  if (error) return { ok: false, message: "No se pudo eliminar." };
  return { ok: true, message: "Archivo eliminado." };
}
