"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, CalendarRange, Megaphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/shared";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { CONTENT_CANALES, CONTENT_ESTADOS } from "@/lib/validations";
import {
  createCalendarItem, setCalendarEstado, deleteCalendarItem, type CalendarItem,
} from "@/actions/contenido";

const ESTADO_LABEL: Record<string, string> = {
  idea: "Idea", borrador: "Borrador", en_revision: "En revisión", aprobado: "Aprobado",
  programado: "Programado", publicado: "Publicado", archivado: "Archivado",
};

interface Opt { id: string; titulo?: string | null; full_name?: string | null; email?: string | null }

export function CalendarioEditorial({
  items, posts, profiles,
}: {
  items: CalendarItem[];
  posts: Opt[];
  profiles: Opt[];
}) {
  const router = useRouter();
  const nameById = useMemo(() => new Map(profiles.map((p) => [p.id, p.full_name ?? p.email ?? "—"])), [profiles]);

  // Agrupa por fecha (día)
  const grouped = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const it of items) {
      const key = it.fecha_programada ? it.fecha_programada.slice(0, 10) : "Sin fecha";
      (m.get(key) ?? m.set(key, []).get(key)!).push(it);
    }
    return Array.from(m.entries());
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateDialog posts={posts} profiles={profiles} onSaved={() => router.refresh()} />
      </div>

      {items.length === 0 ? (
        <EmptyState icon={CalendarRange} title="Calendario vacío" description="Programa piezas por canal y fecha para organizar la difusión." />
      ) : (
        <div className="space-y-4">
          {grouped.map(([fecha, list]) => (
            <div key={fecha}>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                {fecha === "Sin fecha" ? "Sin fecha" : formatDate(fecha, { dateStyle: "full" })}
              </h3>
              <Card>
                <CardContent className="divide-y p-0">
                  {list.map((it) => (
                    <div key={it.id} className="flex flex-wrap items-center gap-2 p-3">
                      <Badge variant="secondary" className="gap-1"><Megaphone className="size-3" />{it.canal}</Badge>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{it.titulo}</span>
                      {it.responsable_id && <span className="text-xs text-muted-foreground">{nameById.get(it.responsable_id) ?? ""}</span>}
                      <Select value={it.estado} onValueChange={(v) => {
                        // optimista
                        it.estado = v;
                        (async () => { const r = await setCalendarEstado(it.id, v); if (!r.ok) { toast.error(r.message); router.refresh(); } })();
                      }}>
                        <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{CONTENT_ESTADOS.map((e) => <SelectItem key={e} value={e}>{ESTADO_LABEL[e]}</SelectItem>)}</SelectContent>
                      </Select>
                      <button
                        className="rounded p-1.5 text-muted-foreground hover:text-destructive"
                        onClick={() => { if (confirm("¿Quitar del calendario?")) { (async () => { const r = await deleteCalendarItem(it.id); if (r.ok) router.refresh(); else toast.error(r.message); })(); } }}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateDialog({ posts, profiles, onSaved }: { posts: Opt[]; profiles: Opt[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const NONE = "__none__";
  const [f, setF] = useState({ titulo: "", canal: "", fecha_programada: "", estado: "programado", post_id: "", responsable_id: "" });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="size-4" /> Programar pieza</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Programar pieza</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Título *</Label><Input value={f.titulo} onChange={(e) => set("titulo", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Canal *</Label>
              <Select value={f.canal} onValueChange={(v) => set("canal", v)}>
                <SelectTrigger><SelectValue placeholder="Canal" /></SelectTrigger>
                <SelectContent>{CONTENT_CANALES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Fecha *</Label><Input type="date" value={f.fecha_programada} onChange={(e) => set("fecha_programada", e.target.value)} /></div>
          </div>
          <div>
            <Label>Estado</Label>
            <Select value={f.estado} onValueChange={(v) => set("estado", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CONTENT_ESTADOS.map((e) => <SelectItem key={e} value={e}>{ESTADO_LABEL[e]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Publicación vinculada (opcional)</Label>
            <Select value={f.post_id || NONE} onValueChange={(v) => set("post_id", v === NONE ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Ninguna" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Ninguna</SelectItem>
                {posts.map((p) => <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Responsable (opcional)</Label>
            <Select value={f.responsable_id || NONE} onValueChange={(v) => set("responsable_id", v === NONE ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin asignar</SelectItem>
                {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full" disabled={pending}
            onClick={() => {
              if (f.titulo.trim().length < 3) return toast.error("Título muy corto.");
              if (!f.canal) return toast.error("Selecciona un canal.");
              if (!f.fecha_programada) return toast.error("Indica la fecha.");
              start(async () => {
                const r = await createCalendarItem(f);
                if (r.ok) { toast.success(r.message); setF({ titulo: "", canal: "", fecha_programada: "", estado: "programado", post_id: "", responsable_id: "" }); setOpen(false); onSaved(); }
                else toast.error(r.message);
              });
            }}
          >
            {pending ? "Programando…" : "Programar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
