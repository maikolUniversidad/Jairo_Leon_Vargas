"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { UserPlus, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listMembers,
  upsertMember,
  removeMember,
  type WorkspaceMember,
  type WorkspaceRole,
} from "@/actions/workspaces";

interface PersonOption { id: string; full_name: string | null; email: string | null }

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: "Propietario",
  editor: "Editor",
  viewer: "Lector",
};

export function WorkspaceMembersDialog({
  workspaceId,
  workspaceName,
  profiles,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  workspaceName: string;
  profiles: PersonOption[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [addUser, setAddUser] = useState("");
  const [addRole, setAddRole] = useState<WorkspaceRole>("editor");
  const [, start] = useTransition();

  function refresh() {
    listMembers(workspaceId).then(setMembers);
  }
  useEffect(() => {
    if (open) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspaceId]);

  const memberIds = new Set(members.map((m) => m.user_id));
  const candidates = profiles.filter((p) => !memberIds.has(p.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-5" /> Miembros · {workspaceName}
          </DialogTitle>
        </DialogHeader>

        {/* Agregar */}
        <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label>Persona</Label>
            <Select value={addUser} onValueChange={setAddUser}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                {candidates.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Todos agregados</div>
                )}
                {candidates.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name || p.email || p.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-36">
            <Label>Permiso</Label>
            <Select value={addRole} onValueChange={(v) => setAddRole(v as WorkspaceRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Propietario</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Lector</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            onClick={() => {
              if (!addUser) return toast.error("Selecciona una persona.");
              start(async () => {
                const res = await upsertMember(workspaceId, addUser, addRole);
                if (res.ok) { toast.success("Miembro agregado"); setAddUser(""); refresh(); }
                else toast.error(res.message);
              });
            }}
          >
            <UserPlus className="size-4" /> Agregar
          </Button>
        </div>

        {/* Lista */}
        <ul className="divide-y rounded-lg border">
          {members.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">Sin miembros.</li>
          )}
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-2 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.nombre || m.email || "—"}</p>
                {m.email && <p className="truncate text-xs text-muted-foreground">{m.email}</p>}
              </div>
              <Select
                value={m.rol_workspace}
                onValueChange={(v) =>
                  start(async () => {
                    const res = await upsertMember(workspaceId, m.user_id, v as WorkspaceRole);
                    if (res.ok) refresh(); else toast.error(res.message);
                  })
                }
              >
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">{ROLE_LABEL.owner}</SelectItem>
                  <SelectItem value="editor">{ROLE_LABEL.editor}</SelectItem>
                  <SelectItem value="viewer">{ROLE_LABEL.viewer}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() =>
                  start(async () => {
                    const res = await removeMember(workspaceId, m.user_id);
                    if (res.ok) refresh(); else toast.error(res.message);
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          <strong>Lector</strong> ve las tareas; <strong>Editor</strong> crea y edita;
          <strong> Propietario</strong> además gestiona miembros.
        </p>
      </DialogContent>
    </Dialog>
  );
}
