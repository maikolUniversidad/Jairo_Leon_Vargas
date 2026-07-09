"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { type ActionResult } from "./types";
import type { Zone, ZoneType, Task } from "@/types/database";

/** Busca o crea una zona por nombre+tipo y devuelve su fila completa. */
export async function ensureZone(
  nombre: string,
  tipo: ZoneType = "localidad",
  codigo?: string | null,
): Promise<ActionResult<{ zone: Zone }>> {
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("ensure_zone", {
    p_nombre: nombre,
    p_tipo: tipo,
    p_codigo: codigo ?? null,
  });
  if (error || !id) return { ok: false, message: "No se pudo preparar la zona." };

  const { data: zone } = await supabase.from("zones").select("*").eq("id", id).single();
  revalidatePath("/dashboard/territorio");
  return { ok: true, message: "ok", data: { zone: zone as Zone } };
}

/** Detalle de una zona + sus tareas (las mismas que el Kanban). */
export async function getZoneDetail(zoneId: string): Promise<{
  zone: Zone | null;
  tasks: Pick<Task, "id" | "titulo" | "estado" | "prioridad" | "fecha_limite" | "responsable_id">[];
  leaders: { id: string; nombre: string; rol: string | null; telefono: string | null }[];
}> {
  const supabase = await createClient();
  const [{ data: zone }, { data: tasks }, { data: leaders }] = await Promise.all([
    supabase.from("zones").select("*").eq("id", zoneId).maybeSingle(),
    supabase
      .from("tasks")
      .select("id, titulo, estado, prioridad, fecha_limite, responsable_id")
      .eq("zona_id", zoneId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("zone_leaders")
      .select("id, nombre, rol, telefono")
      .eq("zone_id", zoneId)
      .order("nombre"),
  ]);
  return {
    zone: (zone as Zone) ?? null,
    tasks: (tasks as never) ?? [],
    leaders: (leaders as never) ?? [],
  };
}

/** Crea una tarea ligada a una zona (aparece también en el Kanban). */
export async function createZoneTask(input: {
  zona_id: string;
  titulo: string;
  descripcion?: string;
  prioridad?: "baja" | "media" | "alta" | "urgente";
  fecha_limite?: string;
  responsable_id?: string;
}): Promise<ActionResult> {
  if (!input.titulo?.trim() || input.titulo.trim().length < 3) {
    return { ok: false, message: "El título de la tarea es muy corto." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión no válida." };

  const { data: created, error } = await supabase
    .from("tasks")
    .insert({
      titulo: input.titulo.trim(),
      descripcion: input.descripcion?.trim() || null,
      prioridad: input.prioridad ?? "media",
      estado: "pendiente",
      zona_id: input.zona_id,
      responsable_id: input.responsable_id || null,
      fecha_limite: input.fecha_limite || null,
      creador_id: user.id,
      contexto_operativo: "comunitario",
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false, message: "No se pudo crear la tarea." };

  // Si hay responsable, también lo registramos como asignado (para el tablero).
  if (input.responsable_id) {
    await supabase
      .from("task_assignees")
      .insert({ task_id: created.id, user_id: input.responsable_id, rol: "responsable" });
  }

  revalidatePath("/dashboard/territorio");
  revalidatePath("/dashboard/tareas");
  return { ok: true, message: "Tarea creada y ligada al Kanban." };
}

/** Actualiza datos de gestión de la zona (solo coordinación, por RLS). */
export async function updateZone(
  zoneId: string,
  patch: {
    descripcion?: string;
    prioridad?: "baja" | "media" | "alta" | "urgente";
    estado?: string;
    problematicas?: string[];
    responsable_id?: string | null;
  },
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("zones")
    .update({
      ...(patch.descripcion !== undefined ? { descripcion: patch.descripcion || null } : {}),
      ...(patch.prioridad !== undefined ? { prioridad: patch.prioridad } : {}),
      ...(patch.estado !== undefined ? { estado: patch.estado } : {}),
      ...(patch.problematicas !== undefined ? { problematicas: patch.problematicas } : {}),
      ...(patch.responsable_id !== undefined ? { responsable_id: patch.responsable_id || null } : {}),
    })
    .eq("id", zoneId);
  if (error) return { ok: false, message: "No se pudo actualizar la zona (¿permisos?)." };
  revalidatePath("/dashboard/territorio");
  return { ok: true, message: "Zona actualizada." };
}

/** Agrega un líder/contacto a la zona. */
export async function addZoneLeader(input: {
  zone_id: string;
  nombre: string;
  rol?: string;
  telefono?: string;
  email?: string;
}): Promise<ActionResult> {
  if (!input.nombre?.trim()) return { ok: false, message: "Escribe el nombre del líder." };
  const supabase = await createClient();
  const { error } = await supabase.from("zone_leaders").insert({
    zone_id: input.zone_id,
    nombre: input.nombre.trim(),
    rol: input.rol?.trim() || null,
    telefono: input.telefono?.trim() || null,
    email: input.email?.trim() || null,
  });
  if (error) return { ok: false, message: "No se pudo agregar el líder (¿permisos?)." };
  revalidatePath("/dashboard/territorio");
  return { ok: true, message: "Líder agregado." };
}
