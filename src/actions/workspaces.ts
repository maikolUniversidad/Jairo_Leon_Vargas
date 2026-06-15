"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth";
import { type ActionResult } from "./types";

export type WorkspaceRole = "owner" | "editor" | "viewer";

export interface WorkspaceRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  color: string;
  archivado: boolean;
  my_rol: WorkspaceRole | null;
}

export interface WorkspaceMember {
  user_id: string;
  nombre: string | null;
  email: string | null;
  rol_workspace: WorkspaceRole;
}

/** Workspaces de los que el usuario es miembro (RLS aplica). */
export async function listMyWorkspaces(): Promise<WorkspaceRow[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createClient();

  const [{ data: ws }, { data: mine }] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, nombre, descripcion, color, archivado")
      .eq("archivado", false)
      .order("created_at", { ascending: true }),
    supabase.from("workspace_members").select("workspace_id, rol_workspace").eq("user_id", user.id),
  ]);

  const rolByWs = new Map(
    (mine ?? []).map((m) => [m.workspace_id as string, m.rol_workspace as WorkspaceRole]),
  );
  return (ws ?? []).map((w) => ({
    id: w.id,
    nombre: w.nombre,
    descripcion: w.descripcion,
    color: w.color,
    archivado: w.archivado,
    my_rol: rolByWs.get(w.id) ?? (user.isAdmin ? "owner" : null),
  }));
}

/** Crea un workspace y agrega al creador como owner. */
export async function createWorkspace(input: {
  nombre: string;
  descripcion?: string;
  color?: string;
}): Promise<ActionResult<{ id: string }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Sesión no válida." };
  if (!input.nombre?.trim()) return { ok: false, message: "El nombre es obligatorio." };

  const admin = createAdminClient();
  const { data: ws, error } = await admin
    .from("workspaces")
    .insert({
      nombre: input.nombre.trim(),
      descripcion: input.descripcion?.trim() || null,
      color: input.color || "#E30613",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !ws) return { ok: false, message: "No se pudo crear el workspace." };

  await admin
    .from("workspace_members")
    .insert({ workspace_id: ws.id, user_id: user.id, rol_workspace: "owner" });

  revalidatePath("/dashboard/tareas");
  return { ok: true, message: "Workspace creado.", data: { id: ws.id } };
}

/** Miembros de un workspace con nombre/correo. */
export async function listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("workspace_members")
    .select("user_id, rol_workspace")
    .eq("workspace_id", workspaceId);
  if (!members || members.length === 0) return [];

  const ids = members.map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", ids);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return members.map((m) => {
    const p = byId.get(m.user_id);
    return {
      user_id: m.user_id,
      nombre: p?.full_name ?? null,
      email: p?.email ?? null,
      rol_workspace: m.rol_workspace as WorkspaceRole,
    };
  });
}

/** Agrega o actualiza un miembro (owner del workspace o admin). */
export async function upsertMember(
  workspaceId: string,
  userId: string,
  rol: WorkspaceRole,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_members")
    .upsert(
      { workspace_id: workspaceId, user_id: userId, rol_workspace: rol },
      { onConflict: "workspace_id,user_id" },
    );
  if (error) return { ok: false, message: "No se pudo guardar el miembro (¿permisos?)." };
  revalidatePath("/dashboard/tareas");
  return { ok: true, message: "Miembro actualizado." };
}

export async function removeMember(
  workspaceId: string,
  userId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  if (error) return { ok: false, message: "No se pudo quitar el miembro." };
  revalidatePath("/dashboard/tareas");
  return { ok: true, message: "Miembro removido." };
}
