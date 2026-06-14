"use server";

import { createClient } from "@/lib/supabase/server";
import { citizenRegisterSchema } from "@/lib/validations";
import { type ActionResult, zodToFieldErrors } from "./types";

/**
 * Registro ciudadano desde la landing (formulario público).
 * Usa el cliente con ANON KEY → la inserción la autoriza la política RLS
 * `citizens_public_insert` (exige consentimiento_datos = true).
 */
export async function registerCitizen(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = citizenRegisterSchema.safeParse(raw);
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
    .from("citizens")
    .insert({
      nombre: v.nombre,
      apellido: v.apellido || null,
      email: v.email || null,
      telefono: v.telefono || null,
      whatsapp: v.whatsapp || null,
      localidad: v.localidad || null,
      barrio: v.barrio || null,
      intereses: v.intereses ?? [],
      fuente_registro: v.fuente_registro || "landing",
      consentimiento_datos: true,
      fecha_consentimiento: new Date().toISOString(),
      contexto_operativo: "comunitario",
    })
    .select("id")
    .single();

  if (error) {
    return {
      ok: false,
      message: "No pudimos registrar tus datos. Inténtalo de nuevo.",
    };
  }

  return {
    ok: true,
    message: "¡Gracias por sumarte! Te mantendremos al tanto.",
    data: { id: data.id },
  };
}
