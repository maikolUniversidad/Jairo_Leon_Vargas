"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  citizenRequestSchema,
  territorialProposalSchema,
  publicSolicitudSchema,
  requestManageSchema,
  requestNoteSchema,
  REQUEST_CATEGORY_LABELS,
  type RequestCategory,
} from "@/lib/validations";
import { type ActionResult, zodToFieldErrors } from "./types";

/** Prioridad y contexto sugeridos según la categoría. */
const CATEGORY_DEFAULTS: Record<
  RequestCategory,
  { prioridad: "baja" | "media" | "alta" | "urgente"; contexto: "institucional" | "comunitario" }
> = {
  salud: { prioridad: "alta", contexto: "institucional" },
  entidad: { prioridad: "media", contexto: "institucional" },
  hoja_vida: { prioridad: "media", contexto: "comunitario" },
  peticion_general: { prioridad: "media", contexto: "comunitario" },
  apunte: { prioridad: "baja", contexto: "comunitario" },
};

/**
 * Crea una solicitud categorizada (modelo BASE SOLICITUDES) desde la landing.
 * Devuelve el radicado generado por el trigger `set_request_radicado`.
 */
export async function createPublicRequest(
  raw: unknown,
): Promise<ActionResult<{ radicado: string }>> {
  const parsed = publicSolicitudSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los campos del formulario.",
      fieldErrors: zodToFieldErrors(parsed.error),
    };
  }

  const v = parsed.data;
  const def = CATEGORY_DEFAULTS[v.categoria];
  // Inserción pública controlada: validada por Zod + consentimiento. Usamos el
  // cliente admin para poder devolver el radicado (anon no tiene SELECT en requests).
  const supabase = createAdminClient();

  const asunto =
    (v.asunto && v.asunto.trim()) ||
    `${REQUEST_CATEGORY_LABELS[v.categoria]} · ${v.nombre}`;

  const { data, error } = await supabase
    .from("requests")
    .insert({
      tipo_solicitud: v.categoria,
      asunto,
      descripcion: v.descripcion,
      nombre_solicitante: v.nombre,
      documento: v.documento || null,
      telefono: v.telefono || null,
      email: v.email || null,
      direccion: v.direccion || null,
      localidad: v.localidad || null,
      barrio: v.barrio || null,
      edad: typeof v.edad === "number" ? v.edad : null,
      eps: v.eps || null,
      diagnostico: v.diagnostico || null,
      entidad: v.entidad || null,
      nivel_academico: v.nivel_academico || null,
      perfil: v.perfil || null,
      organizacion: v.organizacion || null,
      canal: "landing",
      estado: "recibida",
      semaforo: "verde",
      seguimiento: false,
      prioridad: def.prioridad,
      contexto_operativo: def.contexto,
    })
    .select("radicado")
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: "No pudimos radicar tu solicitud. Inténtalo de nuevo.",
    };
  }

  revalidatePath("/dashboard/solicitudes");
  return {
    ok: true,
    message: "Solicitud radicada correctamente.",
    data: { radicado: data.radicado },
  };
}

/** Propuesta territorial → se registra como solicitud tipo "propuesta". */
export async function submitTerritorialProposal(
  raw: unknown,
): Promise<ActionResult<{ radicado: string }>> {
  const parsed = territorialProposalSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los campos del formulario.",
      fieldErrors: zodToFieldErrors(parsed.error),
    };
  }

  const v = parsed.data;
  const supabase = createAdminClient();

  const descripcion = [
    `Tema: ${v.tema}`,
    `Propuesta: ${v.propuesta}`,
    v.impacto_esperado ? `Impacto esperado: ${v.impacto_esperado}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const { data, error } = await supabase
    .from("requests")
    .insert({
      tipo_solicitud: "propuesta",
      asunto: `Propuesta territorial: ${v.tema}`,
      descripcion,
      nombre_solicitante: v.nombre,
      email: v.email || null,
      telefono: v.telefono || null,
      localidad: v.localidad,
      barrio: v.barrio || null,
      canal: "landing-propuesta",
      estado: "recibida",
      prioridad: "media",
      contexto_operativo: "comunitario",
    })
    .select("radicado")
    .single();

  if (error || !data) {
    return { ok: false, message: "No pudimos registrar tu propuesta." };
  }

  revalidatePath("/dashboard/solicitudes");
  return {
    ok: true,
    message: "¡Propuesta recibida! Gracias por aportar a tu territorio.",
    data: { radicado: data.radicado },
  };
}

/* Mantiene compatibilidad con el formulario simple anterior (si se usa). */
export async function createSimpleRequest(
  raw: unknown,
): Promise<ActionResult<{ radicado: string }>> {
  const parsed = citizenRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los campos del formulario.",
      fieldErrors: zodToFieldErrors(parsed.error),
    };
  }
  const v = parsed.data;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("requests")
    .insert({
      tipo_solicitud: v.tipo_solicitud,
      asunto: v.asunto,
      descripcion: v.descripcion,
      nombre_solicitante: v.nombre,
      email: v.email || null,
      telefono: v.telefono || null,
      localidad: v.localidad || null,
      barrio: v.barrio || null,
      canal: v.canal || "landing",
      estado: "recibida",
      prioridad: v.tipo_solicitud === "peticion_formal" ? "alta" : "media",
      contexto_operativo: "institucional",
    })
    .select("radicado")
    .single();
  if (error || !data) {
    return { ok: false, message: "No pudimos radicar tu solicitud." };
  }
  revalidatePath("/dashboard/solicitudes");
  return { ok: true, message: "Solicitud radicada.", data: { radicado: data.radicado } };
}

/* ──────────────── Gestión desde el dashboard ──────────────── */

/** Actualiza la gestión de una solicitud. Los cambios de estado/semáforo se
 *  registran en `request_history` automáticamente vía trigger. */
export async function updateRequest(raw: unknown): Promise<ActionResult> {
  const parsed = requestManageSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos.", fieldErrors: zodToFieldErrors(parsed.error) };
  }
  const v = parsed.data;
  const supabase = await createClient();

  const patch: Record<string, unknown> = {
    estado: v.estado,
    prioridad: v.prioridad,
    semaforo: v.semaforo,
    seguimiento: v.seguimiento ?? false,
    responsable_id: v.responsable_id || null,
    persona_encargada: v.persona_encargada || null,
    persona_recibe: v.persona_recibe || null,
    entidad: v.entidad || null,
    tramite: v.tramite || null,
    fecha_gestion: v.fecha_gestion || null,
    fecha_limite: v.fecha_limite || null,
    observaciones: v.observaciones || null,
    alerta: v.alerta || null,
  };
  if (v.estado === "cerrada" || v.estado === "archivada") {
    patch.fecha_cierre = new Date().toISOString();
  }

  const { error } = await supabase.from("requests").update(patch).eq("id", v.id);
  if (error) {
    return { ok: false, message: "No se pudo actualizar la solicitud (¿permisos?)." };
  }
  revalidatePath("/dashboard/solicitudes");
  return { ok: true, message: "Solicitud actualizada." };
}

/** Agrega una nota manual al historial de la solicitud. */
export async function addRequestNote(raw: unknown): Promise<ActionResult> {
  const parsed = requestNoteSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Escribe una nota válida." };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("request_history").insert({
    request_id: v.request_id,
    tipo: "nota",
    descripcion: v.descripcion,
    author_id: user?.id ?? null,
  });
  if (error) return { ok: false, message: "No se pudo guardar la nota." };
  revalidatePath("/dashboard/solicitudes");
  return { ok: true, message: "Nota agregada." };
}

/** Devuelve el historial de una solicitud (más reciente primero). */
export async function getRequestHistory(requestId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("request_history")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Soft delete de una solicitud. */
export async function softDeleteRequest(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("requests")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: "No se pudo archivar." };
  revalidatePath("/dashboard/solicitudes");
  return { ok: true, message: "Solicitud archivada." };
}
