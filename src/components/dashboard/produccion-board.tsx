"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Sparkles, Wand2, Search, Clapperboard, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/shared";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { VIDEO_FASES, VIDEO_FASE_LABELS, type VideoProject } from "@/types/database";
import { VIDEO_PLATAFORMAS } from "@/lib/validations";
import { createProject } from "@/actions/produccion";

type Status = { ai: boolean; aiProvider: string; higgsfield: boolean; search: boolean };

const FASE_TONE: Record<string, string> = {
  idea: "border-t-slate-300",
  investigacion: "border-t-sky-400",
  guion: "border-t-violet-400",
  produccion: "border-t-amber-400",
  edicion: "border-t-blue-400",
  aprobado: "border-t-emerald-500",
  publicado: "border-t-fuchsia-500",
};

export function ProduccionBoard({ projects, status }: { projects: VideoProject[]; status: Status }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [plataformas, setPlataformas] = useState<string[]>([]);

  function togglePlataforma(p: string) {
    setPlataformas((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  function handleCreate(formData: FormData) {
    start(async () => {
      const res = await createProject({
        titulo: formData.get("titulo"),
        descripcion: formData.get("descripcion"),
        objetivo: formData.get("objetivo"),
        plataformas,
        fase: "idea",
      });
      if (res.ok && res.data) {
        toast.success(res.message);
        setOpen(false);
        setPlataformas([]);
        router.push(`/dashboard/comunicaciones/produccion/${res.data.id}`);
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Estado de integraciones + acción */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <StatusChip icon={Sparkles} label={status.ai ? `Texto: ${status.aiProvider}` : "Texto: mock"} on={status.ai} />
          <StatusChip icon={Wand2} label={status.higgsfield ? "Higgsfield" : "Higgsfield: mock"} on={status.higgsfield} />
          <StatusChip icon={Search} label={status.search ? "Búsqueda web" : "Búsqueda: IA"} on={status.search} />
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4" /> Nuevo proyecto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo proyecto de video</DialogTitle>
            </DialogHeader>
            <form action={handleCreate} className="space-y-3">
              <div>
                <Label htmlFor="titulo">Título *</Label>
                <Input id="titulo" name="titulo" required placeholder="Ej. Recorrido por Kennedy: seguridad" />
              </div>
              <div>
                <Label htmlFor="objetivo">Objetivo / mensaje</Label>
                <Input id="objetivo" name="objetivo" placeholder="¿Qué queremos lograr con este video?" />
              </div>
              <div>
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea id="descripcion" name="descripcion" rows={3} placeholder="Contexto libre…" />
              </div>
              <div>
                <Label>Plataformas objetivo</Label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {VIDEO_PLATAFORMAS.map((p) => (
                    <button
                      type="button"
                      key={p}
                      onClick={() => togglePlataforma(p)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        plataformas.includes(p)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancelar</Button>
                </DialogClose>
                <Button type="submit" disabled={pending}>
                  {pending ? "Creando…" : "Crear proyecto"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title="Aún no hay proyectos de video"
          description="Crea el primero. La IA te ayudará con investigación, guión, copy, portadas y análisis de viralidad."
        />
      ) : (
        <div className="grid grid-flow-col gap-3 overflow-x-auto pb-2 [grid-auto-columns:minmax(240px,1fr)]">
          {VIDEO_FASES.map((fase) => {
            const items = projects.filter((p) => p.fase === fase);
            return (
              <div key={fase} className="min-w-[240px] space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-semibold">{VIDEO_FASE_LABELS[fase]}</span>
                  <Badge variant="muted">{items.length}</Badge>
                </div>
                <div className="space-y-2">
                  {items.map((p) => (
                    <Link key={p.id} href={`/dashboard/comunicaciones/produccion/${p.id}`}>
                      <Card className={`border-t-4 transition-shadow hover:shadow-md ${FASE_TONE[fase] ?? ""}`}>
                        <CardContent className="space-y-2 p-3">
                          <p className="line-clamp-2 text-sm font-medium">{p.titulo}</p>
                          {p.objetivo && (
                            <p className="line-clamp-2 text-xs text-muted-foreground">{p.objetivo}</p>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {p.plataformas.slice(0, 3).map((pl) => (
                              <span key={pl} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                {pl}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{formatDate(p.created_at)}</span>
                            <ArrowRight className="size-3.5" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusChip({ icon: Icon, label, on }: { icon: typeof Sparkles; label: string; on: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
        on ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      <Icon className="size-3.5" /> {label}
    </span>
  );
}
