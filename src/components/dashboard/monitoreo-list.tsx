"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Search, Plus, Radar, Newspaper, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { initials, formatDate } from "@/lib/utils";
import {
  MONITOR_RELACION_LABELS,
  type MonitorPerson,
  type MonitorRelacion,
} from "@/types/database";
import { createPerson } from "@/actions/monitoreo";

type Person = MonitorPerson & { items: number };

export const RELACION_VARIANT: Record<MonitorRelacion, "default" | "secondary" | "muted" | "success" | "warning"> = {
  propio: "default",
  aliado: "success",
  contraposicion: "warning",
  neutral: "muted",
  objetivo: "secondary",
};

export function MonitoreoList({ persons, canManage }: { persons: Person[]; canManage: boolean }) {
  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [prefill, setPrefill] = useState("");

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return persons;
    return persons.filter(
      (p) =>
        p.nombre.toLowerCase().includes(n) ||
        (p.cargo ?? "").toLowerCase().includes(n) ||
        (p.partido ?? "").toLowerCase().includes(n),
    );
  }, [persons, q]);

  return (
    <div className="space-y-4">
      {/* Buscador + alta */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar persona por nombre, cargo o partido…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        {canManage && (
          <Button onClick={() => { setPrefill(""); setOpenNew(true); }}>
            <Plus className="size-4" /> Nueva persona
          </Button>
        )}
      </div>

      {/* Sin resultados → ofrecer crear */}
      {filtered.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Radar className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No hay personas que coincidan con “{q}”.
            </p>
            {canManage && q.trim() && (
              <Button onClick={() => { setPrefill(q.trim()); setOpenNew(true); }}>
                <Plus className="size-4" /> Monitorear a “{q.trim()}”
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Grid de personas */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <Link key={p.id} href={`/dashboard/comunicaciones/monitoreo/${p.id}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {initials(p.nombre)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.nombre}</p>
                    {p.cargo && <p className="truncate text-xs text-muted-foreground">{p.cargo}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={RELACION_VARIANT[p.relacion]}>
                    {MONITOR_RELACION_LABELS[p.relacion]}
                  </Badge>
                  {p.partido && <Badge variant="muted">{p.partido}</Badge>}
                </div>
                <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Newspaper className="size-3.5" /> {p.items} menciones
                  </span>
                  {p.ultima_recoleccion && (
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" /> {formatDate(p.ultima_recoleccion)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {openNew && (
        <NewPersonDialog defaultName={prefill} onClose={() => setOpenNew(false)} />
      )}
    </div>
  );
}

function NewPersonDialog({ defaultName, onClose }: { defaultName: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [nombre, setNombre] = useState(defaultName);
  const [relacion, setRelacion] = useState<MonitorRelacion>("objetivo");
  const [cargo, setCargo] = useState("");
  const [partido, setPartido] = useState("");
  const [keywords, setKeywords] = useState("");

  function save() {
    if (nombre.trim().length < 2) return toast.error("Escribe el nombre.");
    start(async () => {
      const res = await createPerson({
        nombre,
        relacion,
        cargo,
        partido,
        keywords: keywords.split(",").map((s) => s.trim()).filter(Boolean),
      });
      if (res.ok && res.data) {
        toast.success(res.message);
        router.push(`/dashboard/comunicaciones/monitoreo/${res.data.id}`);
      } else toast.error(res.message);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva persona a monitorear</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="m-nombre">Nombre completo *</Label>
            <Input id="m-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Relación</Label>
              <Select value={relacion} onValueChange={(v) => setRelacion(v as MonitorRelacion)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MONITOR_RELACION_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="m-partido">Partido / movimiento</Label>
              <Input id="m-partido" value={partido} onChange={(e) => setPartido(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="m-cargo">Cargo</Label>
            <Input id="m-cargo" placeholder="Senador, representante, alcalde…" value={cargo} onChange={(e) => setCargo(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="m-kw">Palabras clave (coma) — mejora la búsqueda</Label>
            <Input id="m-kw" placeholder="Nombre alterno, apodo, cuenta…" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
          </div>
          <Button className="w-full" onClick={save} disabled={pending}>
            {pending ? "Creando…" : "Crear y abrir expediente"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
