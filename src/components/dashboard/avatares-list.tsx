"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Search, Plus, Bot, Wand2, Mic, ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { initials } from "@/lib/utils";
import type { Avatar } from "@/types/database";
import { createAvatar, generatePersona } from "@/actions/avatares";

type AvatarCard = Avatar & { jobs: number };

export function AvataresList({ avatars, canManage }: { avatars: AvatarCard[]; canManage: boolean }) {
  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return avatars;
    return avatars.filter(
      (a) =>
        a.nombre.toLowerCase().includes(n) ||
        (a.arquetipo ?? "").toLowerCase().includes(n) ||
        (a.descripcion ?? "").toLowerCase().includes(n),
    );
  }, [avatars, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar avatar por nombre o arquetipo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        {canManage && (
          <Button onClick={() => setOpenNew(true)}>
            <Plus className="size-4" /> Nuevo avatar
          </Button>
        )}
      </div>

      {filtered.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Bot className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {q.trim() ? `No hay avatares que coincidan con “${q}”.` : "Aún no hay avatares. Crea el primer personaje de marca."}
            </p>
            {canManage && (
              <Button onClick={() => setOpenNew(true)}>
                <Plus className="size-4" /> Nuevo avatar
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((a) => (
          <Link key={a.id} href={`/dashboard/comunicaciones/avatares/${a.id}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start gap-3">
                  {a.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.avatar_url}
                      alt={a.nombre}
                      className="size-12 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {initials(a.nombre)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{a.nombre}</p>
                    {a.arquetipo && <p className="truncate text-xs text-muted-foreground">{a.arquetipo}</p>}
                  </div>
                </div>
                {a.descripcion && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{a.descripcion}</p>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  {a.tono && <Badge variant="muted">{a.tono.split(",")[0]?.trim()}</Badge>}
                  {a.valores.slice(0, 2).map((v) => (
                    <Badge key={v} variant="secondary">{v}</Badge>
                  ))}
                </div>
                <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Wand2 className="size-3.5" /> {a.jobs} generaciones</span>
                  {a.voice_id && <span className="flex items-center gap-1"><Mic className="size-3.5" /> voz</span>}
                  {a.avatar_url && <span className="flex items-center gap-1"><ImageIcon className="size-3.5" /> retrato</span>}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {openNew && <NewAvatarDialog onClose={() => setOpenNew(false)} />}
    </div>
  );
}

function NewAvatarDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [genPending, startGen] = useTransition();
  const [nombre, setNombre] = useState("");
  const [arquetipo, setArquetipo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [personalidad, setPersonalidad] = useState("");
  const [tono, setTono] = useState("");
  const [valores, setValores] = useState("");
  const [estiloVisual, setEstiloVisual] = useState("");

  function autofill() {
    if (nombre.trim().length < 2) return toast.error("Escribe el nombre del personaje primero.");
    startGen(async () => {
      const res = await generatePersona({ nombre, arquetipo, brief: descripcion });
      if (res.ok && res.data) {
        setPersonalidad(res.data.personalidad);
        setTono(res.data.tono);
        setValores(res.data.valores.join(", "));
        setEstiloVisual(res.data.estilo_visual);
        toast.success(res.message);
      } else toast.error(res.message);
    });
  }

  function save() {
    if (nombre.trim().length < 2) return toast.error("Escribe el nombre.");
    start(async () => {
      const res = await createAvatar({
        nombre,
        arquetipo,
        descripcion,
        personalidad,
        tono,
        valores: valores.split(",").map((s) => s.trim()).filter(Boolean),
        estilo_visual: estiloVisual,
        voice_provider: "elevenlabs",
      });
      if (res.ok && res.data) {
        toast.success(res.message);
        router.push(`/dashboard/comunicaciones/avatares/${res.data.id}`);
      } else toast.error(res.message);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo avatar (personaje de marca)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="a-nombre">Nombre *</Label>
              <Input id="a-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="a-arq">Arquetipo</Label>
              <Input id="a-arq" placeholder="vocero, reportero, juvenil…" value={arquetipo} onChange={(e) => setArquetipo(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="a-desc">Descripción corta</Label>
            <Input id="a-desc" placeholder="Pitch del personaje en una frase" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Personalidad</p>
            <Button size="sm" variant="outline" onClick={autofill} disabled={genPending}>
              <Wand2 className="size-4" /> {genPending ? "Generando…" : "Autogenerar con IA"}
            </Button>
          </div>
          <Textarea rows={3} placeholder="Personalidad / bio del personaje" value={personalidad} onChange={(e) => setPersonalidad(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="a-tono">Tono</Label>
              <Input id="a-tono" placeholder="cercano, firme…" value={tono} onChange={(e) => setTono(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="a-val">Valores (coma)</Label>
              <Input id="a-val" placeholder="territorio, transparencia…" value={valores} onChange={(e) => setValores(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="a-vis">Estilo visual (para imagen)</Label>
            <Textarea id="a-vis" rows={2} placeholder="Encuadre, luz, vestuario, fondo…" value={estiloVisual} onChange={(e) => setEstiloVisual(e.target.value)} />
          </div>

          <Button className="w-full" onClick={save} disabled={pending}>
            {pending ? "Creando…" : "Crear y abrir estudio"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
