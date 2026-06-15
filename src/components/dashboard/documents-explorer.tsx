"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Folder,
  FolderPlus,
  FileText,
  Upload,
  Link2,
  Download,
  Trash2,
  Pencil,
  ChevronRight,
  Lock,
  Home,
  Users,
  HardDrive,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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
import { EmptyState } from "@/components/dashboard/shared";
import { cn, formatDate } from "@/lib/utils";
import { ROLES, ROLE_LABELS, type AppRole } from "@/types/roles";
import {
  DOCUMENT_STATUS_LABELS,
  CONFIDENCIALIDAD_LABELS,
  type DocumentFolder,
  type DocumentRecord,
  type Profile,
} from "@/types/database";
import {
  createFolder,
  updateFolder,
  deleteFolder,
  createDocument,
  deleteDocument,
  getDocumentDownloadUrl,
  syncDocumentsToDrive,
} from "@/actions/documentos";
import { uploadDocumentFile } from "@/lib/upload-doc";

type Persona = Pick<Profile, "id" | "full_name" | "email">;

function formatBytes(n: number | null): string {
  if (!n) return "";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

export function DocumentsExplorer({
  folders,
  documents,
  profiles,
  canManage,
  currentUserId,
}: {
  folders: DocumentFolder[];
  documents: DocumentRecord[];
  profiles: Persona[];
  canManage: boolean;
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [editFolder, setEditFolder] = useState<DocumentFolder | null>(null);
  const [upload, setUpload] = useState(false);
  const [, start] = useTransition();

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(p.id, p.full_name ?? p.email ?? "—");
    return m;
  }, [profiles]);

  const folderById = useMemo(() => {
    const m = new Map<string, DocumentFolder>();
    for (const f of folders) m.set(f.id, f);
    return m;
  }, [folders]);

  const subfolders = folders.filter((f) => f.parent_id === current);
  const docsHere = documents.filter((d) => d.folder_id === current);

  // Ruta (breadcrumb) desde la carpeta actual hasta la raíz.
  const trail = useMemo(() => {
    const path: DocumentFolder[] = [];
    let cursor = current;
    while (cursor) {
      const f = folderById.get(cursor);
      if (!f) break;
      path.unshift(f);
      cursor = f.parent_id;
    }
    return path;
  }, [current, folderById]);

  function download(id: string) {
    start(async () => {
      const res = await getDocumentDownloadUrl(id);
      if (res.ok && res.data) window.open(res.data.url, "_blank", "noopener,noreferrer");
      else toast.error(res.message);
    });
  }

  function removeFolder(f: DocumentFolder) {
    if (!confirm(`¿Eliminar la carpeta "${f.nombre}"?`)) return;
    start(async () => {
      const res = await deleteFolder(f.id);
      if (res.ok) { toast.success(res.message); router.refresh(); }
      else toast.error(res.message);
    });
  }

  function removeDoc(d: DocumentRecord) {
    if (!confirm(`¿Eliminar el documento "${d.titulo}"?`)) return;
    start(async () => {
      const res = await deleteDocument(d.id);
      if (res.ok) { toast.success(res.message); router.refresh(); }
      else toast.error(res.message);
    });
  }

  return (
    <div className="space-y-4">
      {/* Barra: breadcrumb + acciones */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <button
            onClick={() => setCurrent(null)}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted",
              current === null && "font-semibold",
            )}
          >
            <Home className="size-4" /> Documentos
          </button>
          {trail.map((f) => (
            <span key={f.id} className="flex items-center gap-1">
              <ChevronRight className="size-3 text-muted-foreground" />
              <button
                onClick={() => setCurrent(f.id)}
                className="rounded-md px-2 py-1 hover:bg-muted"
              >
                {f.nombre}
              </button>
            </span>
          ))}
        </nav>
        <div className="flex gap-2">
          {canManage && (
            <Button
              variant="ghost"
              onClick={() =>
                start(async () => {
                  const res = await syncDocumentsToDrive();
                  if (res.ok) { toast.success(res.message); router.refresh(); }
                  else toast.error(res.message);
                })
              }
            >
              <HardDrive className="size-4" /> Sincronizar con Drive
            </Button>
          )}
          {canManage && (
            <Button variant="outline" onClick={() => setNewFolder(true)}>
              <FolderPlus className="size-4" /> Nueva carpeta
            </Button>
          )}
          <Button onClick={() => setUpload(true)}>
            <Upload className="size-4" /> Subir documento
          </Button>
        </div>
      </div>

      {/* Subcarpetas */}
      {subfolders.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subfolders.map((f) => (
            <Card key={f.id} className="group transition hover:shadow-md">
              <CardContent className="flex items-start gap-3 p-4">
                <button
                  onClick={() => setCurrent(f.id)}
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                >
                  <Folder className="mt-0.5 size-8 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{f.nombre}</p>
                    {f.descripcion && (
                      <p className="truncate text-xs text-muted-foreground">{f.descripcion}</p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {f.allowed_roles.length === 0 ? (
                        <Badge variant="muted" className="gap-1">
                          <Users className="size-3" /> Todo el equipo
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <Lock className="size-3" /> {f.allowed_roles.length} rol(es)
                        </Badge>
                      )}
                      {f.drive_folder_id && (
                        <Badge variant="success" className="gap-1"><HardDrive className="size-3" /> Drive</Badge>
                      )}
                    </div>
                  </div>
                </button>
                {canManage && (
                  <div className="flex shrink-0 flex-col gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      aria-label="Editar carpeta"
                      onClick={() => setEditFolder(f)}
                      className="rounded p-1 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      aria-label="Eliminar carpeta"
                      onClick={() => removeFolder(f)}
                      className="rounded p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Documentos de la carpeta actual */}
      {docsHere.length > 0 ? (
        <Card>
          <CardContent className="divide-y p-0">
            {docsHere.map((d) => (
              <div key={d.id} className="flex items-center gap-3 p-3">
                <FileText className="size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.titulo}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="muted">{DOCUMENT_STATUS_LABELS[d.estado]}</Badge>
                    <Badge variant={d.confidencialidad === "reservado" ? "warning" : "secondary"}>
                      {CONFIDENCIALIDAD_LABELS[d.confidencialidad]}
                    </Badge>
                    {d.tipo_documento && d.tipo_documento !== "general" && (
                      <span className="text-xs text-muted-foreground">{d.tipo_documento}</span>
                    )}
                    {d.size ? <span className="text-xs text-muted-foreground">· {formatBytes(d.size)}</span> : null}
                    <span className="text-xs text-muted-foreground">
                      · {formatDate(d.created_at)}
                      {d.creado_por && ` · ${nameById.get(d.creado_por) ?? "Equipo"}`}
                    </span>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => download(d.id)}>
                  <Download className="size-4" /> Ver
                </Button>
                {(canManage || d.creado_por === currentUserId) && (
                  <button
                    aria-label="Eliminar documento"
                    onClick={() => removeDoc(d)}
                    className="rounded p-1.5 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : subfolders.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Carpeta vacía"
          description={
            canManage
              ? "Crea una subcarpeta o sube el primer documento aquí."
              : "Aún no hay documentos visibles para tu rol en esta carpeta."
          }
        />
      ) : null}

      {/* Diálogos */}
      {newFolder && (
        <FolderDialog
          parentId={current}
          onClose={() => setNewFolder(false)}
          onSaved={() => { setNewFolder(false); router.refresh(); }}
        />
      )}
      {editFolder && (
        <FolderDialog
          folder={editFolder}
          parentId={editFolder.parent_id}
          onClose={() => setEditFolder(null)}
          onSaved={() => { setEditFolder(null); router.refresh(); }}
        />
      )}
      {upload && (
        <UploadDialog
          folderId={current}
          onClose={() => setUpload(false)}
          onSaved={() => { setUpload(false); router.refresh(); }}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Carpeta (crear/editar) ───────────────────────── */

function FolderDialog({
  folder,
  parentId,
  onClose,
  onSaved,
}: {
  folder?: DocumentFolder;
  parentId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState(folder?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(folder?.descripcion ?? "");
  const [roles, setRoles] = useState<AppRole[]>(folder?.allowed_roles ?? []);
  const [pending, start] = useTransition();

  const toggleRole = (r: AppRole) =>
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  function save() {
    if (nombre.trim().length < 2) return toast.error("Ponle un nombre a la carpeta.");
    const payload = {
      nombre: nombre.trim(),
      descripcion,
      parent_id: parentId ?? "",
      allowed_roles: roles,
    };
    start(async () => {
      const res = folder ? await updateFolder(folder.id, payload) : await createFolder(payload);
      if (res.ok) { toast.success(res.message); onSaved(); }
      else toast.error(res.message);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{folder ? "Editar carpeta" : "Nueva carpeta"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="f-nombre">Nombre *</Label>
            <Input id="f-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="f-desc">Descripción</Label>
            <Textarea id="f-desc" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block">Roles con acceso</Label>
            <p className="mb-2 text-xs text-muted-foreground">
              Si no seleccionas ninguno, la carpeta es visible para <strong>todo el equipo</strong>.
              Administración y Dirección General siempre tienen acceso.
            </p>
            <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRole(r)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors",
                    roles.includes(r) ? "bg-primary/10 text-foreground" : "hover:bg-muted",
                  )}
                >
                  <input type="checkbox" readOnly checked={roles.includes(r)} className="size-3.5" />
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
          </div>
          <Button className="w-full" onClick={save} disabled={pending}>
            {pending ? "Guardando…" : folder ? "Guardar cambios" : "Crear carpeta"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── Subir documento ───────────────────────── */

function UploadDialog({
  folderId,
  onClose,
  onSaved,
}: {
  folderId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("");
  const [confidencialidad, setConfidencialidad] = useState<"publico" | "interno" | "reservado">("interno");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<{ path: string; name: string; mime?: string; size?: number } | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();

  async function pickFile(f: File) {
    setUploading(true);
    try {
      const up = await uploadDocumentFile(folderId, f);
      if (!up.ok || !up.path) { toast.error(up.message ?? "No se pudo subir."); return; }
      setFile({ path: up.path, name: up.name ?? f.name, mime: up.mime, size: up.size });
      if (!titulo) setTitulo(up.name ?? f.name);
    } finally {
      setUploading(false);
    }
  }

  function save() {
    if (titulo.trim().length < 2) return toast.error("Ponle un título.");
    if (!file && !linkUrl.trim()) return toast.error("Sube un archivo o pega un enlace.");
    const payload = {
      titulo: titulo.trim(),
      tipo_documento: tipo,
      folder_id: folderId ?? "",
      confidencialidad,
      estado: "borrador" as const,
      contexto_operativo: "institucional" as const,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      archivo_url: file ? "" : linkUrl.trim(),
      storage_path: file?.path ?? "",
      original_name: file?.name ?? "",
      mime: file?.mime ?? "",
      size: file?.size,
    };
    start(async () => {
      const res = await createDocument(payload);
      if (res.ok) { toast.success(res.message); onSaved(); }
      else toast.error(res.message);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Subir documento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="d-titulo">Título *</Label>
            <Input id="d-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="d-tipo">Tipo</Label>
              <Input id="d-tipo" placeholder="acta, informe, oficio…" value={tipo} onChange={(e) => setTipo(e.target.value)} />
            </div>
            <div>
              <Label>Confidencialidad</Label>
              <Select value={confidencialidad} onValueChange={(v) => setConfidencialidad(v as typeof confidencialidad)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="publico">Público</SelectItem>
                  <SelectItem value="interno">Interno</SelectItem>
                  <SelectItem value="reservado">Reservado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="d-tags">Etiquetas (separadas por coma)</Label>
            <Input id="d-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>

          {/* Archivo */}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground hover:bg-muted/50">
            <Upload className="size-4" />
            {uploading ? "Subiendo…" : file ? `Archivo: ${file.name}` : "Subir archivo (máx. 50 MB)"}
            <input
              type="file"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickFile(f);
                e.target.value = "";
              }}
            />
          </label>

          {!file && (
            <div className="flex items-center gap-2">
              <Link2 className="size-4 shrink-0 text-muted-foreground" />
              <Input placeholder="…o pega un enlace externo (https://)" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
            </div>
          )}

          <Button className="w-full" onClick={save} disabled={pending || uploading}>
            {pending ? "Guardando…" : "Guardar documento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
