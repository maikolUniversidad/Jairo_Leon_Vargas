import { PageHeader } from "@/components/dashboard/shared";
import { TerritorioExplorer } from "@/components/dashboard/territorio-explorer";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/roles";
import type { Zone, Profile } from "@/types/database";

const MANAGER_ROLES: AppRole[] = ["super_admin", "administrador", "coordinador_territorial", "coordinador_utl"];

export default async function TerritorioPage() {
  const [user, supabase] = await Promise.all([
    getSessionUser(),
    createClient(),
  ]);

  const [{ data: zones }, { data: tasks }, { data: profiles }] = await Promise.all([
    supabase.from("zones").select("*").is("deleted_at", null).order("nombre_zona"),
    supabase
      .from("tasks")
      .select("zona_id, estado")
      .is("deleted_at", null)
      .not("zona_id", "is", null),
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
  ]);

  // Conteo de tareas abiertas por zona.
  const taskCounts: Record<string, number> = {};
  for (const t of (tasks as { zona_id: string; estado: string }[]) ?? []) {
    if (t.estado === "finalizada" || t.estado === "cancelada") continue;
    taskCounts[t.zona_id] = (taskCounts[t.zona_id] ?? 0) + 1;
  }

  const canManage = !!user && (user.isAdmin || user.roles.some((r) => MANAGER_ROLES.includes(r)));

  return (
    <>
      <PageHeader
        title="Territorio"
        description="Mapa de Bogotá (localidades y barrios) y de Colombia. Selecciona una zona para gestionarla y crear tareas que se sincronizan con el Kanban."
      />
      <TerritorioExplorer
        zones={(zones as Zone[]) ?? []}
        taskCounts={taskCounts}
        profiles={(profiles as Pick<Profile, "id" | "full_name" | "email">[]) ?? []}
        canManage={canManage}
      />
    </>
  );
}
