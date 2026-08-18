"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { newUserSchema } from "@/lib/validations";
import { type ActionResult, zodToFieldErrors } from "./types";

export interface ManagedUser {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  cargo: string | null;
  avatar_url: string | null;
  is_active: boolean;
  role_key: string | null;
  role_label: string | null;
}

async function assertAdmin(): Promise<boolean> {
  const u = await getSessionUser();
  return Boolean(u?.isAdmin);
}

/** Lista los usuarios con su rol visible (solo admin). */
export async function listUsers(): Promise<ManagedUser[]> {
  if (!(await assertAdmin())) return [];
  const supabase = await createClient();
  const [{ data: profiles }, { data: roles }, { data: catalog }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, phone, cargo, avatar_url, is_active"),
    supabase.from("user_roles").select("user_id, role_key"),
    supabase.from("roles_catalog").select("key, label"),
  ]);

  const labelByKey = new Map((catalog ?? []).map((c) => [c.key as string, c.label as string]));
  const roleByUser = new Map<string, string>();
  for (const r of roles ?? []) {
    const rk = (r as { user_id: string; role_key: string | null }).role_key;
    if (rk) roleByUser.set((r as { user_id: string }).user_id, rk);
  }

  return (profiles ?? []).map((p) => {
    const rk = roleByUser.get(p.id) ?? null;
    return {
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      phone: (p as { phone: string | null }).phone,
      cargo: (p as { cargo: string | null }).cargo,
      avatar_url: (p as { avatar_url: string | null }).avatar_url,
      is_active: p.is_active,
      role_key: rk,
      role_label: rk ? labelByKey.get(rk) ?? rk : null,
    };
  });
}

async function baseRoleOf(roleKey: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("roles_catalog")
    .select("base_role")
    .eq("key", roleKey)
    .maybeSingle();
  return (data?.base_role as string) ?? "consulta";
}

/** Crea un usuario (Supabase Auth) y le asigna un rol. Solo admin. */
export async function createUser(input: {
  email: string;
  password: string;
  full_name: string;
  role_key: string;
}): Promise<ActionResult> {
  if (!(await assertAdmin())) return { ok: false, message: "No autorizado." };

  const parsed = newUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos.", fieldErrors: zodToFieldErrors(parsed.error) };
  }
  const v = parsed.data;

  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true,
    user_metadata: { full_name: v.full_name },
  });
  if (error || !created.user) {
    // El correo duplicado es el fallo más común: se marca sobre el campo.
    const dup = /already|registered|exists/i.test(error?.message ?? "");
    return {
      ok: false,
      message: error?.message ?? "No se pudo crear el usuario.",
      fieldErrors: dup ? { email: "Ya existe un usuario con este correo." } : undefined,
    };
  }

  const base = await baseRoleOf(v.role_key);
  await admin.from("profiles").update({ full_name: v.full_name }).eq("id", created.user.id);
  await admin.from("user_roles").delete().eq("user_id", created.user.id);
  await admin
    .from("user_roles")
    .insert({ user_id: created.user.id, role: base, role_key: v.role_key });

  revalidatePath("/dashboard/configuracion");
  return { ok: true, message: `Usuario ${input.email} creado.` };
}

/** Cambia el rol (visible + base) de un usuario. Solo admin. */
export async function setUserRole(userId: string, roleKey: string): Promise<ActionResult> {
  if (!(await assertAdmin())) return { ok: false, message: "No autorizado." };
  const base = await baseRoleOf(roleKey);
  const admin = createAdminClient();
  await admin.from("user_roles").delete().eq("user_id", userId);
  const { error } = await admin
    .from("user_roles")
    .insert({ user_id: userId, role: base, role_key: roleKey });
  if (error) return { ok: false, message: "No se pudo asignar el rol." };
  revalidatePath("/dashboard/configuracion");
  return { ok: true, message: "Rol actualizado." };
}

/** Activa/desactiva un usuario. Solo admin. */
export async function toggleUserActive(userId: string, active: boolean): Promise<ActionResult> {
  if (!(await assertAdmin())) return { ok: false, message: "No autorizado." };
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ is_active: active }).eq("id", userId);
  if (error) return { ok: false, message: "No se pudo actualizar." };
  revalidatePath("/dashboard/configuracion");
  return { ok: true, message: active ? "Usuario activado." : "Usuario desactivado." };
}

/* ═══════════════ Edición de la ficha y la contraseña (solo admin) ═══════════════ */

const perfilSchema = z.object({
  full_name: z.string().trim().min(2, "Escribe el nombre").max(160),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  cargo: z.string().trim().max(120).optional().or(z.literal("")),
  avatar_url: z.string().trim().max(500).optional().or(z.literal("")),
});

/** Actualiza la ficha de cualquier usuario, foto incluida. Solo admin. */
export async function updateUserProfile(
  userId: string,
  input: unknown,
): Promise<ActionResult> {
  if (!(await assertAdmin())) return { ok: false, message: "No autorizado." };

  const parsed = perfilSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos.", fieldErrors: zodToFieldErrors(parsed.error) };
  }

  // Con el cliente admin: la RLS de `profiles` deja a cada quien editar el suyo
  // y a los admin editar cualquiera, pero aquí ya se comprobó el permiso.
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone || null,
      cargo: parsed.data.cargo || null,
      avatar_url: parsed.data.avatar_url || null,
    })
    .eq("id", userId);
  if (error) return { ok: false, message: "No se pudo actualizar la ficha." };

  revalidatePath("/dashboard/configuracion");
  return { ok: true, message: "Ficha actualizada." };
}

/**
 * Asigna una contraseña nueva a un usuario. Solo admin.
 *
 * La contraseña anterior NO se puede consultar —Supabase guarda un hash de una
 * sola vía—, así que esto la reemplaza. Cambiarla cierra las sesiones abiertas
 * de esa persona, que es lo que se espera al restablecer un acceso.
 */
export async function setUserPassword(
  userId: string,
  password: string,
): Promise<ActionResult> {
  if (!(await assertAdmin())) return { ok: false, message: "No autorizado." };

  if (typeof password !== "string" || password.length < 6) {
    return {
      ok: false,
      message: "Revisa los campos.",
      fieldErrors: { password: "Mínimo 6 caracteres." },
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { ok: false, message: "No se pudo cambiar la contraseña." };

  await logActivity("clave", "usuario", userId, "Contraseña restablecida por un administrador");
  return { ok: true, message: "Contraseña actualizada. Avísale a la persona." };
}

/**
 * Manda el correo de recuperación para que la persona ponga su propia clave.
 * Es la vía preferible: la contraseña no pasa por nadie más.
 */
export async function sendPasswordRecovery(email: string): Promise<ActionResult> {
  if (!(await assertAdmin())) return { ok: false, message: "No autorizado." };
  if (!email?.trim()) return { ok: false, message: "El usuario no tiene correo." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: email.trim(),
  });
  if (error) return { ok: false, message: "No se pudo enviar el correo de recuperación." };

  return { ok: true, message: "Correo de recuperación enviado." };
}
