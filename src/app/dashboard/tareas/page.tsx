import { ListChecks } from "lucide-react";

import { PageHeader, EmptyState } from "@/components/dashboard/shared";
import { TaskCreateDialog } from "@/components/dashboard/task-create-dialog";
import { TaskBoard } from "@/components/dashboard/task-board";
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
  const { tasks, profiles } = await getData();

  return (
    <>
      <PageHeader
        title="Tareas y compromisos"
        description="Canvas Kanban: arrastra las tarjetas entre columnas. Cada tarea guarda checklist, comentarios e historial de estados."
        action={<TaskCreateDialog />}
      />

      {tasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Sin tareas todavía"
          description="Crea la primera tarea con el botón “Nueva tarea”. Aparecerá en el tablero y podrás moverla entre estados."
        />
      ) : (
        <TaskBoard tasks={tasks} profiles={profiles} />
      )}
    </>
  );
}
