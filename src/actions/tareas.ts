"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { taskSchema } from "@/lib/validations";
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
