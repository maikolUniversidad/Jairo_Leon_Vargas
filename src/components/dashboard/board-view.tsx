"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Users, Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskBoard, type Assignment } from "@/components/dashboard/task-board";
import { TaskCreateDialog } from "@/components/dashboard/task-create-dialog";
import { WorkspaceMembersDialog } from "@/components/dashboard/workspace-members-dialog";
import type { Task, Profile } from "@/types/database";

export interface BoardScope {
  kind: "todas" | "general" | "workspace";
  id?: string;
  nombre: string;
  canManageMembers: boolean;
}

const ALL = "__all__";

export function BoardView({
  tasks,
  profiles,
  workspaces,
  assigneesByTask,
  scope,
}: {
  tasks: Task[];
  profiles: Profile[];
  workspaces: { id: string; nombre: string }[];
  assigneesByTask: Record<string, Assignment>;
  scope: BoardScope;
}) {
  const [personId, setPersonId] = useState<string>(ALL);
  const [membersOpen, setMembersOpen] = useState(false);

  // Solo personas que aparecen en alguna tarea de esta vista
  const peopleInView = useMemo(() => {
    const ids = new Set<string>();
    for (const t of tasks) {
      const a = assigneesByTask[t.id];
      if (a) [...a.responsables, ...a.participantes].forEach((u) => ids.add(u));
      if (t.responsable_id) ids.add(t.responsable_id);
    }
    return profiles.filter((p) => ids.has(p.id));
  }, [tasks, assigneesByTask, profiles]);

  const filtered = useMemo(() => {
    if (personId === ALL) return tasks;
    return tasks.filter((t) => {
      const a = assigneesByTask[t.id];
      return (
        t.responsable_id === personId ||
        (a && (a.responsables.includes(personId) || a.participantes.includes(personId)))
      );
    });
  }, [tasks, assigneesByTask, personId]);

  const profileOpts = profiles.map((p) => ({ id: p.id, full_name: p.full_name, email: p.email }));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/tareas"><ArrowLeft className="size-4" /> Workspaces</Link>
        </Button>
        <h2 className="text-lg font-semibold">{scope.nombre}</h2>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Filter className="size-4 text-muted-foreground" />
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger className="h-9 w-52"><SelectValue placeholder="Filtrar por persona" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas las personas</SelectItem>
                {peopleInView.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || p.email || p.id.slice(0, 8)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {scope.kind === "workspace" && scope.canManageMembers && (
            <Button variant="outline" onClick={() => setMembersOpen(true)}>
              <Users className="size-4" /> Miembros
            </Button>
          )}
          <TaskCreateDialog
            profiles={profileOpts}
            workspaces={workspaces}
            defaultWorkspaceId={scope.kind === "workspace" ? scope.id : undefined}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          No hay tareas {personId !== ALL ? "para esa persona" : "en esta vista"}. Crea una con “Nueva tarea”.
        </div>
      ) : (
        <TaskBoard tasks={filtered} profiles={profiles} assigneesByTask={assigneesByTask} />
      )}

      {scope.kind === "workspace" && scope.id && (
        <WorkspaceMembersDialog
          workspaceId={scope.id}
          workspaceName={scope.nombre}
          profiles={profileOpts}
          open={membersOpen}
          onOpenChange={setMembersOpen}
        />
      )}
    </>
  );
}
