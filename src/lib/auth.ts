import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/roles";
import type { Profile } from "@/types/database";

export interface SessionUser {
  id: string;
  email: string | null;
  profile: Profile | null;
  roles: AppRole[];
  primaryRole: AppRole | null;
  isAdmin: boolean;
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
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  const roles = (roleRows ?? []).map((r) => r.role as AppRole);
  const primaryRole = roles[0] ?? null;

  return {
    id: user.id,
    email: user.email ?? null,
    profile: (profile as Profile) ?? null,
    roles,
    primaryRole,
    isAdmin: roles.includes("super_admin") || roles.includes("administrador"),
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
