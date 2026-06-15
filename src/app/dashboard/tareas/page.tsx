import { PageHeader } from "@/components/dashboard/shared";
import { WorkspaceGallery } from "@/components/dashboard/workspace-gallery";
import { listMyWorkspaces } from "@/actions/workspaces";
import { createClient } from "@/lib/supabase/server";

export default async function TareasOverviewPage() {
  const supabase = await createClient();
  const workspaces = await listMyWorkspaces();

  const [{ data: tasks }, { data: members }, { data: profiles }] = await Promise.all([
    supabase.from("tasks").select("id, workspace_id").is("deleted_at", null).limit(2000),
    supabase.from("workspace_members").select("workspace_id"),
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true),
  ]);

  const taskCountByWs = new Map<string, number>();
  let generalCount = 0;
  for (const t of tasks ?? []) {
    if (t.workspace_id) taskCountByWs.set(t.workspace_id, (taskCountByWs.get(t.workspace_id) ?? 0) + 1);
    else generalCount += 1;
  }
  const memberCountByWs = new Map<string, number>();
  for (const m of members ?? [])
    memberCountByWs.set(m.workspace_id, (memberCountByWs.get(m.workspace_id) ?? 0) + 1);

  const cards = workspaces.map((w) => ({
    ...w,
    taskCount: taskCountByWs.get(w.id) ?? 0,
    memberCount: memberCountByWs.get(w.id) ?? 0,
  }));

  return (
    <>
      <PageHeader
        title="Tareas y compromisos"
        description="Gestiona tus workspaces. Entra a uno para ver y mover sus tareas en el tablero."
      />
      <WorkspaceGallery
        workspaces={cards}
        generalCount={generalCount}
        totalCount={(tasks ?? []).length}
        profiles={(profiles as { id: string; full_name: string | null; email: string | null }[]) ?? []}
      />
    </>
  );
}
