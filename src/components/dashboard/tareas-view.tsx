"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Users, Layers, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { TaskBoard } from "@/components/dashboard/task-board";
import { TaskCreateDialog } from "@/components/dashboard/task-create-dialog";
import { WorkspaceMembersDialog } from "@/components/dashboard/workspace-members-dialog";
import { createWorkspace, type WorkspaceRow } from "@/actions/workspaces";
import type { Task, Profile } from "@/types/database";

const GENERAL = "__general__";

export function TareasView({
  tasks,
  profiles,
  workspaces,
}: {
  tasks: Task[];
  profiles: Profile[];
  workspaces: WorkspaceRow[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null); // null = todos
  const [membersOpen, setMembersOpen] = useState(false);

  const filtered = useMemo(() => {
    if (selected === null) return tasks;
    if (selected === GENERAL) return tasks.filter((t) => !t.workspace_id);
    return tasks.filter((t) => t.workspace_id === selected);
  }, [tasks, selected]);

  const current = workspaces.find((w) => w.id === selected) ?? null;
  const canManage = current && (current.my_rol === "owner");
  const profileOpts = profiles.map((p) => ({ id: p.id, full_name: p.full_name, email: p.email }));
  const wsOpts = workspaces.map((w) => ({ id: w.id, nombre: w.nombre }));

  return (
    <>
      {/* Barra de workspaces */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Chip active={selected === null} onClick={() => setSelected(null)} label="Todas" icon={<Layers className="size-3.5" />} />
        <Chip active={selected === GENERAL} onClick={() => setSelected(GENERAL)} label="General" />
        {workspaces.map((w) => (
          <Chip
            key={w.id}
            active={selected === w.id}
            onClick={() => setSelected(w.id)}
            label={w.nombre}
            dot={w.color}
          />
        ))}
        <CreateWorkspaceDialog onCreated={() => router.refresh()} />
      </div>

      {/* Acciones de workspace seleccionado */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TaskCreateDialog
          profiles={profileOpts}
          workspaces={wsOpts}
          defaultWorkspaceId={current?.id}
        />
        {current && (
          <Button variant="outline" onClick={() => setMembersOpen(true)} disabled={!canManage}>
            <Users className="size-4" /> Miembros
            {!canManage && <span className="ml-1 text-xs text-muted-foreground">(solo propietario)</span>}
          </Button>
        )}
        {current?.descripcion && (
          <span className="text-sm text-muted-foreground">· {current.descripcion}</span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <Settings2 className="mx-auto mb-2 size-8 opacity-40" />
          No hay tareas en esta vista. Crea una con “Nueva tarea”.
        </div>
      ) : (
        <TaskBoard tasks={filtered} profiles={profiles} />
      )}

      {current && (
        <WorkspaceMembersDialog
          workspaceId={current.id}
          workspaceName={current.nombre}
          profiles={profileOpts}
          open={membersOpen}
          onOpenChange={setMembersOpen}
        />
      )}
    </>
  );
}

function Chip({
  active,
  onClick,
  label,
  icon,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
      )}
    >
      {dot && <span className="size-2.5 rounded-full" style={{ background: dot }} />}
      {icon}
      {label}
    </button>
  );
}

function CreateWorkspaceDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [color, setColor] = useState("#E30613");
  const [pending, start] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full">
          <Plus className="size-4" /> Workspace
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo workspace</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="ws-nombre">Nombre *</Label>
            <Input id="ws-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ws-desc">Descripción</Label>
            <Textarea id="ws-desc" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="ws-color">Color</Label>
            <input id="ws-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-14 rounded border" />
          </div>
          <Button
            className="w-full"
            disabled={pending}
            onClick={() => {
              if (!nombre.trim()) return toast.error("Escribe un nombre.");
              start(async () => {
                const res = await createWorkspace({ nombre, descripcion, color });
                if (res.ok) {
                  toast.success(res.message);
                  setNombre(""); setDescripcion(""); setOpen(false);
                  onCreated();
                } else toast.error(res.message);
              });
            }}
          >
            {pending ? "Creando…" : "Crear workspace"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
