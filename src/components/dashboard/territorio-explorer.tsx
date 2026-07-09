"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { MapPinned, Plus, ListChecks, Users, ExternalLink, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PriorityBadge } from "@/lib/status";
import { useTabParam } from "@/hooks/use-tab-param";
import { cn } from "@/lib/utils";
import { LOCALIDADES } from "@/lib/validations";
import { GEO_SOURCES, normalizeName, type GeoLayerSource } from "@/lib/geo-sources";
import { TerritorioMap, type AreaHighlight } from "@/components/dashboard/territorio-map";
import { TASK_STATUS_LABELS, type Zone, type ZoneType } from "@/types/database";
import {
  ensureZone,
  getZoneDetail,
  createZoneTask,
  updateZone,
} from "@/actions/territorio";

type Persona = { id: string; full_name: string | null; email: string | null };
type ZoneTask = {
  id: string;
  titulo: string;
  estado: keyof typeof TASK_STATUS_LABELS;
  prioridad: "baja" | "media" | "alta" | "urgente";
  fecha_limite: string | null;
  responsable_id: string | null;
};
type Detail = {
  zone: Zone | null;
  tasks: ZoneTask[];
  leaders: { id: string; nombre: string; rol: string | null; telefono: string | null }[];
};

const TABS: { key: string; source: GeoLayerSource }[] = [
  { key: "bogota_localidades", source: GEO_SOURCES.bogota_localidades },
  { key: "bogota_barrios", source: GEO_SOURCES.bogota_barrios },
  { key: "colombia_departamentos", source: GEO_SOURCES.colombia_departamentos },
];

const CAPA_KEYS = TABS.map((t) => t.key) as [string, ...string[]];

export function TerritorioExplorer({
  zones,
  taskCounts,
  profiles,
  canManage,
}: {
  zones: Zone[];
  taskCounts: Record<string, number>;
  profiles: Persona[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [capa, setCapa] = useTabParam("capa", CAPA_KEYS[0], CAPA_KEYS);
  const tab = TABS.find((t) => t.key === capa) ?? TABS[0]!;
  const [selected, setSelected] = useState<{ name: string; code: string | null; tipo: GeoLayerSource["tipo"] } | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [, start] = useTransition();

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(p.id, p.full_name ?? p.email ?? "—");
    return m;
  }, [profiles]);

  // Resalta áreas con zona/tareas (coloreado del mapa).
  const highlight = useMemo(() => {
    const m = new Map<string, AreaHighlight>();
    for (const z of zones) {
      m.set(normalizeName(z.nombre_zona), {
        count: taskCounts[z.id] ?? 0,
        prioridad: z.prioridad,
      });
    }
    return m;
  }, [zones, taskCounts]);

  function selectArea(name: string, code: string | null, tipo: GeoLayerSource["tipo"]) {
    setSelected({ name, code, tipo });
    setDetail(null);
    const existing = zones.find(
      (z) => normalizeName(z.nombre_zona) === normalizeName(name) && z.tipo_zona === tipo,
    );
    if (existing) {
      start(async () => {
        const d = await getZoneDetail(existing.id);
        setDetail(d as Detail);
      });
    } else {
      setDetail({ zone: null, tasks: [], leaders: [] });
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Mapa + tabs */}
      <div className="space-y-3 lg:col-span-2">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Button
              key={t.key}
              size="sm"
              variant={tab.key === t.key ? "default" : "outline"}
              onClick={() => setCapa(t.key)}
            >
              {t.source.label}
            </Button>
          ))}
        </div>

        <TerritorioMap key={tab.key} source={tab.source} highlight={highlight} onSelect={selectArea} />

        {/* Acceso rápido a localidades de Bogotá (funciona aunque el mapa no cargue) */}
        {tab.key === "bogota_localidades" && (
          <div className="flex flex-wrap gap-1.5">
            {LOCALIDADES.filter((l) => l !== "Otra").map((l) => {
              const h = highlight.get(normalizeName(l));
              return (
                <button
                  key={l}
                  onClick={() => selectArea(l, null, "localidad")}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition hover:bg-muted",
                    selected?.name === l && "border-primary bg-primary/10",
                  )}
                >
                  {l}
                  {h && h.count > 0 && (
                    <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">{h.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Panel del área seleccionada */}
      <div>
        {!selected ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
              <MapPinned className="size-8 text-muted-foreground/40" />
              Haz clic en una zona del mapa (o en una localidad) para ver y crear tareas del territorio.
            </CardContent>
          </Card>
        ) : (
          <AreaPanel
            key={selected.name + selected.tipo}
            area={selected}
            detail={detail}
            nameById={nameById}
            profiles={profiles}
            canManage={canManage}
            onChanged={(d) => { setDetail(d); router.refresh(); }}
          />
        )}
      </div>
    </div>
  );
}

function AreaPanel({
  area,
  detail,
  nameById,
  profiles,
  canManage,
  onChanged,
}: {
  area: { name: string; code: string | null; tipo: GeoLayerSource["tipo"] };
  detail: Detail | null;
  nameById: Map<string, string>;
  profiles: Persona[];
  canManage: boolean;
  onChanged: (d: Detail) => void;
}) {
  const [pending, start] = useTransition();
  const [titulo, setTitulo] = useState("");
  const [prioridad, setPrioridad] = useState<"baja" | "media" | "alta" | "urgente">("media");
  const [responsable, setResponsable] = useState("");
  const [fecha, setFecha] = useState("");

  async function reload(zoneId: string) {
    const d = await getZoneDetail(zoneId);
    onChanged(d as Detail);
  }

  function createTask() {
    if (titulo.trim().length < 3) return toast.error("Escribe un título de tarea.");
    start(async () => {
      // Asegura la zona (la crea si es la primera tarea del área).
      let zoneId = detail?.zone?.id;
      if (!zoneId) {
        const ez = await ensureZone(area.name, area.tipo as ZoneType, area.code);
        if (!ez.ok || !ez.data) { toast.error(ez.message); return; }
        zoneId = ez.data.zone.id;
      }
      const res = await createZoneTask({
        zona_id: zoneId,
        titulo,
        prioridad,
        responsable_id: responsable || undefined,
        fecha_limite: fecha || undefined,
      });
      if (res.ok) {
        toast.success(res.message);
        setTitulo(""); setResponsable(""); setFecha("");
        await reload(zoneId);
      } else toast.error(res.message);
    });
  }

  const zone = detail?.zone ?? null;
  const tasks = detail?.tasks ?? [];

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <div className="flex items-center gap-2">
            <MapPinned className="size-5 text-primary" />
            <h3 className="text-lg font-bold">{area.name}</h3>
          </div>
          <p className="text-xs capitalize text-muted-foreground">{area.tipo}</p>
        </div>

        {detail === null ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <>
            {/* Gestión de la zona (coordinación) */}
            {zone && canManage && <ZoneManager zone={zone} profiles={profiles} onSaved={() => reload(zone.id)} />}
            {zone && !canManage && zone.descripcion && (
              <p className="text-sm text-muted-foreground">{zone.descripcion}</p>
            )}

            {/* Líderes de la zona */}
            {detail.leaders.length > 0 && (
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
                  <Users className="size-4" /> Líderes
                </p>
                <ul className="space-y-1 text-sm">
                  {detail.leaders.map((l) => (
                    <li key={l.id} className="text-muted-foreground">
                      {l.nombre}{l.rol ? ` · ${l.rol}` : ""}{l.telefono ? ` · ${l.telefono}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tareas del área (ligadas al Kanban) */}
            <div>
              <p className="mb-2 flex items-center justify-between text-sm font-semibold">
                <span className="flex items-center gap-1.5"><ListChecks className="size-4" /> Tareas ({tasks.length})</span>
                <Link href="/dashboard/tareas" className="flex items-center gap-1 text-xs font-normal text-primary hover:underline">
                  Ver Kanban <ExternalLink className="size-3" />
                </Link>
              </p>
              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no hay tareas en esta zona.</p>
              ) : (
                <ul className="space-y-1.5">
                  {tasks.map((t) => (
                    <li key={t.id} className="rounded-lg border p-2 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium">{t.titulo}</span>
                        <PriorityBadge priority={t.prioridad} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <Badge variant="muted">{TASK_STATUS_LABELS[t.estado]}</Badge>
                        {t.responsable_id && <span>{nameById.get(t.responsable_id) ?? "—"}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Crear tarea para el área */}
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold"><Plus className="size-4" /> Nueva tarea aquí</p>
              <Input placeholder="¿Qué hay que hacer en esta zona?" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Select value={prioridad} onValueChange={(v) => setPrioridad(v as typeof prioridad)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-9" />
              </div>
              <Select value={responsable} onValueChange={setResponsable}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Responsable (opcional)" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name || p.email || p.id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button className="w-full" onClick={createTask} disabled={pending}>
                {pending ? "Creando…" : "Crear tarea y enlazar al Kanban"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ZoneManager({
  zone,
  profiles,
  onSaved,
}: {
  zone: Zone;
  profiles: Persona[];
  onSaved: () => void;
}) {
  const [pending, start] = useTransition();
  const [prioridad, setPrioridad] = useState(zone.prioridad);
  const [descripcion, setDescripcion] = useState(zone.descripcion ?? "");
  const [problematicas, setProblematicas] = useState((zone.problematicas ?? []).join(", "));
  const [responsable, setResponsable] = useState(zone.responsable_id ?? "");

  function save() {
    start(async () => {
      const res = await updateZone(zone.id, {
        prioridad,
        descripcion,
        problematicas: problematicas.split(",").map((s) => s.trim()).filter(Boolean),
        responsable_id: responsable || null,
      });
      if (res.ok) { toast.success(res.message); onSaved(); }
      else toast.error(res.message);
    });
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-sm font-semibold">Gestión de la zona</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Prioridad</Label>
          <Select value={prioridad} onValueChange={(v) => setPrioridad(v as typeof prioridad)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="baja">Baja</SelectItem>
              <SelectItem value="media">Media</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Responsable</Label>
          <Select value={responsable} onValueChange={setResponsable}>
            <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name || p.email || p.id.slice(0, 8)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs">Problemáticas (separadas por coma)</Label>
        <Input value={problematicas} onChange={(e) => setProblematicas(e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Descripción</Label>
        <Textarea rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      </div>
      <Button size="sm" variant="outline" onClick={save} disabled={pending}>
        <Save className="size-4" /> {pending ? "Guardando…" : "Guardar zona"}
      </Button>
    </div>
  );
}
