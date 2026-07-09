"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, Trash2, Save, Sparkles, Search, Wand2, Image as ImageIcon, Video, Star,
  RefreshCw, TrendingUp, Loader2, ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Markdown } from "@/components/ui/markdown";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import {
  VIDEO_FASES, VIDEO_FASE_LABELS, type VideoProject, type VideoResearchNote,
  type VideoGeneration, type VideoViralityAnalysis,
} from "@/types/database";
import { VIDEO_PLATAFORMAS } from "@/lib/validations";
import {
  updateProject, setProjectFase, deleteProject, generateContent, runResearch, deleteResearch,
  submitVisual, checkVisual, setPortada, deleteGeneration, analyzeVirality, deleteVirality,
  type TextKind,
} from "@/actions/produccion";

type Status = { ai: boolean; aiProvider: string; higgsfield: boolean; search: boolean };

/** Muestra un toast según el resultado de una acción. */
function notify(res: { ok: boolean; message: string }) {
  if (res.ok) toast.success(res.message);
  else toast.error(res.message);
}

export function ProduccionProject({
  project, research, generations, virality, status,
}: {
  project: VideoProject;
  research: VideoResearchNote[];
  generations: VideoGeneration[];
  virality: VideoViralityAnalysis[];
  status: Status;
}) {
  const router = useRouter();
  const [, start] = useTransition();

  async function changeFase(fase: string) {
    const res = await setProjectFase(project.id, fase);
    notify(res);
    router.refresh();
  }

  async function remove() {
    if (!confirm("¿Eliminar este proyecto de video?")) return;
    const res = await deleteProject(project.id);
    if (res.ok) { toast.success(res.message); router.push("/dashboard/comunicaciones/produccion"); }
    else toast.error(res.message);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard/comunicaciones/produccion" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Volver al tablero
        </Link>
        <div className="flex items-center gap-2">
          <Select value={project.fase} onValueChange={(v) => start(() => changeFase(v))}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {VIDEO_FASES.map((f) => (
                <SelectItem key={f} value={f}>{VIDEO_FASE_LABELS[f]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={remove}>
            <Trash2 className="size-4" /> Eliminar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="resumen">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="investigacion"><Search className="mr-1 size-4" /> Investigación</TabsTrigger>
          <TabsTrigger value="guion"><Sparkles className="mr-1 size-4" /> Guión & Copy</TabsTrigger>
          <TabsTrigger value="visual"><Wand2 className="mr-1 size-4" /> Visual</TabsTrigger>
          <TabsTrigger value="viralidad"><TrendingUp className="mr-1 size-4" /> Viralidad</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen"><ResumenTab project={project} /></TabsContent>
        <TabsContent value="investigacion"><InvestigacionTab project={project} research={research} status={status} /></TabsContent>
        <TabsContent value="guion"><GuionTab project={project} status={status} /></TabsContent>
        <TabsContent value="visual"><VisualTab project={project} generations={generations} status={status} /></TabsContent>
        <TabsContent value="viralidad"><ViralidadTab project={project} virality={virality} status={status} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ───────────────── Resumen ───────────────── */

function ResumenTab({ project }: { project: VideoProject }) {
  const router = useRouter();
  const [objetivo, setObjetivo] = useState(project.objetivo ?? "");
  const [descripcion, setDescripcion] = useState(project.descripcion ?? "");
  const [plataformas, setPlataformas] = useState<string[]>(project.plataformas);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await updateProject(project.id, { objetivo, descripcion, plataformas });
      notify(res);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardContent className="space-y-3 p-5">
          <div>
            <Label htmlFor="objetivo">Objetivo / mensaje</Label>
            <Input id="objetivo" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="descripcion">Descripción / contexto</Label>
            <Textarea id="descripcion" rows={4} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
          <div>
            <Label>Plataformas objetivo</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {VIDEO_PLATAFORMAS.map((p) => (
                <button
                  type="button" key={p}
                  onClick={() => setPlataformas((c) => (c.includes(p) ? c.filter((x) => x !== p) : [...c, p]))}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    plataformas.includes(p) ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted"
                  }`}
                >{p}</button>
              ))}
            </div>
          </div>
          <Button onClick={save} disabled={pending}><Save className="size-4" /> {pending ? "Guardando…" : "Guardar"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <Label>Portada</Label>
          {project.portada_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.portada_url} alt="Portada" className="w-full rounded-lg border object-cover" />
          ) : (
            <p className="text-sm text-muted-foreground">Sin portada. Genera una en la pestaña <strong>Visual</strong> y fíjala.</p>
          )}
          <div className="text-xs text-muted-foreground">Creado {formatDate(project.created_at)}</div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────────────── Investigación ───────────────── */

function InvestigacionTab({
  project, research, status,
}: { project: VideoProject; research: VideoResearchNote[]; status: Status }) {
  const router = useRouter();
  const [tema, setTema] = useState(project.objetivo ?? "");
  const [pending, start] = useTransition();

  function investigar() {
    if (!tema.trim()) { toast.error("Escribe un tema."); return; }
    start(async () => {
      const res = await runResearch(project.id, tema);
      notify(res);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Search className="size-4" />
            {status.search ? "Búsqueda web conectada + síntesis con IA." : "Sin búsqueda web: la IA usa conocimiento general (marca lo que verificar)."}
          </div>
          <div className="flex gap-2">
            <Input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Tema a investigar (ej. inseguridad en TransMilenio)" />
            <Button onClick={investigar} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Investigar
            </Button>
          </div>
        </CardContent>
      </Card>

      {research.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay investigaciones. Lanza la primera arriba.</p>
      ) : (
        research.map((r) => (
          <Card key={r.id}>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.tema}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(r.created_at)} · {r.fuente_ia ?? "—"}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={async () => { const res = await deleteResearch(r.id, project.id); notify(res); router.refresh(); }}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {r.contenido && <div className="rounded-lg bg-muted p-4 text-sm"><Markdown content={r.contenido} /></div>}
              {r.fuentes?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Fuentes</p>
                  {r.fuentes.map((f, i) => (
                    <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <ExternalLink className="size-3" /> {f.title}
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

/* ───────────────── Guión & Copy ───────────────── */

const TEXT_TOOLS: { kind: TextKind; label: string; field?: keyof VideoProject }[] = [
  { kind: "ideas", label: "Ideas / ángulos" },
  { kind: "guion", label: "Guión", field: "guion" },
  { kind: "copy", label: "Copy para redes", field: "copy_text" },
  { kind: "descripcion", label: "Descripción del video", field: "descripcion_video" },
  { kind: "titulos", label: "Títulos", field: "titulos" },
  { kind: "hashtags", label: "Hashtags", field: "hashtags" },
];

function GuionTab({ project, status }: { project: VideoProject; status: Status }) {
  const router = useRouter();
  const [tool, setTool] = useState<TextKind>("guion");
  const [input, setInput] = useState(
    [project.objetivo, project.descripcion].filter(Boolean).join("\n") || "",
  );
  const [output, setOutput] = useState("");
  const [fuente, setFuente] = useState("");
  const [pending, start] = useTransition();

  const current = TEXT_TOOLS.find((t) => t.kind === tool)!;

  function generar() {
    if (!input.trim()) { toast.error("Escribe el tema o contexto."); return; }
    start(async () => {
      const res = await generateContent(project.id, tool, input);
      if (res.ok && res.data) { setOutput(res.data.output); setFuente(res.data.fuente); }
      else toast.error(res.message);
    });
  }

  function guardar() {
    if (!current.field || !output.trim()) return;
    const field = current.field;
    const value =
      field === "titulos" ? output.split("\n").map((s) => s.trim()).filter(Boolean)
      : field === "hashtags" ? output.split(/\s+/).map((s) => s.trim()).filter(Boolean)
      : output;
    start(async () => {
      const res = await updateProject(project.id, { [field]: value } as Record<string, unknown>);
      if (res.ok) toast.success("Guardado en el proyecto."); else toast.error(res.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="size-4" /> {status.ai ? `IA de texto: ${status.aiProvider}` : "Modo mock (conecta una clave de IA)"}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TEXT_TOOLS.map((t) => (
                <button key={t.kind} type="button" onClick={() => setTool(t.kind)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${tool === t.kind ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <Textarea rows={7} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Tema, objetivo o contexto…" />
            <Button onClick={generar} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Generar {current.label.toLowerCase()}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <Label>Borrador</Label>
              {fuente && <Badge variant="muted">{fuente}</Badge>}
            </div>
            <div className="min-h-[220px] rounded-lg bg-muted p-4 text-sm">
              {output ? <Markdown content={output} /> : <span className="text-muted-foreground">El borrador aparecerá aquí…</span>}
            </div>
            {current.field && (
              <Button variant="outline" onClick={guardar} disabled={!output.trim() || pending}>
                <Save className="size-4" /> Guardar como {current.label.toLowerCase()}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Artefactos guardados */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SavedField label="Guión" value={project.guion} />
        <SavedField label="Copy" value={project.copy_text} />
        <SavedField label="Descripción del video" value={project.descripcion_video} />
        <SavedField label="Títulos" value={project.titulos.join("\n")} />
        <SavedField label="Hashtags" value={project.hashtags.join(" ")} />
      </div>
    </div>
  );
}

function SavedField({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <Card>
      <CardContent className="space-y-1.5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="whitespace-pre-wrap text-sm">{value}</p>
      </CardContent>
    </Card>
  );
}

/* ───────────────── Visual (Higgsfield) ───────────────── */

function VisualTab({
  project, generations, status,
}: { project: VideoProject; generations: VideoGeneration[]; status: Status }) {
  const router = useRouter();
  const [kind, setKind] = useState<"imagen" | "video">("imagen");
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [pending, start] = useTransition();
  const polling = useRef(false);

  // Sondeo automático de generaciones en proceso (Higgsfield).
  useEffect(() => {
    const inProgress = generations.filter((g) => g.status === "processing" && g.provider === "higgsfield");
    if (inProgress.length === 0 || polling.current) return;
    polling.current = true;
    const timer = setInterval(async () => {
      let anyDone = false;
      for (const g of inProgress) {
        const res = await checkVisual(g.id);
        if (res.ok && res.data && (res.data.status === "completed" || res.data.status === "failed")) anyDone = true;
      }
      if (anyDone) { clearInterval(timer); polling.current = false; router.refresh(); }
    }, 5000);
    return () => { clearInterval(timer); polling.current = false; };
  }, [generations, router]);

  function generar() {
    if (!prompt.trim()) { toast.error("Escribe el prompt."); return; }
    start(async () => {
      const res = await submitVisual({
        projectId: project.id, kind, prompt,
        imageUrl: kind === "video" && imageUrl ? imageUrl : undefined,
      });
      if (res.ok) { toast.success(res.message); setPrompt(""); router.refresh(); }
      else toast.error(res.message);
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wand2 className="size-4" /> {status.higgsfield ? "Higgsfield conectado." : "Modo mock (conecta HIGGSFIELD_API_KEY para generación real)."}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setKind("imagen")}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${kind === "imagen" ? "border-primary bg-primary/10 text-primary" : "border-input"}`}>
              <ImageIcon className="size-4" /> Imagen / portada
            </button>
            <button type="button" onClick={() => setKind("video")}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${kind === "video" ? "border-primary bg-primary/10 text-primary" : "border-input"}`}>
              <Video className="size-4" /> Video / clip
            </button>
          </div>
          <Textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe la imagen o el clip que quieres generar…" />
          {kind === "video" && (
            <div>
              <Label htmlFor="imageUrl">Imagen base (opcional, para imagen→video)</Label>
              <Input id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://… (URL de una imagen)" />
            </div>
          )}
          <Button onClick={generar} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} Generar {kind}
          </Button>
        </CardContent>
      </Card>

      {generations.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay generaciones.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {generations.map((g) => (
            <Card key={g.id} className={g.is_portada ? "ring-2 ring-primary" : ""}>
              <CardContent className="space-y-2 p-3">
                <div className="flex items-center justify-between">
                  <Badge variant="muted">{g.kind}</Badge>
                  <StatusBadge status={g.status} />
                </div>
                <div className="aspect-[3/4] overflow-hidden rounded-lg bg-muted">
                  {g.status === "completed" && g.result_url ? (
                    g.kind === "video" && !g.result_url.startsWith("data:") ? (
                      <video src={g.result_url} controls className="h-full w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.result_url} alt={g.prompt} className="h-full w-full object-cover" />
                    )
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      {g.status === "processing" ? <Loader2 className="size-5 animate-spin" /> : g.status === "failed" ? "Falló" : "…"}
                    </div>
                  )}
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{g.prompt}</p>
                <div className="flex items-center gap-1">
                  {g.status === "processing" && g.provider === "higgsfield" && (
                    <Button variant="ghost" size="icon" onClick={async () => { const res = await checkVisual(g.id); if (res.ok) toast.success("Actualizado."); else toast.error(res.message); router.refresh(); }}>
                      <RefreshCw className="size-4" />
                    </Button>
                  )}
                  {g.status === "completed" && g.kind === "imagen" && (
                    <Button variant="ghost" size="icon" title="Fijar como portada" onClick={async () => { const res = await setPortada(g.id, project.id); notify(res); router.refresh(); }}>
                      <Star className={`size-4 ${g.is_portada ? "fill-primary text-primary" : ""}`} />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="ml-auto" onClick={async () => { const res = await deleteGeneration(g.id, project.id); notify(res); router.refresh(); }}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-700",
    processing: "bg-amber-100 text-amber-700",
    failed: "bg-red-100 text-red-700",
    pending: "bg-muted text-muted-foreground",
  };
  const label: Record<string, string> = { completed: "Listo", processing: "Procesando", failed: "Falló", pending: "En cola" };
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${map[status] ?? map.pending}`}>{label[status] ?? status}</span>;
}

/* ───────────────── Viralidad ───────────────── */

const VIRAL_TARGETS = [
  { value: "idea", label: "Idea" },
  { value: "guion", label: "Guión" },
  { value: "portada", label: "Portada" },
  { value: "video", label: "Video (URL)" },
];

function ViralidadTab({
  project, virality, status,
}: { project: VideoProject; virality: VideoViralityAnalysis[]; status: Status }) {
  const router = useRouter();
  const [target, setTarget] = useState("idea");
  const [content, setContent] = useState("");
  const [pending, start] = useTransition();

  function seed(t: string) {
    setTarget(t);
    if (t === "guion") setContent(project.guion ?? "");
    else if (t === "portada") setContent(project.portada_url ?? "");
    else if (t === "idea") setContent([project.objetivo, project.descripcion].filter(Boolean).join("\n"));
    else setContent("");
  }

  function analizar() {
    if (!content.trim()) { toast.error("Aporta el contenido a analizar."); return; }
    start(async () => {
      const res = await analyzeVirality({ projectId: project.id, target, content });
      notify(res);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4" /> {status.ai ? `Análisis con IA: ${status.aiProvider}` : "Modo mock (conecta una clave de IA)."}
            </div>
            <p className="pl-6">
              {status.higgsfield
                ? "Video (URL): usa el predictor NATIVO de Higgsfield (Hook Score, Hold Rate, Viral Score) + recomendaciones de IA."
                : "Con HIGGSFIELD_API_KEY, los videos por URL usan el predictor nativo de Higgsfield."}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {VIRAL_TARGETS.map((t) => (
              <button key={t.value} type="button" onClick={() => seed(t.value)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${target === t.value ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <Textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Pega el guión, la idea, o la URL del video/portada…" />
          <Button onClick={analizar} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <TrendingUp className="size-4" />} Analizar viralidad
          </Button>
        </CardContent>
      </Card>

      {virality.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay análisis.</p>
      ) : (
        virality.map((a) => (
          <Card key={a.id}>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ScoreRing score={a.score} />
                  <div>
                    <p className="font-semibold">{a.veredicto ?? "Análisis"}</p>
                    <p className="text-xs text-muted-foreground">{a.target} · {formatDate(a.created_at)} · {a.fuente ?? "—"}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={async () => { const res = await deleteVirality(a.id, project.id); notify(res); router.refresh(); }}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <NativeMetrics raw={a.raw} />
              <div className="grid gap-3 sm:grid-cols-3">
                <ViralList title="Fortalezas" items={a.fortalezas} tone="text-emerald-700" />
                <ViralList title="Riesgos" items={a.riesgos} tone="text-red-700" />
                <ViralList title="Recomendaciones" items={a.recomendaciones} tone="text-primary" />
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function ScoreRing({ score }: { score: number | null }) {
  const s = score ?? 0;
  const tone = s >= 70 ? "text-emerald-600" : s >= 45 ? "text-amber-600" : "text-red-600";
  return (
    <div className={`flex size-14 shrink-0 flex-col items-center justify-center rounded-full border-4 ${tone} border-current`}>
      <span className="text-lg font-bold leading-none">{score ?? "—"}</span>
      <span className="text-[9px] text-muted-foreground">/100</span>
    </div>
  );
}

function NativeMetrics({ raw }: { raw: Record<string, unknown> }) {
  const metricas = (raw?.metricas ?? null) as { hook_score?: number | null; hold_rate?: number | null } | null;
  const heatmap = typeof raw?.heatmap_url === "string" ? (raw.heatmap_url as string) : null;
  const hook = metricas?.hook_score;
  const hold = metricas?.hold_rate;
  if ((hook == null && hold == null && !heatmap)) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hook != null && <Metric label="Hook Score" value={`${hook}/100`} />}
      {hold != null && <Metric label="Hold Rate" value={`${hold}%`} />}
      {heatmap && (
        <a href={heatmap} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-primary hover:bg-muted">
          <ExternalLink className="size-3" /> Brain heatmap
        </a>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

function ViralList({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div>
      <p className={`text-xs font-semibold ${tone}`}>{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs">
              <span className="mt-1 size-1 shrink-0 rounded-full bg-current opacity-60" /> {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
