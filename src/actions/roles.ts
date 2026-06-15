"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth";
import { ALL_MODULES } from "@/types/roles";
import { type ActionResult } from "./types";

export interface RoleRow {
  key: string;
  label: string;
  descripcion: string | null;
  is_system: boolean;
  base_role: string;
}

export interface PermissionRow {
  role_key: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

async function assertAdmin(): Promise<boolean> {
  const u = await getSessionUser();
  return Boolean(u?.isAdmin);
}

export async function listRoles(): Promise<RoleRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("roles_catalog")
    .select("key, label, descripcion, is_system, base_role")
    .order("is_system", { ascending: false })
    .order("label");
  return (data as RoleRow[]) ?? [];
}

export async function listPermissions(): Promise<PermissionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("role_permissions")
    .select("role_key, module, can_view, can_create, can_edit, can_delete");
  return (data as PermissionRow[]) ?? [];
}

/** Actualiza un permiso (módulo) de un rol. Solo admin. */
export async function setPermission(
  roleKey: string,
  module: string,
  perms: Partial<Pick<PermissionRow, "can_view" | "can_create" | "can_edit" | "can_delete">>,
): Promise<ActionResult> {
  if (!(await assertAdmin())) return { ok: false, message: "No autorizado." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("role_permissions")
    .upsert(
      { role_key: roleKey, module, ...perms },
      { onConflict: "role_key,module" },
    );
  if (error) return { ok: false, message: "No se pudo guardar el permiso." };
  revalidatePath("/dashboard/configuracion");
  return { ok: true, message: "Permiso actualizado." };
}

/** Crea un rol personalizado con un nivel de datos base. Solo admin. */
export async function createRole(input: {
  key: string;
  label: string;
  descripcion?: string;
  base_role: string;
}): Promise<ActionResult> {
  if (!(await assertAdmin())) return { ok: false, message: "No autorizado." };
  const key = input.key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!key) return { ok: false, message: "Clave de rol inválida." };
  if (!input.label.trim()) return { ok: false, message: "El nombre es obligatorio." };

  const admin = createAdminClient();
  const { error } = await admin.from("roles_catalog").insert({
    key,
    label: input.label.trim(),
    descripcion: input.descripcion?.trim() || null,
    is_system: false,
    base_role: input.base_role,
  });
  if (error) {
    return {
      ok: false,
      message: /duplicate|exists/i.test(error.message)
        ? "Ya existe un rol con esa clave."
        : "No se pudo crear el rol.",
    };
  }

  // Inicializa la matriz: panel visible por defecto.
  const rows = ALL_MODULES.map((m) => ({
    role_key: key,
    module: m,
    can_view: m === "panel",
    can_create: false,
    can_edit: false,
    can_delete: false,
  }));
  await admin.from("role_permissions").insert(rows);

  revalidatePath("/dashboard/configuracion");
  return { ok: true, message: `Rol "${input.label}" creado.` };
}

/** Elimina un rol personalizado (no del sistema). Solo admin. */
export async function deleteRole(key: string): Promise<ActionResult> {
  if (!(await assertAdmin())) return { ok: false, message: "No autorizado." };
  const admin = createAdminClient();
  const { data: role } = await admin
    .from("roles_catalog")
    .select("is_system")
    .eq("key", key)
    .maybeSingle();
  if (role?.is_system) return { ok: false, message: "No se pueden eliminar roles del sistema." };

  const { error } = await admin.from("roles_catalog").delete().eq("key", key);
  if (error) return { ok: false, message: "No se pudo eliminar el rol." };
  revalidatePath("/dashboard/configuracion");
  return { ok: true, message: "Rol eliminado." };
}
