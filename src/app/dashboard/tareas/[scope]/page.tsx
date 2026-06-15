import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/shared";
import { BoardView, type BoardScope } from "@/components/dashboard/board-view";
import type { Assignment } from "@/components/dashboard/task-board";
import { listMyWorkspaces } from "@/actions/workspaces";
import { getAssigneesFor } from "@/actions/tareas";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Task, Profile } from "@/types/database";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ scope: string }>;
}) {
  const { scope } = await params;
  const user = await getSessionUser();
  if (!user) notFound();

  const supabase = await createClient();
  const workspaces = await listMyWorkspaces();

  // Resolver el alcance
  let boardScope: BoardScope;
  let query = supabase.from("tasks").select("*").is("deleted_at", null);

  if (scope === "todas") {
    boardScope = { kind: "todas", nombre: "Todas las tareas", canManageMembers: false };
  } else if (scope === "general") {
    boardScope = { kind: "general", nombre: "General (sin workspace)", canManageMembers: false };
    query = query.is("workspace_id", null);
  } else {
    const ws = workspaces.find((w) => w.id === scope);
    if (!ws) notFound();
    boardScope = {
      kind: "workspace",
      id: ws.id,
      nombre: ws.nombre,
      canManageMembers: ws.my_rol === "owner" || user.isAdmin,
    };
    query = query.eq("workspace_id", scope);
  }

  const [{ data: tasks }, { data: profiles }] = await Promise.all([
    query.order("orden", { ascending: true }).order("created_at", { ascending: false }).limit(1000),
    supabase.from("profiles").select("*").eq("is_active", true),
  ]);

  const taskList = (tasks as Task[]) ?? [];
  const assignRows = await getAssigneesFor(taskList.map((t) => t.id));
  const assigneesByTask: Record<string, Assignment> = {};
  for (const r of assignRows as { task_id: string; user_id: string; rol: string }[]) {
    const a = (assigneesByTask[r.task_id] ??= { responsables: [], participantes: [] });
    if (r.rol === "responsable") a.responsables.push(r.user_id);
    else a.participantes.push(r.user_id);
  }

  return (
    <>
      <PageHeader
        title="Tablero de tareas"
        description="Arrastra las tarjetas entre columnas. Filtra por persona y gestiona responsables y participantes."
      />
      <BoardView
        tasks={taskList}
        profiles={(profiles as Profile[]) ?? []}
        workspaces={workspaces.map((w) => ({ id: w.id, nombre: w.nombre }))}
        assigneesByTask={assigneesByTask}
        scope={boardScope}
      />
    </>
  );
}
