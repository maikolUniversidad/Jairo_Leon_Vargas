"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ExternalLink, ImageUp, Newspaper } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/shared";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { uploadFileViaSignedUrl } from "@/lib/upload";
import { CONTENT_TIPOS, CONTENT_ESTADOS } from "@/lib/validations";
import type { ContentPost } from "@/types/database";
import { createPost, updatePost, setPostEstado, deletePost } from "@/actions/contenido";

const ESTADO_LABEL: Record<string, string> = {
  idea: "Idea", borrador: "Borrador", en_revision: "En revisión", aprobado: "Aprobado",
  programado: "Programado", publicado: "Publicado", archivado: "Archivado",
};
const ESTADO_TONE: Record<string, "muted" | "secondary" | "warning" | "success"> = {
  idea: "muted", borrador: "muted", en_revision: "warning", aprobado: "secondary",
  programado: "secondary", publicado: "success", archivado: "muted",
};

export function PublicacionesManager({ posts }: { posts: ContentPost[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<ContentPost | null>(null);
  const [creating, setCreating] = useState(false);
  const [, start] = useTransition();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}><Plus className="size-4" /> Nueva publicación</Button>
      </div>

      {posts.length === 0 ? (
        <EmptyState icon={Newspaper} title="Sin publicaciones" description="Crea noticias, comunicados o piezas. Al publicarlas como públicas aparecen en el sitio." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              {p.imagen_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imagen_url} alt={p.titulo} className="h-32 w-full object-cover" />
              )}
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={ESTADO_TONE[p.estado]}>{ESTADO_LABEL[p.estado] ?? p.estado}</Badge>
                  <Badge variant={p.visibilidad === "publica" ? "success" : "muted"}>{p.visibilidad}</Badge>
                  <span className="text-xs text-muted-foreground">{p.tipo}</span>
                </div>
                <p className="font-semibold leading-tight">{p.titulo}</p>
                {p.resumen && <p className="line-clamp-2 text-xs text-muted-foreground">{p.resumen}</p>}
                <div className="flex items-center justify-between pt-1">
                  <Select value={p.estado} onValueChange={(v) => start(async () => {
                    const r = await setPostEstado(p.id, v);
                    if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.message);
                  })}>
                    <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONTENT_ESTADOS.map((e) => <SelectItem key={e} value={e}>{ESTADO_LABEL[e]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-1">
                    {p.estado === "publicado" && p.visibilidad === "publica" && p.slug && (
                      <a href={`/noticias/${p.slug}`} target="_blank" rel="noopener noreferrer" className="rounded p-1.5 text-muted-foreground hover:text-primary" title="Ver en el sitio">
                        <ExternalLink className="size-4" />
                      </a>
                    )}
                    <button onClick={() => setEdit(p)} className="rounded p-1.5 text-muted-foreground hover:text-foreground"><Pencil className="size-4" /></button>
                    <button onClick={() => { if (confirm("¿Eliminar?")) start(async () => { const r = await deletePost(p.id); if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.message); }); }} className="rounded p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(creating || edit) && (
        <PostDialog
          post={edit ?? undefined}
          onClose={() => { setCreating(false); setEdit(null); }}
          onSaved={() => { setCreating(false); setEdit(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function PostDialog({ post, onClose, onSaved }: { post?: ContentPost; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    titulo: post?.titulo ?? "",
    tipo: post?.tipo ?? "noticia",
    categoria: post?.categoria ?? "",
    resumen: post?.resumen ?? "",
    cuerpo: post?.cuerpo ?? "",
    visibilidad: (post?.visibilidad ?? "interna") as "publica" | "interna",
    estado: post?.estado ?? "borrador",
    fecha_publicacion: post?.fecha_publicacion?.slice(0, 10) ?? "",
  });
  const [imagen, setImagen] = useState(post?.imagen_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function uploadImg(file: File) {
    setUploading(true);
    try {
      const up = await uploadFileViaSignedUrl("contenido", "posts", file);
      if (up.ok && up.url) setImagen(up.url);
      else toast.error(up.message);
    } finally { setUploading(false); }
  }

  function save() {
    if (f.titulo.trim().length < 3) return toast.error("Título muy corto.");
    start(async () => {
      const payload = { ...f, imagen_url: imagen };
      const r = post ? await updatePost(post.id, payload) : await createPost(payload);
      if (r.ok) { toast.success(r.message); onSaved(); } else toast.error(r.message);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{post ? "Editar publicación" : "Nueva publicación"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="relative h-32 overflow-hidden rounded-lg bg-muted">
            {imagen && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagen} alt="" className="h-full w-full object-cover" />
            )}
            <label className="absolute bottom-2 right-2 flex cursor-pointer items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-xs font-medium shadow hover:bg-background">
              <ImageUp className="size-3.5" /> {uploading ? "Subiendo…" : "Imagen"}
              <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadImg(file); e.target.value = ""; }} />
            </label>
          </div>
          <div><Label>Título *</Label><Input value={f.titulo} onChange={(e) => set("titulo", e.target.value)} /></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Tipo</Label>
              <Select value={f.tipo} onValueChange={(v) => set("tipo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONTENT_TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Visibilidad</Label>
              <Select value={f.visibilidad} onValueChange={(v) => set("visibilidad", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="interna">Interna</SelectItem>
                  <SelectItem value="publica">Pública (sitio web)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={f.estado} onValueChange={(v) => set("estado", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONTENT_ESTADOS.map((e) => <SelectItem key={e} value={e}>{ESTADO_LABEL[e]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Categoría</Label><Input value={f.categoria} onChange={(e) => set("categoria", e.target.value)} /></div>
            <div><Label>Fecha de publicación</Label><Input type="date" value={f.fecha_publicacion} onChange={(e) => set("fecha_publicacion", e.target.value)} /></div>
          </div>
          <div><Label>Resumen</Label><Textarea rows={2} value={f.resumen} onChange={(e) => set("resumen", e.target.value)} /></div>
          <div><Label>Cuerpo</Label><Textarea rows={6} value={f.cuerpo} onChange={(e) => set("cuerpo", e.target.value)} /></div>
          {f.visibilidad === "publica" && f.estado === "publicado" && (
            <p className="rounded-md bg-emerald-50 p-2 text-xs text-emerald-800">Se mostrará en la sección de Noticias del sitio web.</p>
          )}
          <Button className="w-full" onClick={save} disabled={pending || uploading}>
            {pending ? "Guardando…" : post ? "Guardar cambios" : "Crear publicación"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
