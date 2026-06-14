"use server";

import { createClient } from "@/lib/supabase/server";
import { eventSignupSchema } from "@/lib/validations";
import { type ActionResult, zodToFieldErrors } from "./types";

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
