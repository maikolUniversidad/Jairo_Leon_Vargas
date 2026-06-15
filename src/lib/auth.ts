import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ALL_MODULES, type AppRole } from "@/types/roles";
import type { Profile } from "@/types/database";

export interface SessionUser {
  id: string;
  email: string | null;
  profile: Profile | null;
  roles: AppRole[];
  roleKeys: string[];
  primaryRole: AppRole | null;
  isAdmin: boolean;
  /** Módulos del dashboard que el usuario puede ver (según role_permissions). */
  viewableModules: string[];
}

/**
 * Devuelve el usuario autenticado con su perfil y roles, o null.
 * Lee roles desde la tabla `user_roles` (fuente de verdad junto a RLS).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role, role_key").eq("user_id", user.id),
  ]);

  const roles = (roleRows ?? []).map((r) => r.role as AppRole);
  const roleKeys = (roleRows ?? [])
    .map((r) => (r as { role_key: string | null }).role_key)
    .filter((k): k is string => Boolean(k));
  const primaryRole = roles[0] ?? null;
  const isAdmin = roles.includes("super_admin") || roles.includes("administrador");

  // Módulos visibles según la matriz de permisos (role_permissions).
  let viewableModules: string[] = [];
  if (isAdmin) {
    viewableModules = [...ALL_MODULES];
  } else if (roleKeys.length > 0) {
    const { data: perms } = await supabase
      .from("role_permissions")
      .select("module")
      .in("role_key", roleKeys)
      .eq("can_view", true);
    viewableModules = Array.from(new Set((perms ?? []).map((p) => p.module as string)));
  }
  // "Mi perfil" siempre disponible para cualquier usuario autenticado.
  if (!viewableModules.includes("perfil")) viewableModules.push("perfil");

  return {
    id: user.id,
    email: user.email ?? null,
    profile: (profile as Profile) ?? null,
    roles,
    roleKeys,
    primaryRole,
    isAdmin,
    viewableModules,
  };
}

/** Igual que getSessionUser pero redirige a /login si no hay sesión. */
export async function requireUser(redirectTo = "/dashboard"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }
  return user;
}

/** Exige que el usuario tenga al menos uno de los roles dados. */
export async function requireRole(allowed: AppRole[]): Promise<SessionUser> {
  const user = await requireUser();
  const ok = user.isAdmin || user.roles.some((r) => allowed.includes(r));
  if (!ok) {
    redirect("/dashboard?error=forbidden");
  }
  return user;
}
