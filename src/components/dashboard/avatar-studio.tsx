"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, Save, Trash2, Wand2, Mic, ImageIcon, Video, Box, Upload, Radar,
  CheckCircle2, XCircle, Loader2, Clock, Newspaper, CalendarRange, FolderUp, Link2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initials, formatDate } from "@/lib/utils";
import { uploadFileViaSignedUrl } from "@/lib/upload";
import {
  AVATAR_JOB_ESTADO_LABELS,
  type AvatarJob,
  type AvatarJobTipo,
} from "@/types/database";
import type { AvatarStudioData } from "@/actions/avatares";
import {
  updateAvatar, deleteAvatar, generatePersona, generateVoice, createGenerationJob,
  completeJob, deleteJob, attachJobToPost, scheduleJobInCalendar, attachJobToCobertura,
} from "@/actions/avatares";
import { CONTENT_CANALES } from "@/lib/validations";

const ELEVEN_MODEL_IDS: Record<string, string> = {
  "el-multi-v2": "eleven_multilingual_v2",
  "el-turbo-v25": "eleven_turbo_v2_5",
};

const ESTADO_BADGE: Record<string, "default" | "success" | "warning" | "muted" | "secondary"> = {
  listo: "success",
  procesando: "warning",
  pendiente: "muted",
  error: "secondary",
};

const TIPO_ICON: Record<AvatarJobTipo, typeof Mic> = {
  voz: Mic,
  imagen: ImageIcon,
  video: Video,
  "3d": Box,
};

export function AvatarStudio({
  data,
  coberturas,
  canManage,
}: {
  data: AvatarStudioData;
  coberturas: { id: string; nombre: string }[];
  canManage: boolean;
}) {
  const avatar = data.avatar!;
  const router = useRouter();
  const [delPending, startDel] = useTransition();

  function remove() {
    if (!confirm(`¿Eliminar el avatar “${avatar.nombre}”?`)) return;
    startDel(async () => {
      const res = await deleteAvatar(avatar.id);
      if (res.ok) {
        toast.success(res.message);
        router.push("/dashboard/comunicaciones/avatares");
      } else toast.error(res.message);
    });
  }

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link href="/dashboard/comunicaciones/avatares" className="mt-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-5" />
          </Link>
          {avatar.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar.avatar_url} alt={avatar.nombre} className="size-14 rounded-full object-cover" />
          ) : (
            <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
              {initials(avatar.nombre)}
            </span>
          )}
          <div>
            <h1 className="text-xl font-bold">{avatar.nombre}</h1>
            {avatar.arquetipo && <p className="text-sm text-muted-foreground">{avatar.arquetipo}</p>}
            <div className="mt-1 flex flex-wrap gap-1.5">
              <ConnBadge ok={data.elevenReady} label="ElevenLabs" />
              <ConnBadge ok={data.higgsReady} label="Higgsfield" />
              <ConnBadge ok={data.aiReady} label="IA" />
            </div>
          </div>
        </div>
        {canManage && (
          <Button variant="ghost" className="text-destructive" onClick={remove} disabled={delPending}>
            <Trash2 className="size-4" /> Eliminar
          </Button>
        )}
      </div>

      <Tabs defaultValue="generar">
        <TabsList>
          <TabsTrigger value="generar">Generar</TabsTrigger>
          <TabsTrigger value="trabajos">Trabajos ({data.jobs.length})</TabsTrigger>
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
        </TabsList>

        <TabsContent value="generar">
          <GenerateTab data={data} canManage={canManage} />
        </TabsContent>
        <TabsContent value="trabajos">
          <JobsTab jobs={data.jobs} avatarId={avatar.id} coberturas={coberturas} canManage={canManage} />
        </TabsContent>
        <TabsContent value="perfil">
          <ProfileTab data={data} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConnBadge({ ok, label }: { ok: boolean; label: string }) {
  return ok ? (
    <Badge variant="success" className="gap-1"><CheckCircle2 className="size-3" /> {label}</Badge>
  ) : (
    <Badge variant="muted" className="gap-1"><XCircle className="size-3" /> {label}</Badge>
  );
}

/* ───────────────── Generar ───────────────── */

function GenerateTab({ data, canManage }: { data: AvatarStudioData; canManage: boolean }) {
  const avatar = data.avatar!;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tipo, setTipo] = useState<AvatarJobTipo>("imagen");
  const [modelo, setModelo] = useState<string>(avatar.modelo_imagen || "");
  const [titulo, setTitulo] = useState("");
  const [prompt, setPrompt] = useState("");
  const [insight, setInsight] = useState<string>("");

  const models = useMemo(() => data.models.filter((m) => m.tipo === tipo), [data.models, tipo]);

  function onTipoChange(t: AvatarJobTipo) {
    setTipo(t);
    const def = t === "imagen" ? avatar.modelo_imagen : t === "video" ? avatar.modelo_video : "";
    setModelo(def || data.models.find((m) => m.tipo === t)?.clave || "");
    if (t === "imagen" && !prompt && avatar.estilo_visual) setPrompt(avatar.estilo_visual);
  }

  function insertInsight(id: string) {
    setInsight(id);
    const brief = data.insights.find((i) => i.id === id)?.brief;
    if (brief) setPrompt((p) => (p ? `${p}\n\nInsumo de monitoreo:\n${brief}` : brief));
  }

  function run() {
    if (!canManage) return;
    if (!prompt.trim()) return toast.error(tipo === "voz" ? "Escribe el texto a locutar." : "Escribe el prompt.");
    start(async () => {
      if (tipo === "voz") {
        const modelId = ELEVEN_MODEL_IDS[modelo] || undefined;
        const res = await generateVoice(avatar.id, prompt, {
          titulo: titulo || undefined,
          settings: modelId ? { model: modelId } : undefined,
        });
        if (res.ok) { toast.success(res.message); setPrompt(""); setTitulo(""); router.refresh(); }
        else toast.error(res.message);
        return;
      }
      const res = await createGenerationJob({
        avatar_id: avatar.id,
        tipo,
        modelo: modelo || undefined,
        titulo: titulo || undefined,
        prompt,
        input_refs: avatar.foto_refs ?? [],
        person_id: insight || undefined,
      });
      if (res.ok) { toast.success(res.message); setTitulo(""); router.refresh(); }
      else toast.error(res.message);
    });
  }

  const tipos: { key: AvatarJobTipo; label: string; icon: typeof Mic }[] = [
    { key: "imagen", label: "Imagen", icon: ImageIcon },
    { key: "video", label: "Video", icon: Video },
    { key: "voz", label: "Voz", icon: Mic },
    { key: "3d", label: "3D", icon: Box },
  ];

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        {!canManage && (
          <p className="text-sm text-muted-foreground">Solo el equipo de Comunicaciones puede generar contenido.</p>
        )}

        {/* Tipo */}
        <div className="flex flex-wrap gap-2">
          {tipos.map((t) => (
            <Button
              key={t.key}
              type="button"
              size="sm"
              variant={tipo === t.key ? "default" : "outline"}
              onClick={() => onTipoChange(t.key)}
            >
              <t.icon className="size-4" /> {t.label}
            </Button>
          ))}
        </div>

        {/* Estado del proveedor */}
        {tipo === "voz" && !data.elevenReady && (
          <p className="text-xs text-amber-600">
            ElevenLabs no está conectado. Conéctalo en Configuración → Integraciones para generar voz automáticamente.
          </p>
        )}
        {tipo !== "voz" && !data.higgsReady && (
          <p className="text-xs text-amber-600">
            Higgsfield no está conectado: el trabajo se creará como <b>pendiente</b> para completarlo de forma asistida.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Modelo</Label>
            <Select value={modelo} onValueChange={setModelo}>
              <SelectTrigger><SelectValue placeholder="Modelo…" /></SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.clave} value={m.clave}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="g-titulo">Título (opcional)</Label>
            <Input id="g-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nombre de la pieza" />
          </div>
        </div>

        {data.insights.length > 0 && tipo !== "voz" && (
          <div>
            <Label className="flex items-center gap-1"><Radar className="size-3.5" /> Insumo de monitoreo (opcional)</Label>
            <Select value={insight} onValueChange={insertInsight}>
              <SelectTrigger><SelectValue placeholder="Usar brief de una persona monitoreada…" /></SelectTrigger>
              <SelectContent>
                {data.insights.map((i) => (
                  <SelectItem key={i.id} value={i.id} disabled={!i.brief}>
                    {i.nombre}{!i.brief ? " (sin análisis)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <Label htmlFor="g-prompt">{tipo === "voz" ? "Texto a locutar" : "Prompt"}</Label>
          <Textarea
            id="g-prompt"
            rows={tipo === "voz" ? 5 : 4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              tipo === "voz"
                ? "Escribe el guion que dirá el avatar…"
                : "Describe la escena/pieza. Se combinará con el estilo visual del avatar."
            }
          />
        </div>

        <Button onClick={run} disabled={pending || !canManage}>
          <Wand2 className="size-4" /> {pending ? "Generando…" : `Generar ${tipo}`}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ───────────────── Trabajos ───────────────── */

function JobsTab({
  jobs, avatarId, coberturas, canManage,
}: {
  jobs: AvatarJob[];
  avatarId: string;
  coberturas: { id: string; nombre: string }[];
  canManage: boolean;
}) {
  if (jobs.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
          <Wand2 className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Aún no hay generaciones. Ve a la pestaña “Generar”.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {jobs.map((j) => (
        <JobCard key={j.id} job={j} avatarId={avatarId} coberturas={coberturas} canManage={canManage} />
      ))}
    </div>
  );
}

function JobCard({
  job, avatarId, coberturas, canManage,
}: {
  job: AvatarJob;
  avatarId: string;
  coberturas: { id: string; nombre: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [attach, setAttach] = useState<null | "post" | "calendar" | "cobertura">(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const Icon = TIPO_ICON[job.tipo] ?? Wand2;

  function remove() {
    if (!confirm("¿Eliminar este trabajo?")) return;
    start(async () => {
      const res = await deleteJob(job.id, avatarId);
      if (res.ok) { toast.success(res.message); router.refresh(); } else toast.error(res.message);
    });
  }

  function pasteUrl() {
    const url = window.prompt("Pega la URL del asset generado (imagen/video/audio):");
    if (!url) return;
    start(async () => {
      const res = await completeJob(job.id, avatarId, url);
      if (res.ok) { toast.success(res.message); router.refresh(); } else toast.error(res.message);
    });
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    start(async () => {
      const up = await uploadFileViaSignedUrl("avatars", `${avatarId}/${job.tipo}`, file);
      if (!up.ok || !up.url) { toast.error(up.message || "No se pudo subir."); return; }
      const res = await completeJob(job.id, avatarId, up.url, { mime: file.type, size: file.size });
      if (res.ok) { toast.success("Asset subido y trabajo listo."); router.refresh(); } else toast.error(res.message);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Icon className="size-4 text-muted-foreground" />
            {job.titulo || AVATAR_JOB_ESTADO_LABELS[job.estado] + " · " + job.tipo}
          </span>
          <Badge variant={ESTADO_BADGE[job.estado] ?? "muted"} className="gap-1">
            {job.estado === "procesando" && <Loader2 className="size-3 animate-spin" />}
            {AVATAR_JOB_ESTADO_LABELS[job.estado]}
          </Badge>
        </div>

        {/* Preview */}
        {job.output_url && job.estado === "listo" && (
          <div className="overflow-hidden rounded-lg border bg-muted/30">
            {job.tipo === "imagen" || job.tipo === "3d" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={job.output_url} alt={job.titulo ?? ""} className="max-h-56 w-full object-contain" />
            ) : job.tipo === "video" ? (
              <video src={job.output_url} controls className="max-h-56 w-full" />
            ) : (
              <audio src={job.output_url} controls className="w-full p-2" />
            )}
          </div>
        )}

        {job.prompt && <p className="line-clamp-2 text-xs text-muted-foreground">{job.prompt}</p>}
        {job.error_msg && <p className="text-xs text-amber-600">{job.error_msg}</p>}
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3" /> {formatDate(job.created_at, { dateStyle: "short", timeStyle: "short" })}
          {job.modelo && ` · ${job.modelo}`}
        </p>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            {job.estado !== "listo" && (
              <>
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={pending}>
                  <Upload className="size-4" /> Subir asset
                </Button>
                <Button size="sm" variant="ghost" onClick={pasteUrl} disabled={pending}>
                  <Link2 className="size-4" /> Pegar URL
                </Button>
                <input ref={fileRef} type="file" hidden accept="image/*,video/*,audio/*" onChange={onFile} />
              </>
            )}
            {job.estado === "listo" && (
              <>
                <Button size="sm" variant="outline" onClick={() => setAttach("post")} disabled={pending}>
                  <Newspaper className="size-4" /> Publicación
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAttach("calendar")} disabled={pending}>
                  <CalendarRange className="size-4" /> Calendario
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAttach("cobertura")} disabled={pending}>
                  <FolderUp className="size-4" /> Cobertura
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" className="text-destructive" onClick={remove} disabled={pending}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}
      </CardContent>

      {attach && (
        <AttachDialog kind={attach} job={job} coberturas={coberturas} onClose={() => setAttach(null)} />
      )}
    </Card>
  );
}

function AttachDialog({
  kind, job, coberturas, onClose,
}: {
  kind: "post" | "calendar" | "cobertura";
  job: AvatarJob;
  coberturas: { id: string; nombre: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [titulo, setTitulo] = useState(job.titulo ?? "");
  const [canal, setCanal] = useState<string>(CONTENT_CANALES[0]);
  const [fecha, setFecha] = useState("");
  const [coberturaId, setCoberturaId] = useState(coberturas[0]?.id ?? "");
  const [fase, setFase] = useState<"crudo" | "editado" | "aprobado">("editado");

  function submit() {
    start(async () => {
      let res;
      if (kind === "post") res = await attachJobToPost(job.id, { titulo });
      else if (kind === "calendar") res = await scheduleJobInCalendar(job.id, { titulo, canal, fecha_programada: fecha });
      else res = await attachJobToCobertura(job.id, coberturaId, fase);
      if (res.ok) { toast.success(res.message); onClose(); router.refresh(); } else toast.error(res.message);
    });
  }

  const title =
    kind === "post" ? "Adjuntar a una publicación"
      : kind === "calendar" ? "Programar en el calendario"
        : "Subir a una cobertura (Drive)";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {(kind === "post" || kind === "calendar") && (
            <div>
              <Label htmlFor="at-titulo">Título</Label>
              <Input id="at-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
          )}
          {kind === "post" && (
            <p className="text-xs text-muted-foreground">
              Se creará una publicación en <b>borrador</b> con este asset como imagen.
            </p>
          )}
          {kind === "calendar" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Canal</Label>
                <Select value={canal} onValueChange={setCanal}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTENT_CANALES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="at-fecha">Fecha</Label>
                <Input id="at-fecha" type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
            </div>
          )}
          {kind === "cobertura" && (
            coberturas.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay coberturas. Crea una en Comunicaciones → Coberturas.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cobertura</Label>
                  <Select value={coberturaId} onValueChange={setCoberturaId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {coberturas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fase</Label>
                  <Select value={fase} onValueChange={(v) => setFase(v as typeof fase)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="crudo">Contenido Crudo</SelectItem>
                      <SelectItem value="editado">Contenido Editado</SelectItem>
                      <SelectItem value="aprobado">Contenido Aprobado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )
          )}
          <Button
            className="w-full"
            onClick={submit}
            disabled={pending || (kind === "cobertura" && coberturas.length === 0)}
          >
            {pending ? "Aplicando…" : "Confirmar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────── Perfil (edición) ───────────────── */

function ProfileTab({ data, canManage }: { data: AvatarStudioData; canManage: boolean }) {
  const avatar = data.avatar!;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [genPending, startGen] = useTransition();
  const [upPending, startUp] = useTransition();
  const portraitRef = useRef<HTMLInputElement>(null);

  const [personalidad, setPersonalidad] = useState(avatar.personalidad ?? "");
  const [tono, setTono] = useState(avatar.tono ?? "");
  const [valores, setValores] = useState(avatar.valores.join(", "));
  const [estiloVisual, setEstiloVisual] = useState(avatar.estilo_visual ?? "");
  const [arquetipo, setArquetipo] = useState(avatar.arquetipo ?? "");
  const [descripcion, setDescripcion] = useState(avatar.descripcion ?? "");
  const [voiceId, setVoiceId] = useState(avatar.voice_id ?? "");
  const [modeloImagen, setModeloImagen] = useState(avatar.modelo_imagen ?? "");
  const [modeloVideo, setModeloVideo] = useState(avatar.modelo_video ?? "");

  const imgModels = data.models.filter((m) => m.tipo === "imagen");
  const vidModels = data.models.filter((m) => m.tipo === "video");

  function save() {
    start(async () => {
      const voice = data.voices.find((v) => v.voice_id === voiceId);
      const res = await updateAvatar(avatar.id, {
        arquetipo, descripcion, personalidad, tono,
        valores: valores.split(",").map((s) => s.trim()).filter(Boolean),
        estilo_visual: estiloVisual,
        voice_id: voiceId,
        voice_name: voice?.name ?? "",
        modelo_imagen: modeloImagen,
        modelo_video: modeloVideo,
      });
      if (res.ok) { toast.success(res.message); router.refresh(); } else toast.error(res.message);
    });
  }

  function autofill() {
    startGen(async () => {
      const res = await generatePersona({ nombre: avatar.nombre, arquetipo, brief: descripcion });
      if (res.ok && res.data) {
        setPersonalidad(res.data.personalidad);
        setTono(res.data.tono);
        setValores(res.data.valores.join(", "));
        setEstiloVisual(res.data.estilo_visual);
        toast.success(res.message);
      } else toast.error(res.message);
    });
  }

  function onPortrait(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    startUp(async () => {
      const up = await uploadFileViaSignedUrl("avatars", `${avatar.id}/retrato`, file);
      if (!up.ok || !up.url) { toast.error(up.message || "No se pudo subir."); return; }
      const res = await updateAvatar(avatar.id, { avatar_url: up.url });
      if (res.ok) { toast.success("Retrato actualizado."); router.refresh(); } else toast.error(res.message);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-4">
          {avatar.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar.avatar_url} alt={avatar.nombre} className="size-16 rounded-full object-cover" />
          ) : (
            <span className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
              {initials(avatar.nombre)}
            </span>
          )}
          {canManage && (
            <div>
              <Button size="sm" variant="outline" onClick={() => portraitRef.current?.click()} disabled={upPending}>
                <Upload className="size-4" /> {upPending ? "Subiendo…" : "Cambiar retrato"}
              </Button>
              <input ref={portraitRef} type="file" hidden accept="image/*" onChange={onPortrait} />
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="p-arq">Arquetipo</Label>
            <Input id="p-arq" value={arquetipo} onChange={(e) => setArquetipo(e.target.value)} disabled={!canManage} />
          </div>
          <div>
            <Label htmlFor="p-desc">Descripción corta</Label>
            <Input id="p-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} disabled={!canManage} />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Personalidad</p>
          {canManage && (
            <Button size="sm" variant="outline" onClick={autofill} disabled={genPending || !data.aiReady}>
              <Wand2 className="size-4" /> {genPending ? "Generando…" : "Autogenerar"}
            </Button>
          )}
        </div>
        <Textarea rows={3} value={personalidad} onChange={(e) => setPersonalidad(e.target.value)} disabled={!canManage} />

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="p-tono">Tono</Label>
            <Input id="p-tono" value={tono} onChange={(e) => setTono(e.target.value)} disabled={!canManage} />
          </div>
          <div>
            <Label htmlFor="p-val">Valores (coma)</Label>
            <Input id="p-val" value={valores} onChange={(e) => setValores(e.target.value)} disabled={!canManage} />
          </div>
        </div>

        <div>
          <Label htmlFor="p-vis">Estilo visual (para prompts de imagen)</Label>
          <Textarea id="p-vis" rows={2} value={estiloVisual} onChange={(e) => setEstiloVisual(e.target.value)} disabled={!canManage} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="flex items-center gap-1"><Mic className="size-3.5" /> Voz (ElevenLabs)</Label>
            {data.voices.length > 0 ? (
              <Select value={voiceId} onValueChange={setVoiceId} disabled={!canManage}>
                <SelectTrigger><SelectValue placeholder="Elegir voz…" /></SelectTrigger>
                <SelectContent>
                  {data.voices.map((v) => <SelectItem key={v.voice_id} value={v.voice_id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input value={voiceId} onChange={(e) => setVoiceId(e.target.value)} placeholder="voice_id" disabled={!canManage} />
            )}
          </div>
          <div>
            <Label>Modelo de imagen</Label>
            <Select value={modeloImagen} onValueChange={setModeloImagen} disabled={!canManage}>
              <SelectTrigger><SelectValue placeholder="Modelo…" /></SelectTrigger>
              <SelectContent>
                {imgModels.map((m) => <SelectItem key={m.clave} value={m.clave}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Modelo de video</Label>
            <Select value={modeloVideo} onValueChange={setModeloVideo} disabled={!canManage}>
              <SelectTrigger><SelectValue placeholder="Modelo…" /></SelectTrigger>
              <SelectContent>
                {vidModels.map((m) => <SelectItem key={m.clave} value={m.clave}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!data.elevenReady && (
          <p className="text-xs text-amber-600">
            Conecta ElevenLabs en Configuración → Integraciones para elegir voces de tu cuenta.
          </p>
        )}

        {canManage && (
          <Button onClick={save} disabled={pending}>
            <Save className="size-4" /> {pending ? "Guardando…" : "Guardar perfil"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
