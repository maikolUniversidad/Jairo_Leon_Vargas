"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Plus,
  Trash2,
  ExternalLink,
  Newspaper,
  Radar,
  Clock,
  Check,
  X as XIcon,
  ChevronDown,
  Bot,
  Wand2,
  CalendarClock,
  History,
  CheckCircle2,
  MinusCircle,
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
import { initials, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/ui/markdown";
import { MonitorCharts } from "@/components/dashboard/monitoreo-charts";
import {
  MONITOR_RELACION_LABELS,
  type MonitorPerson,
  type MonitorItem,
  type MonitorRun,
  type MonitorRelacion,
} from "@/types/database";
import { RELACION_VARIANT } from "@/components/dashboard/monitoreo-list";
import {
  runCollection,
  runSweep,
  analyzePerson,
  analyzeItem,
  analyzeNewItems,
  addManualItem,
  deleteItem,
  updatePerson,
  updateSchedule,
} from "@/actions/monitoreo";

const FUENTE_LABEL: Record<string, string> = {
  noticia: "Noticia",
  x: "X",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  web: "Web",
  manual: "Manual",
};

export function MonitoreoDossier({
  person,
  items: initialItems,
  runs,
  sources,
  canManage,
}: {
  person: MonitorPerson;
  items: MonitorItem[];
  runs: MonitorRun[];
  sources: { fuente: string; label: string; configurado: boolean }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<MonitorItem[]>(initialItems);
  const [relacion, setRelacion] = useState<MonitorRelacion>(person.relacion);
  const [brief, setBrief] = useState<string | null>(person.ultimo_analisis);
  const [filterFuente, setFilterFuente] = useState<string>("todos");
  const [filterSent, setFilterSent] = useState<string>("todos");
  const toggleFuente = (f: string) => setFilterFuente((cur) => (cur === f ? "todos" : f));
  const toggleSent = (s: string) => setFilterSent((cur) => (cur === s ? "todos" : s));
  const [manualOpen, setManualOpen] = useState(false);
  const [collecting, startCollect] = useTransition();
  const [sweeping, startSweep] = useTransition();
  const [analyzing, startAnalyze] = useTransition();
  const [analyzingAll, startAll] = useTransition();
  const [, start] = useTransition();

  useEffect(() => setItems(initialItems), [initialItems]);

  const fuentes = Array.from(new Set(items.map((i) => i.fuente)));
  const shown = filterFuente === "todos" ? items : items.filter((i) => i.fuente === filterFuente);

  function collect() {
    startCollect(async () => {
      const res = await runCollection(person.id);
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else toast.error(res.message);
    });
  }

  function sweep() {
    startSweep(async () => {
      const res = await runSweep(person.id);
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else toast.error(res.message);
    });
  }

  function analyze() {
    startAnalyze(async () => {
      const res = await analyzePerson(person.id);
      if (res.ok && res.data) { setBrief(res.data.brief); toast.success(res.message); }
      else toast.error(res.message);
    });
  }

  function changeRelacion(v: MonitorRelacion) {
    setRelacion(v);
    start(async () => {
      const res = await updatePerson(person.id, { relacion: v });
      if (!res.ok) { toast.error(res.message); setRelacion(person.relacion); }
      else toast.success("Etiqueta actualizada.");
    });
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    start(async () => {
      await deleteItem(id, person.id);
    });
  }

  function patchItem(id: string, patch: Partial<MonitorItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function analyzeAll() {
    startAll(async () => {
      const res = await analyzeNewItems(person.id);
      if (res.ok) { toast.success(res.message); router.refresh(); }
      else toast.error(res.message);
    });
  }

  return (
    <div className="space-y-5">
      <Link
        href="/dashboard/comunicaciones/monitoreo"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Volver al monitoreo
      </Link>

      {/* Cabecera */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
              {initials(person.nombre)}
            </span>
            <div>
              <h1 className="text-xl font-bold">{person.nombre}</h1>
              <p className="text-sm text-muted-foreground">
                {[person.cargo, person.partido].filter(Boolean).join(" · ") || "Sin cargo registrado"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {canManage ? (
                  <Select value={relacion} onValueChange={(v) => changeRelacion(v as MonitorRelacion)}>
                    <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(MONITOR_RELACION_LABELS).map(([k, label]) => (
                        <SelectItem key={k} value={k}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant={RELACION_VARIANT[relacion]}>{MONITOR_RELACION_LABELS[relacion]}</Badge>
                )}
                {person.keywords.slice(0, 4).map((k) => (
                  <Badge key={k} variant="muted">{k}</Badge>
                ))}
              </div>
            </div>
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={collect} disabled={collecting}>
                <RefreshCw className={cn("size-4", collecting && "animate-spin")} />
                {collecting ? "Recolectando…" : "Recolectar reciente"}
              </Button>
              <Button variant="secondary" onClick={sweep} disabled={sweeping} title="Búsqueda amplia de todo lo publicado hasta hoy">
                <Radar className={cn("size-4", sweeping && "animate-spin")} />
                {sweeping ? "Barriendo…" : "Barrido general"}
              </Button>
              <Button variant="outline" onClick={analyze} disabled={analyzing}>
                <Sparkles className="size-4" /> {analyzing ? "Analizando…" : "Analizar con IA"}
              </Button>
              <Button variant="outline" onClick={() => setManualOpen(true)}>
                <Plus className="size-4" /> Mención
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informe de cobertura por red */}
      <NetworkReport items={items} sources={sources} />

      {/* Programación automática */}
      {canManage && <ScheduleCard person={person} />}

      {/* Gráficos (clic = filtro) */}
      <MonitorCharts
        items={items}
        activeSent={filterSent}
        onToggleSent={toggleSent}
        activeFuente={filterFuente}
        onToggleFuente={toggleFuente}
      />

      {/* Brief de IA */}
      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <Sparkles className="size-4 text-primary" /> Análisis de inteligencia
            {person.analisis_at && (
              <span className="text-xs font-normal text-muted-foreground">
                · {formatDate(person.analisis_at, { dateStyle: "medium", timeStyle: "short" })}
              </span>
            )}
          </h3>
          {brief ? (
            <Markdown content={brief} className="text-sm" />
          ) : (
            <p className="text-sm text-muted-foreground">
              Recolecta menciones y pulsa <strong>Analizar con IA</strong> para obtener temas, tono y recomendaciones.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Feed */}
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="flex items-center gap-2 font-semibold">
            <Newspaper className="size-4" /> Menciones ({items.length})
          </h3>
          {canManage && (
            <Button size="sm" variant="outline" onClick={analyzeAll} disabled={analyzingAll}>
              <Wand2 className="size-4" /> {analyzingAll ? "Analizando…" : "Analizar nuevas (IA)"}
            </Button>
          )}
          <div className="ml-auto flex flex-wrap gap-1.5">
            <FilterChip label="Todas" active={filterFuente === "todos"} onClick={() => setFilterFuente("todos")} />
            {fuentes.map((f) => (
              <FilterChip key={f} label={FUENTE_LABEL[f] ?? f} active={filterFuente === f} onClick={() => setFilterFuente(f)} />
            ))}
          </div>
        </div>

        {shown.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
              <Radar className="size-8 text-muted-foreground/40" />
              Aún no hay menciones. Pulsa <strong>Recolectar ahora</strong> para traer noticias y publicaciones.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {shown.map((it) => (
                <MentionRow
                  key={it.id}
                  item={it}
                  personNombre={person.nombre}
                  canManage={canManage}
                  onRemove={removeItem}
                  onPatch={patchItem}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Línea de tiempo de menciones (por sentimiento) */}
      <MentionTimeline
        items={items}
        sent={filterSent}
        setSent={setFilterSent}
        fuente={filterFuente}
      />

      {/* Línea de tiempo de actividad de recolección por red */}
      <CollectionTimeline runs={runs} />

      {manualOpen && (
        <ManualDialog personId={person.id} onClose={() => setManualOpen(false)} onSaved={() => { setManualOpen(false); router.refresh(); }} />
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs transition",
        active ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

/* ─────────────── Informe de cobertura por red ─────────────── */

function NetworkReport({
  items,
  sources,
}: {
  items: MonitorItem[];
  sources: { fuente: string; label: string; configurado: boolean }[];
}) {
  const count = (f: string) => items.filter((i) => i.fuente === f).length;
  const connected = (k: string) => sources.find((s) => s.fuente === k)?.configurado ?? false;

  const rows: { key: string; label: string; searchable: boolean; n: number; conn: boolean; note?: string }[] = [
    { key: "noticia", label: "Noticias (Google News / NewsAPI)", searchable: true, n: count("noticia"), conn: true },
    { key: "x", label: "X / Twitter", searchable: true, n: count("x"), conn: connected("x"), note: "últimos 7 días" },
    { key: "youtube", label: "YouTube", searchable: true, n: count("youtube"), conn: connected("youtube") },
    { key: "facebook", label: "Facebook", searchable: false, n: count("facebook"), conn: false },
    { key: "instagram", label: "Instagram", searchable: false, n: count("instagram"), conn: false },
    { key: "tiktok", label: "TikTok", searchable: false, n: count("tiktok"), conn: false },
  ];

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Radar className="size-4 text-primary" /> Cobertura por red
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            let dot = "bg-slate-300";
            let status = "";
            if (!r.searchable) {
              dot = "bg-amber-400";
              status = r.n > 0 ? `${r.n} menciones · solo carga manual` : "Sin API de búsqueda · solo carga manual";
            } else if (!r.conn) {
              dot = "bg-slate-300";
              status = "No conectada";
            } else if (r.n === 0) {
              dot = "bg-slate-400";
              status = "Conectada · sin menciones";
            } else {
              dot = "bg-emerald-500";
              status = `${r.n} menciones`;
            }
            return (
              <div key={r.key} className="flex items-start gap-2 rounded-lg border p-2.5">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", dot)} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{r.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {status}{r.note ? ` · ${r.note}` : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Facebook, Instagram y TikTok no ofrecen búsqueda pública de menciones por API; se
          alimentan con el botón <strong>Mención</strong> (carga manual).
        </p>
      </CardContent>
    </Card>
  );
}

/* ─────────────── Programación automática ─────────────── */

const FREC_LABEL: Record<string, string> = {
  manual: "Manual (sin automático)",
  cada_hora: "Cada hora",
  cada_6h: "Cada 6 horas",
  cada_12h: "Cada 12 horas",
  diario: "Diario a una hora",
};

function ScheduleCard({ person }: { person: MonitorPerson }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [frec, setFrec] = useState(person.auto_frecuencia || "manual");
  const [hora, setHora] = useState(person.auto_hora ?? 8);

  function save(activo: boolean) {
    start(async () => {
      const res = await updateSchedule(person.id, { auto_activo: activo, auto_frecuencia: frec, auto_hora: hora });
      if (res.ok) { toast.success(res.message); router.refresh(); }
      else toast.error(res.message);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold">
            <CalendarClock className="size-4 text-primary" /> Automatizar recolección
          </h3>
          <Badge variant={person.auto_activo ? "success" : "muted"}>
            {person.auto_activo ? "Activa" : "Inactiva"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Consulta automáticamente todas las APIs conectadas con la frecuencia elegida y trae
          <strong> solo lo nuevo</strong>. Requiere el cron configurado en el despliegue.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Frecuencia</Label>
            <Select value={frec} onValueChange={setFrec}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(FREC_LABEL).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {frec === "diario" && (
            <div>
              <Label className="text-xs">Hora (Colombia)</Label>
              <Select value={String(hora)} onValueChange={(v) => setHora(Number(v))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }).map((_, h) => (
                    <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-end gap-2">
            <Button onClick={() => save(frec !== "manual")} disabled={pending}>
              {pending ? "Guardando…" : frec === "manual" ? "Guardar" : "Guardar y activar"}
            </Button>
            {person.auto_activo && (
              <Button variant="ghost" onClick={() => save(false)} disabled={pending}>Desactivar</Button>
            )}
          </div>
        </div>
        {person.auto_activo && (
          <p className="text-xs text-muted-foreground">
            Programada: <strong>{FREC_LABEL[person.auto_frecuencia] ?? person.auto_frecuencia}</strong>
            {person.auto_frecuencia === "diario" && ` a las ${String(person.auto_hora).padStart(2, "0")}:00`}.
            {person.ultima_recoleccion && ` Última: ${formatDate(person.ultima_recoleccion, { dateStyle: "short", timeStyle: "short" })}`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ─────────────── Línea de tiempo de recolección ─────────────── */

const RUN_LABEL: Record<string, string> = {
  noticia: "Noticias", newsapi: "NewsAPI", x: "X", youtube: "YouTube",
  facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok",
};

function SourceChip({ fuente, status }: { fuente: string; status: string }) {
  const label = RUN_LABEL[fuente] ?? fuente;
  let cls = "bg-slate-100 text-slate-600";
  let icon = <MinusCircle className="size-3" />;
  let text = "sin datos";
  if (status.startsWith("ok:")) {
    const n = parseInt(status.slice(3), 10) || 0;
    if (n > 0) { cls = "bg-emerald-100 text-emerald-800"; icon = <CheckCircle2 className="size-3" />; text = `${n} encontradas`; }
    else { cls = "bg-slate-100 text-slate-500"; text = "sin resultados"; }
  } else if (status === "no_configurado") {
    cls = "bg-slate-100 text-slate-400"; text = "no conectada";
  } else if (status.startsWith("error")) {
    cls = "bg-red-100 text-red-700"; icon = <XIcon className="size-3" />; text = "error";
  }
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", cls)}>
      {icon} {label} · {text}
    </span>
  );
}

function okCount(status: string): number {
  return status.startsWith("ok:") ? parseInt(status.slice(3), 10) || 0 : 0;
}

function CollectionTimeline({ runs }: { runs: MonitorRun[] }) {
  const [tipo, setTipo] = useState<"todos" | "reciente" | "barrido">("todos");
  const [fuente, setFuente] = useState<string>("todos");

  const fuentesPresentes = useMemo(() => {
    const s = new Set<string>();
    for (const r of runs) for (const f of Object.keys(r.resultado)) s.add(f);
    return [...s];
  }, [runs]);

  const shown = useMemo(
    () =>
      runs.filter((r) => {
        if (tipo !== "todos" && r.tipo !== tipo) return false;
        if (fuente !== "todos" && okCount(String(r.resultado[fuente] ?? "")) === 0) return false;
        return true;
      }),
    [runs, tipo, fuente],
  );

  if (runs.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 font-semibold">
        <History className="size-4" /> Actividad de recolección
      </h3>

      {/* Filtros */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <FilterChip label="Todo" active={tipo === "todos"} onClick={() => setTipo("todos")} />
        <FilterChip label="Reciente" active={tipo === "reciente"} onClick={() => setTipo("reciente")} />
        <FilterChip label="Barrido" active={tipo === "barrido"} onClick={() => setTipo("barrido")} />
        <span className="mx-1 h-4 w-px bg-border" />
        <FilterChip label="Todas las redes" active={fuente === "todos"} onClick={() => setFuente("todos")} />
        {fuentesPresentes.map((f) => (
          <FilterChip key={f} label={RUN_LABEL[f] ?? f} active={fuente === f} onClick={() => setFuente(f)} />
        ))}
      </div>

      <Card>
        <CardContent className="p-5">
          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay corridas con ese filtro.</p>
          ) : (
            <ol className="space-y-4 border-l pl-4">
              {shown.map((r) => (
                <li key={r.id} className="relative">
                  <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-primary" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {formatDate(r.created_at, { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                    <Badge variant={r.tipo === "barrido" ? "secondary" : "muted"}>
                      {r.tipo === "barrido" ? "Barrido" : "Reciente"}
                    </Badge>
                    <Badge variant={r.total > 0 ? "success" : "muted"}>{r.total} nuevas</Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {Object.entries(r.resultado).map(([f, st]) => (
                      <SourceChip key={f} fuente={f} status={String(st)} />
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function sentClasses(s: string | null): string {
  if (s === "positivo") return "bg-emerald-100 text-emerald-800";
  if (s === "negativo") return "bg-red-100 text-red-800";
  return "bg-slate-100 text-slate-700";
}
const SENT_LABEL: Record<string, string> = { positivo: "Positivo", negativo: "Negativo", neutral: "Neutral" };
const SENT_DOT: Record<string, string> = { positivo: "bg-emerald-500", negativo: "bg-red-500", neutral: "bg-slate-400" };

/* ─────────────── Línea de tiempo de menciones (por sentimiento) ─────────────── */

function MentionTimeline({
  items,
  sent,
  setSent,
  fuente = "todos",
}: {
  items: MonitorItem[];
  sent: string;
  setSent: (s: string) => void;
  fuente?: string;
}) {
  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          new Date(b.published_at ?? b.fetched_at).getTime() -
          new Date(a.published_at ?? a.fetched_at).getTime(),
      ),
    [items],
  );
  const shown = useMemo(
    () =>
      sorted.filter((i) => {
        if (fuente !== "todos" && i.fuente !== fuente) return false;
        if (sent === "todos") return true;
        if (sent === "sin") return !i.analizado_at;
        return i.sentimiento === sent;
      }),
    [sorted, sent, fuente],
  );
  const c = {
    pos: items.filter((i) => i.sentimiento === "positivo").length,
    neg: items.filter((i) => i.sentimiento === "negativo").length,
    neu: items.filter((i) => i.sentimiento === "neutral").length,
    sin: items.filter((i) => !i.analizado_at).length,
  };

  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 font-semibold">
        <History className="size-4" /> Línea de tiempo de menciones
      </h3>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <FilterChip label={`Todas (${items.length})`} active={sent === "todos"} onClick={() => setSent("todos")} />
        <FilterChip label={`Positivas (${c.pos})`} active={sent === "positivo"} onClick={() => setSent("positivo")} />
        <FilterChip label={`Negativas (${c.neg})`} active={sent === "negativo"} onClick={() => setSent("negativo")} />
        <FilterChip label={`Neutrales (${c.neu})`} active={sent === "neutral"} onClick={() => setSent("neutral")} />
        <FilterChip label={`Sin analizar (${c.sin})`} active={sent === "sin"} onClick={() => setSent("sin")} />
      </div>
      <Card>
        <CardContent className="p-5">
          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay menciones con ese filtro.</p>
          ) : (
            <ol className="space-y-3 border-l pl-4">
              {shown.slice(0, 80).map((it) => (
                <li key={it.id} className="relative">
                  <span className={cn("absolute -left-[21px] top-1.5 size-2.5 rounded-full", SENT_DOT[it.sentimiento ?? ""] ?? "bg-slate-300")} />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <time className="text-xs text-muted-foreground">
                      {formatDate(it.published_at ?? it.fetched_at, { dateStyle: "medium" })}
                    </time>
                    <Badge variant="secondary">{FUENTE_LABEL[it.fuente] ?? it.fuente}</Badge>
                    {it.analizado_at ? (
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", sentClasses(it.sentimiento))}>
                        {SENT_LABEL[it.sentimiento ?? "neutral"] ?? "Neutral"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-400">sin analizar</span>
                    )}
                    {it.es_directo && <Badge variant="success">Habla de él</Badge>}
                  </div>
                  {it.url ? (
                    <a href={it.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 block text-sm font-medium hover:underline">
                      {it.titulo}
                    </a>
                  ) : (
                    <p className="mt-0.5 text-sm font-medium">{it.titulo}</p>
                  )}
                  {it.autor && <span className="text-xs text-muted-foreground">{it.autor}</span>}
                </li>
              ))}
            </ol>
          )}
          {shown.length > 80 && (
            <p className="mt-3 text-xs text-muted-foreground">Mostrando 80 de {shown.length}.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MentionRow({
  item,
  personNombre,
  canManage,
  onRemove,
  onPatch,
}: {
  item: MonitorItem;
  personNombre: string;
  canManage: boolean;
  onRemove: (id: string) => void;
  onPatch: (id: string, patch: Partial<MonitorItem>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [analyzing, start] = useTransition();
  const analyzed = !!item.analizado_at;

  function analyze() {
    start(async () => {
      const res = await analyzeItem(item.id);
      if (res.ok && res.data) {
        onPatch(item.id, {
          resumen: res.data.resumen,
          es_directo: res.data.es_directo,
          sentimiento: res.data.sentimiento,
          etiquetas: res.data.etiquetas,
          analisis: res.data.analisis,
          analizado_at: new Date().toISOString(),
        });
        setOpen(true);
      } else toast.error(res.message);
    });
  }

  const iaPrompt =
    `Investiga y amplía sobre esta mención relacionada con ${personNombre}:\n` +
    `Titular: "${item.titulo}"\nMedio/fuente: ${item.autor ?? item.fuente}\n` +
    `${item.url ? `Enlace: ${item.url}\n` : ""}` +
    `Dame contexto, implicaciones y 3 ángulos de comunicación para una campaña de OPOSICIÓN.`;
  const iaHref = `/dashboard/ia?task=copy_politico&prompt=${encodeURIComponent(iaPrompt)}`;

  return (
    <div className="p-3">
      <div className="flex items-start gap-3">
        <Badge variant="secondary" className="mt-0.5 shrink-0">{FUENTE_LABEL[item.fuente] ?? item.fuente}</Badge>
        <div className="min-w-0 flex-1">
          {item.url ? (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
              {item.titulo} <ExternalLink className="inline size-3" />
            </a>
          ) : (
            <p className="font-medium">{item.titulo}</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {item.autor && <span>{item.autor}</span>}
            {item.autor_handle && <span>{item.autor_handle}</span>}
            {item.published_at && (
              <span className="flex items-center gap-1"><Clock className="size-3" /> {formatDate(item.published_at)}</span>
            )}
          </div>
          {analyzed && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant={item.es_directo ? "success" : "muted"}>
                {item.es_directo ? "Habla de él" : "Contexto"}
              </Badge>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", sentClasses(item.sentimiento))}>
                {SENT_LABEL[item.sentimiento ?? "neutral"] ?? "Neutral"}
              </span>
              {item.etiquetas.slice(0, 5).map((t) => (
                <Badge key={t} variant="muted">{t}</Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {canManage && !analyzed && (
            <Button size="sm" variant="ghost" onClick={analyze} disabled={analyzing} title="Analizar con IA">
              <Sparkles className="size-4" /> {analyzing ? "…" : "Analizar"}
            </Button>
          )}
          {analyzed && (
            <button
              onClick={() => setOpen((o) => !o)}
              title="Ver detalle"
              className="rounded p-1.5 text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
            </button>
          )}
          <Button asChild size="sm" variant="ghost" title="Enviar al Asistente IA">
            <Link href={iaHref}><Bot className="size-4" /></Link>
          </Button>
          {canManage && (
            <button
              aria-label="Eliminar"
              onClick={() => onRemove(item.id)}
              className="rounded p-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>

      {open && analyzed && (item.resumen || item.analisis) && (
        <div className="ml-11 mt-2 space-y-2 rounded-lg bg-muted/40 p-3 text-sm">
          {item.resumen && <p><span className="font-semibold">Resumen:</span> {item.resumen}</p>}
          {item.analisis && (
            <p className="text-muted-foreground"><span className="font-semibold text-foreground">Enfoque:</span> {item.analisis}</p>
          )}
          <Button asChild size="sm" variant="outline">
            <Link href={iaHref}><Bot className="size-4" /> Ampliar en Asistente IA</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function ManualDialog({
  personId,
  onClose,
  onSaved,
}: {
  personId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, start] = useTransition();
  const [fuente, setFuente] = useState("noticia");
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [autor, setAutor] = useState("");
  const [contenido, setContenido] = useState("");

  function save() {
    if (titulo.trim().length < 2) return toast.error("Escribe un título.");
    start(async () => {
      const res = await addManualItem({ person_id: personId, fuente, titulo, url, autor, contenido });
      if (res.ok) { toast.success(res.message); onSaved(); }
      else toast.error(res.message);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Agregar mención manual</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Fuente</Label>
            <Select value={fuente} onValueChange={setFuente}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["noticia", "x", "facebook", "instagram", "tiktok", "youtube", "web", "manual"].map((f) => (
                  <SelectItem key={f} value={f}>{FUENTE_LABEL[f] ?? f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="mi-titulo">Título *</Label>
            <Input id="mi-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="mi-url">Enlace</Label>
            <Input id="mi-url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="mi-autor">Autor / medio</Label>
            <Input id="mi-autor" value={autor} onChange={(e) => setAutor(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="mi-cont">Contenido / nota</Label>
            <Textarea id="mi-cont" rows={2} value={contenido} onChange={(e) => setContenido(e.target.value)} />
          </div>
          <Button className="w-full" onClick={save} disabled={pending}>
            {pending ? "Guardando…" : "Agregar mención"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
