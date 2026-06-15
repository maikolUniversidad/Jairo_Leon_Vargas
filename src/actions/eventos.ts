"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { eventSignupSchema, eventCreateSchema } from "@/lib/validations";
import { type ActionResult, zodToFieldErrors } from "./types";

/** Crea un evento de agenda interna desde el dashboard. */
export async function createEvent(raw: unknown): Promise<ActionResult> {
  const parsed = eventCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los campos del evento.",
      fieldErrors: zodToFieldErrors(parsed.error),
    };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión no válida." };

  const { error } = await supabase.from("events").insert({
    titulo: v.titulo,
    descripcion: v.descripcion || null,
    tipo: v.tipo || "evento_comunitario",
    fecha_inicio: new Date(v.fecha_inicio).toISOString(),
    fecha_fin: v.fecha_fin ? new Date(v.fecha_fin).toISOString() : null,
    lugar: v.lugar || null,
    modalidad: v.modalidad,
    visibilidad: v.visibilidad,
    estado: v.estado,
    link_reunion: v.link_reunion || null,
    contexto_operativo: v.contexto_operativo,
    responsable_id: user.id,
    created_by: user.id,
  });
  if (error) {
    return { ok: false, message: "No se pudo crear el evento (¿permisos?)." };
  }
  revalidatePath("/dashboard/calendario");
  return { ok: true, message: "Evento creado." };
}

/**
 * Publica o vuelve interno un evento.
 * Publicar = visible en la agenda web (visibilidad pública + estado confirmado).
 */
export async function setEventPublish(
  id: string,
  publicar: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const patch = publicar
    ? { visibilidad: "publica", estado: "confirmado" }
    : { visibilidad: "interna" };
  const { error } = await supabase.from("events").update(patch).eq("id", id);
  if (error) return { ok: false, message: "No se pudo actualizar (¿permisos?)." };
  revalidatePath("/dashboard/calendario");
  revalidatePath("/agenda");
  return {
    ok: true,
    message: publicar ? "Evento publicado en la agenda web." : "Evento marcado como interno.",
  };
}

/** Soft delete de un evento. */
export async function softDeleteEvent(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: "No se pudo eliminar." };
  revalidatePath("/dashboard/calendario");
  revalidatePath("/agenda");
  return { ok: true, message: "Evento eliminado." };
}

/** Inscripción pública a un evento (RLS: event_attendees_public_insert). */
export async function registerAttendee(
  raw: unknown,
): Promise<ActionResult> {
  const parsed = eventSignupSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los campos del formulario.",
      fieldErrors: zodToFieldErrors(parsed.error),
    };
  }

  const v = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("event_attendees").insert({
    event_id: v.event_id,
    nombre: v.nombre,
    telefono: v.telefono || null,
    email: v.email || null,
    barrio: v.barrio || null,
    consentimiento_datos: true,
  });

  if (error) {
    return { ok: false, message: "No pudimos registrar tu inscripción." };
  }

  return { ok: true, message: "¡Inscripción confirmada! Te esperamos." };
}
