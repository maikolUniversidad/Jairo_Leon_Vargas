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
  const { error } = await supabase.from("tasks").insert({
    titulo: v.titulo,
    descripcion: v.descripcion || null,
    prioridad: v.prioridad,
    estado: v.estado,
    responsable_id: v.responsable_id || null,
    fecha_limite: v.fecha_limite || null,
    creador_id: user.id,
    contexto_operativo: v.contexto_operativo,
  });

  if (error) {
    return { ok: false, message: "No se pudo crear la tarea (¿permisos?)." };
  }

  revalidatePath("/dashboard/tareas");
  return { ok: true, message: "Tarea creada." };
}

/** Detalle de una tarea: historial, comentarios y checklist. */
export async function getTaskDetail(taskId: string) {
  const supabase = await createClient();
  const [{ data: history }, { data: comments }, { data: checklist }] =
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
    ]);
  return {
    history: history ?? [],
    comments: comments ?? [],
    checklist: checklist ?? [],
  };
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
