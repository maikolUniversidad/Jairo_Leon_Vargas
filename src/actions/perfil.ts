"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/validations";
import { type ActionResult, zodToFieldErrors } from "./types";

/**
 * Actualiza el perfil del usuario en sesión. La RLS (profiles_self_update)
 * garantiza que solo pueda modificar su propia ficha.
 */
export async function updateMyProfile(raw: unknown): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del perfil.",
      fieldErrors: zodToFieldErrors(parsed.error),
    };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión no válida." };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: v.full_name,
      phone: v.phone || null,
      cargo: v.cargo || null,
      documento: v.documento || null,
      direccion: v.direccion || null,
      bio: v.bio || null,
      area_id: v.area_id || null,
      fecha_ingreso: v.fecha_ingreso || null,
      ...(v.avatar_url !== undefined ? { avatar_url: v.avatar_url || null } : {}),
    })
    .eq("id", user.id);

  if (error) return { ok: false, message: "No se pudo guardar el perfil." };

  revalidatePath("/dashboard/perfil");
  revalidatePath("/dashboard");
  return { ok: true, message: "Perfil actualizado." };
}

/** Guarda solo la URL de la foto (tras subirla al bucket). */
export async function updateMyAvatar(url: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión no válida." };

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: url || null })
    .eq("id", user.id);
  if (error) return { ok: false, message: "No se pudo guardar la foto." };

  revalidatePath("/dashboard/perfil");
  revalidatePath("/dashboard");
  return { ok: true, message: "Foto actualizada." };
}
