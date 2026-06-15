"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Users, Layers, ListChecks, FolderKanban, Pencil, ImageUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WorkspaceMembersDialog } from "@/components/dashboard/workspace-members-dialog";
import { uploadFileViaSignedUrl } from "@/lib/upload";
import { createWorkspace, updateWorkspace, type WorkspaceRow } from "@/actions/workspaces";

interface PersonOption { id: string; full_name: string | null; email: string | null }
type WsCard = WorkspaceRow & { taskCount: number; memberCount: number };

const ROL_LABEL: Record<string, string> = { owner: "Propietario", editor: "Editor", viewer: "Lector" };

export function WorkspaceGallery({
  workspaces,
  generalCount,
  totalCount,
  profiles,
}: {
  workspaces: WsCard[];
  generalCount: number;
  totalCount: number;
  profiles: PersonOption[];
}) {
  const router = useRouter();
  const [membersWs, setMembersWs] = useState<WsCard | null>(null);
  const [editWs, setEditWs] = useState<WsCard | null>(null);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Espacios de trabajo donde participas o que creaste. Entra a uno para ver su tablero.
        </p>
        <CreateWorkspaceDialog onCreated={() => router.refresh()} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Atajos generales */}
        <Link href="/dashboard/tareas/todas">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardContent className="flex h-full items-center gap-3 p-5">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Layers className="size-5" />
              </span>
              <div>
                <p className="font-semibold">Todas las tareas</p>
                <p className="text-xs text-muted-foreground">{totalCount} tareas visibles</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/tareas/general">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardContent className="flex h-full items-center gap-3 p-5">
              <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-foreground">
                <ListChecks className="size-5" />
              </span>
              <div>
                <p className="font-semibold">General</p>
                <p className="text-xs text-muted-foreground">{generalCount} tareas sin workspace</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Workspaces */}
        {workspaces.map((w) => (
          <Card key={w.id} className="group h-full overflow-hidden transition-shadow hover:shadow-md">
            {/* Portada */}
            <Link href={`/dashboard/tareas/${w.id}`} className="block">
              <div className="relative h-24 w-full" style={{ background: w.color }}>
                {w.portada_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={w.portada_url} alt={w.nombre} className="h-full w-full object-cover" />
                )}
                {w.my_rol && (
                  <Badge variant="muted" className="absolute right-2 top-2">{ROL_LABEL[w.my_rol] ?? w.my_rol}</Badge>
                )}
                <span className="absolute -bottom-4 left-4 flex size-9 items-center justify-center rounded-xl border-2 border-background bg-background text-foreground shadow"
                  style={{ color: w.color }}>
                  <FolderKanban className="size-5" />
                </span>
              </div>
            </Link>
            <CardContent className="flex h-[calc(100%-6rem)] flex-col gap-3 p-5 pt-6">
              <Link href={`/dashboard/tareas/${w.id}`} className="flex-1">
                <p className="font-semibold leading-tight">{w.nombre}</p>
                {w.descripcion && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{w.descripcion}</p>
                )}
              </Link>
              <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><ListChecks className="size-3.5" />{w.taskCount}</span>
                  <span className="flex items-center gap-1"><Users className="size-3.5" />{w.memberCount}</span>
                </span>
                {w.my_rol === "owner" && (
                  <span className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditWs(w)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setMembersWs(w)}>
                      <Users className="size-3.5" /> Miembros
                    </Button>
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {workspaces.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Aún no tienes workspaces. Crea el primero con “Nuevo workspace”.
        </p>
      )}

      {membersWs && (
        <WorkspaceMembersDialog
          workspaceId={membersWs.id}
          workspaceName={membersWs.nombre}
          profiles={profiles}
          open={!!membersWs}
          onOpenChange={(o) => !o && setMembersWs(null)}
        />
      )}

      {editWs && (
        <EditWorkspaceDialog
          ws={editWs}
          open={!!editWs}
          onOpenChange={(o) => !o && setEditWs(null)}
          onSaved={() => { setEditWs(null); router.refresh(); }}
        />
      )}
    </>
  );
}

function EditWorkspaceDialog({
  ws, open, onOpenChange, onSaved,
}: {
  ws: WsCard;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState(ws.nombre);
  const [descripcion, setDescripcion] = useState(ws.descripcion ?? "");
  const [color, setColor] = useState(ws.color);
  const [portada, setPortada] = useState(ws.portada_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();

  async function uploadCover(file: File) {
    setUploading(true);
    try {
      const up = await uploadFileViaSignedUrl("workspace-covers", ws.id, file);
      if (up.ok && up.url) { setPortada(up.url); toast.success("Portada lista. Guarda para aplicar."); }
      else toast.error(up.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Editar workspace</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="relative h-28 overflow-hidden rounded-lg" style={{ background: color }}>
            {portada && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={portada} alt="Portada" className="h-full w-full object-cover" />
            )}
            <label className="absolute bottom-2 right-2 flex cursor-pointer items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-xs font-medium shadow hover:bg-background">
              <ImageUp className="size-3.5" /> {uploading ? "Subiendo…" : "Cambiar portada"}
              <input type="file" accept="image/*" className="hidden" disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = ""; }} />
            </label>
          </div>
          <div>
            <Label htmlFor="e-nombre">Nombre</Label>
            <Input id="e-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="e-desc">Descripción</Label>
            <Textarea id="e-desc" rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="e-color">Color</Label>
            <input id="e-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-14 rounded border" />
          </div>
          <Button
            className="w-full" disabled={pending || uploading}
            onClick={() =>
              start(async () => {
                const res = await updateWorkspace({ id: ws.id, nombre, descripcion, color, portada_url: portada });
                if (res.ok) { toast.success(res.message); onSaved(); } else toast.error(res.message);
              })
            }
          >
            {pending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
        <Button><Plus className="size-4" /> Nuevo workspace</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nuevo workspace</DialogTitle></DialogHeader>
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
            className="w-full" disabled={pending}
            onClick={() => {
              if (!nombre.trim()) return toast.error("Escribe un nombre.");
              start(async () => {
                const res = await createWorkspace({ nombre, descripcion, color });
                if (res.ok) { toast.success(res.message); setNombre(""); setDescripcion(""); setOpen(false); onCreated(); }
                else toast.error(res.message);
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
