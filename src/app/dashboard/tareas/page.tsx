import { PageHeader } from "@/components/dashboard/shared";
import { TareasView } from "@/components/dashboard/tareas-view";
import { listMyWorkspaces } from "@/actions/workspaces";
import { createClient } from "@/lib/supabase/server";
import type { Task, Profile } from "@/types/database";

async function getData(): Promise<{ tasks: Task[]; profiles: Profile[] }> {
  try {
    const supabase = await createClient();
    const [{ data: tasks }, { data: profiles }] = await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .is("deleted_at", null)
        .order("orden", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("profiles").select("*").eq("is_active", true),
    ]);
    return {
      tasks: (tasks as Task[]) ?? [],
      profiles: (profiles as Profile[]) ?? [],
    };
  } catch {
    return { tasks: [], profiles: [] };
  }
}

export default async function TareasPage() {
  const [{ tasks, profiles }, workspaces] = await Promise.all([
    getData(),
    listMyWorkspaces(),
  ]);

  return (
    <>
      <PageHeader
        title="Tareas y compromisos"
        description="Organiza el trabajo en workspaces con permisos por persona, asigna tareas a usuarios y muévelas en el tablero Kanban."
      />
      <TareasView tasks={tasks} profiles={profiles} workspaces={workspaces} />
    </>
  );
}
