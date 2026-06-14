"use server";

import { createClient } from "@/lib/supabase/server";
import {
  citizenRequestSchema,
  territorialProposalSchema,
} from "@/lib/validations";
import { type ActionResult, zodToFieldErrors } from "./types";

/**
 * Crea una solicitud ciudadana pública y devuelve el código de radicado
 * (generado por el trigger `set_request_radicado` en la base de datos).
 */
export async function createPublicRequest(
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
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("requests")
    .insert({
      tipo_solicitud: v.tipo_solicitud,
      asunto: v.asunto,
      descripcion: v.descripcion,
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
    return {
      ok: false,
      message: "No pudimos radicar tu solicitud. Inténtalo de nuevo.",
    };
  }

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
  const supabase = await createClient();

  const descripcion = [
    `Tema: ${v.tema}`,
    `Propuesta: ${v.propuesta}`,
    v.impacto_esperado ? `Impacto esperado: ${v.impacto_esperado}` : null,
    `Contacto: ${v.nombre}${v.email ? ` · ${v.email}` : ""}${v.telefono ? ` · ${v.telefono}` : ""}`,
  ]
    .filter(Boolean)
    .join("\n");

  const { data, error } = await supabase
    .from("requests")
    .insert({
      tipo_solicitud: "propuesta",
      asunto: `Propuesta territorial: ${v.tema}`,
      descripcion,
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

  return {
    ok: true,
    message: "¡Propuesta recibida! Gracias por aportar a tu territorio.",
    data: { radicado: data.radicado },
  };
}
