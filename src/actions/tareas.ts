"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  taskSchema,
  taskCommentSchema,
  checklistItemSchema,
} from "@/lib/validations";
import { type ActionResult, zodToFieldErrors } from "./types";

/** Crea una tarea (RLS exige rol de staff). El creador se toma de la sesión. */
export async function createTask(raw: unknown): Promise<ActionResult> {
  const parsed = taskSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los campos.",
      fieldErrors: zodToFieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión no válida." };

  const v = parsed.data;
  const responsables = v.responsables ?? [];
  const participantes = (v.participantes ?? []).filter((p) => !responsables.includes(p));

  const { data: created, error } = await supabase
    .from("tasks")
    .insert({
      titulo: v.titulo,
      descripcion: v.descripcion || null,
      prioridad: v.prioridad,
      estado: v.estado,
      responsable_id: responsables[0] || v.responsable_id || null,
      workspace_id: v.workspace_id || null,
      contact_id: v.contact_id || null,
      fecha_limite: v.fecha_limite || null,
      creador_id: user.id,
      contexto_operativo: v.contexto_operativo,
    })
    .select("id")
    .single();

  if (error || !created) {
    return { ok: false, message: "No se pudo crear la tarea (¿permisos?)." };
  }

  const rows = [
    ...responsables.map((u) => ({ task_id: created.id, user_id: u, rol: "responsable" })),
    ...participantes.map((u) => ({ task_id: created.id, user_id: u, rol: "participante" })),
  ];
  if (rows.length > 0) await supabase.from("task_assignees").insert(rows);

  revalidatePath("/dashboard/tareas");
  return { ok: true, message: "Tarea creada." };
}

/** Agrega un responsable/participante a una tarea. */
export async function addTaskAssignee(
  taskId: string,
  userId: string,
  rol: "responsable" | "participante",
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_assignees")
    .upsert({ task_id: taskId, user_id: userId, rol }, { onConflict: "task_id,user_id" });
  if (error) return { ok: false, message: "No se pudo asignar (¿permisos?)." };
  revalidatePath("/dashboard/tareas");
  return { ok: true, message: "Persona asignada." };
}

/** Quita una persona de una tarea. */
export async function removeTaskAssignee(
  taskId: string,
  userId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_assignees")
    .delete()
    .eq("task_id", taskId)
    .eq("user_id", userId);
  if (error) return { ok: false, message: "No se pudo quitar." };
  revalidatePath("/dashboard/tareas");
  return { ok: true, message: "Persona removida." };
}

/** Detalle de una tarea: historial, comentarios, checklist y asignados. */
export async function getTaskDetail(taskId: string) {
  const supabase = await createClient();
  const [{ data: history }, { data: comments }, { data: checklist }, { data: assignees }] =
    await Promise.all([
      supabase
        .from("task_history")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false }),
      supabase
        .from("task_comments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false }),
      supabase
        .from("task_checklist")
        .select("*")
        .eq("task_id", taskId)
        .order("orden", { ascending: true }),
      supabase.from("task_assignees").select("user_id, rol").eq("task_id", taskId),
    ]);
  const { data: attachments } = await supabase
    .from("task_attachments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  return {
    history: history ?? [],
    comments: comments ?? [],
    checklist: checklist ?? [],
    assignees: assignees ?? [],
    attachments: attachments ?? [],
  };
}

/** Agrega un adjunto (archivo ya subido a Storage, o un enlace) a la tarea. */
export async function addTaskAttachment(input: {
  task_id: string;
  tipo: "archivo" | "link";
  nombre: string;
  url: string;
  storage_path?: string;
  mime?: string;
  size?: number;
  etiqueta?: string;
  estado?: string;
  es_requisito?: boolean;
  descripcion?: string;
}): Promise<ActionResult> {
  if (!input.url?.trim() || !input.nombre?.trim())
    return { ok: false, message: "Faltan datos del adjunto." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("task_attachments").insert({
    task_id: input.task_id,
    tipo: input.tipo,
    nombre: input.nombre.trim(),
    url: input.url.trim(),
    storage_path: input.storage_path ?? null,
    mime: input.mime ?? null,
    size: input.size ?? null,
    etiqueta: input.etiqueta || null,
    estado: input.estado || "entregado",
    es_requisito: input.es_requisito ?? false,
    descripcion: input.descripcion || null,
    created_by: user?.id ?? null,
  });
  if (error) return { ok: false, message: "No se pudo guardar el adjunto (¿permisos?)." };
  revalidatePath("/dashboard/tareas");
  return { ok: true, message: "Adjunto agregado." };
}

/** Actualiza metadatos de un adjunto (etiqueta, estado, requisito). */
export async function updateTaskAttachment(
  id: string,
  patch: { etiqueta?: string; estado?: string; es_requisito?: boolean },
): Promise<ActionResult> {
  const supabase = await createClient();
  const clean: Record<string, unknown> = {};
  if (patch.etiqueta !== undefined) clean.etiqueta = patch.etiqueta || null;
  if (patch.estado !== undefined) clean.estado = patch.estado;
  if (patch.es_requisito !== undefined) clean.es_requisito = patch.es_requisito;
  const { error } = await supabase.from("task_attachments").update(clean).eq("id", id);
  if (error) return { ok: false, message: "No se pudo actualizar." };
  revalidatePath("/dashboard/tareas");
  return { ok: true, message: "Adjunto actualizado." };
}

/** Elimina un adjunto (y el objeto en Storage si aplica). */
export async function removeTaskAttachment(
  id: string,
  storagePath?: string | null,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (storagePath) {
    await supabase.storage.from("task-files").remove([storagePath]);
  }
  const { error } = await supabase.from("task_attachments").delete().eq("id", id);
  if (error) return { ok: false, message: "No se pudo eliminar el adjunto." };
  revalidatePath("/dashboard/tareas");
  return { ok: true, message: "Adjunto eliminado." };
}

/** Asignados de varias tareas (para el tablero). */
export async function getAssigneesFor(taskIds: string[]) {
  if (taskIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_assignees")
    .select("task_id, user_id, rol")
    .in("task_id", taskIds);
  return data ?? [];
}

/** Cambia el estado de una tarea. */
export async function updateTaskStatus(
  id: string,
  estado: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ estado })
    .eq("id", id);
  if (error) return { ok: false, message: "No se pudo actualizar." };
  revalidatePath("/dashboard/tareas");
  return { ok: true, message: "Estado actualizado." };
}

/** Asigna (o reasigna) la tarea a un usuario específico. */
export async function assignTask(
  id: string,
  responsableId: string | null,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ responsable_id: responsableId })
    .eq("id", id);
  if (error) return { ok: false, message: "No se pudo asignar." };
  revalidatePath("/dashboard/tareas");
  return { ok: true, message: "Tarea asignada." };
}

/** Soft delete. */
export async function softDeleteTask(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: "No se pudo eliminar." };
  revalidatePath("/dashboard/tareas");
  return { ok: true, message: "Tarea eliminada." };
}

/** Agrega un comentario a la tarea. */
export async function addTaskComment(raw: unknown): Promise<ActionResult> {
  const parsed = taskCommentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Escribe un comentario válido." };
  const v = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("task_comments").insert({
    task_id: v.task_id,
    comentario: v.comentario,
    author_id: user?.id ?? null,
  });
  if (error) return { ok: false, message: "No se pudo guardar el comentario." };
  revalidatePath("/dashboard/tareas");
  return { ok: true, message: "Comentario agregado." };
}

/** Agrega un ítem al checklist de la tarea. */
export async function addChecklistItem(raw: unknown): Promise<ActionResult> {
  const parsed = checklistItemSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Escribe el ítem." };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("task_checklist").insert({
    task_id: v.task_id,
    texto: v.texto,
  });
  if (error) return { ok: false, message: "No se pudo agregar el ítem." };
  revalidatePath("/dashboard/tareas");
  return { ok: true, message: "Ítem agregado." };
}

/** Marca/desmarca un ítem del checklist. */
export async function toggleChecklistItem(
  id: string,
  completado: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_checklist")
    .update({ completado })
    .eq("id", id);
  if (error) return { ok: false, message: "No se pudo actualizar." };
  revalidatePath("/dashboard/tareas");
  return { ok: true, message: "Checklist actualizado." };
}
