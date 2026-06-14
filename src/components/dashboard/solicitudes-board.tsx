"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { Search, History, Clock, Phone, MapPin, User2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RequestStatusBadge,
  PriorityBadge,
  SemaforoBadge,
  CategoriaBadge,
} from "@/lib/status";
import { formatDate } from "@/lib/utils";
import {
  REQUEST_STATUS_LABELS,
  type CitizenRequest,
  type Profile,
  type RequestHistory,
} from "@/types/database";
import { REQUEST_CATEGORY_LABELS } from "@/lib/validations";
import {
  updateRequest,
  addRequestNote,
  getRequestHistory,
} from "@/actions/solicitudes";

const ESTADOS = Object.keys(REQUEST_STATUS_LABELS) as (keyof typeof REQUEST_STATUS_LABELS)[];
const SEMAFOROS = ["verde", "amarillo", "rojo"] as const;
const PRIORIDADES = ["baja", "media", "alta", "urgente"] as const;

function toDateInput(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function SolicitudesBoard({
  requests,
  profiles,
}: {
  requests: CitizenRequest[];
  profiles: Profile[];
}) {
  const [q, setQ] = useState("");
  const [fEstado, setFEstado] = useState<string>("todos");
  const [fCategoria, setFCategoria] = useState<string>("todas");
  const [fSemaforo, setFSemaforo] = useState<string>("todos");
  const [selected, setSelected] = useState<CitizenRequest | null>(null);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(p.id, p.full_name ?? p.email ?? "—");
    return m;
  }, [profiles]);

  const categorias = useMemo(
    () => Array.from(new Set(requests.map((r) => r.tipo_solicitud))),
    [requests],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return requests.filter((r) => {
      if (fEstado !== "todos" && r.estado !== fEstado) return false;
      if (fCategoria !== "todas" && r.tipo_solicitud !== fCategoria) return false;
      if (fSemaforo !== "todos" && r.semaforo !== fSemaforo) return false;
      if (!needle) return true;
      return [r.radicado, r.asunto, r.nombre_solicitante, r.documento, r.telefono, r.localidad]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [requests, q, fEstado, fCategoria, fSemaforo]);

  return (
    <>
      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por radicado, nombre, documento, teléfono…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={fCategoria} onValueChange={setFCategoria}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las categorías</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c} value={c}>
                    {(REQUEST_CATEGORY_LABELS as Record<string, string>)[c] ?? c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fEstado} onValueChange={setFEstado}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {ESTADOS.map((e) => (
                  <SelectItem key={e} value={e}>{REQUEST_STATUS_LABELS[e]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fSemaforo} onValueChange={setFSemaforo}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todo semáforo</SelectItem>
                {SEMAFOROS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <p className="mb-2 text-xs text-muted-foreground">
        {filtered.length} de {requests.length} solicitudes
      </p>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Radicado</TableHead>
                <TableHead>Solicitante / asunto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Localidad</TableHead>
                <TableHead>Sem.</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Gestión</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(r)}
                >
                  <TableCell className="font-mono text-xs font-semibold">{r.radicado}</TableCell>
                  <TableCell className="max-w-xs">
                    <span className="font-medium">{r.nombre_solicitante ?? r.asunto}</span>
                    <span className="block truncate text-xs text-muted-foreground">{r.asunto}</span>
                  </TableCell>
                  <TableCell><CategoriaBadge categoria={r.tipo_solicitud} /></TableCell>
                  <TableCell className="text-sm">{r.localidad ?? "—"}</TableCell>
                  <TableCell><SemaforoBadge value={r.semaforo} /></TableCell>
                  <TableCell><PriorityBadge priority={r.prioridad} /></TableCell>
                  <TableCell><RequestStatusBadge status={r.estado} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(r.fecha_gestion)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selected && (
        <RequestDetailDialog
          request={selected}
          profiles={profiles}
          nameById={nameById}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function RequestDetailDialog({
  request,
  profiles,
  nameById,
  onClose,
}: {
  request: CitizenRequest;
  profiles: Profile[];
  nameById: Map<string, string>;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [history, setHistory] = useState<RequestHistory[]>([]);
  const [note, setNote] = useState("");

  // Estado editable de la gestión
  const [form, setForm] = useState({
    estado: request.estado as string,
    prioridad: request.prioridad as string,
    semaforo: request.semaforo as string,
    seguimiento: request.seguimiento,
    responsable_id: request.responsable_id ?? "",
    persona_encargada: request.persona_encargada ?? "",
    persona_recibe: request.persona_recibe ?? "",
    entidad: request.entidad ?? "",
    tramite: request.tramite ?? "",
    fecha_gestion: toDateInput(request.fecha_gestion),
    fecha_limite: toDateInput(request.fecha_limite),
    observaciones: request.observaciones ?? "",
    alerta: request.alerta ?? "",
  });

  const loadHistory = () => {
    getRequestHistory(request.id).then((h) => setHistory(h as RequestHistory[]));
  };
  useEffect(loadHistory, [request.id]);

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = () =>
    start(async () => {
      const res = await updateRequest({ id: request.id, ...form });
      if (res.ok) {
        toast.success(res.message);
        loadHistory();
      } else toast.error(res.message);
    });

  const saveNote = () =>
    start(async () => {
      if (note.trim().length < 2) return;
      const res = await addRequestNote({ request_id: request.id, descripcion: note });
      if (res.ok) {
        toast.success(res.message);
        setNote("");
        loadHistory();
      } else toast.error(res.message);
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono text-sm">{request.radicado}</span>
            <CategoriaBadge categoria={request.tipo_solicitud} />
          </DialogTitle>
        </DialogHeader>

        {/* Datos del solicitante */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <User2 className="size-4" /> {request.nombre_solicitante ?? "Sin nombre"}
          </h4>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Documento" value={request.documento} />
            <Field label="Teléfono" value={request.telefono} />
            <Field label="Correo" value={request.email} />
            <Field label="Edad" value={request.edad} />
            <Field label="EPS" value={request.eps} />
            <Field label="Diagnóstico" value={request.diagnostico} />
            <Field label="Nivel académico" value={request.nivel_academico} />
            <Field label="Perfil" value={request.perfil} />
            <Field label="Organización" value={request.organizacion} />
            <Field label="Localidad" value={request.localidad} />
            <Field label="Barrio" value={request.barrio} />
            <Field label="Dirección" value={request.direccion} />
            <Field label="Persona remite" value={request.persona_remite} />
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">Solicitud</p>
            <p className="whitespace-pre-wrap text-sm">{request.asunto}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{request.descripcion}</p>
          </div>
        </div>

        {/* Gestión */}
        <h4 className="mt-2 text-sm font-semibold">Gestión del trámite</h4>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Estado</Label>
            <Select value={form.estado} onValueChange={(v) => set("estado", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ESTADOS.map((e) => <SelectItem key={e} value={e}>{REQUEST_STATUS_LABELS[e]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Prioridad</Label>
            <Select value={form.prioridad} onValueChange={(v) => set("prioridad", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORIDADES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Semáforo</Label>
            <Select value={form.semaforo} onValueChange={(v) => set("semaforo", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEMAFOROS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Responsable (UTL)</Label>
            <Select value={form.responsable_id || "none"} onValueChange={(v) => set("responsable_id", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Persona encargada</Label>
            <Input value={form.persona_encargada} onChange={(e) => set("persona_encargada", e.target.value)} />
          </div>
          <div>
            <Label>Persona recibe</Label>
            <Input value={form.persona_recibe} onChange={(e) => set("persona_recibe", e.target.value)} />
          </div>
          <div>
            <Label>Entidad</Label>
            <Input value={form.entidad} onChange={(e) => set("entidad", e.target.value)} />
          </div>
          <div>
            <Label>Fecha de gestión</Label>
            <Input type="date" value={form.fecha_gestion} onChange={(e) => set("fecha_gestion", e.target.value)} />
          </div>
          <div>
            <Label>Fecha límite</Label>
            <Input type="date" value={form.fecha_limite} onChange={(e) => set("fecha_limite", e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Trámite / acciones</Label>
          <Textarea rows={2} value={form.tramite} onChange={(e) => set("tramite", e.target.value)} />
        </div>
        <div>
          <Label>Observaciones</Label>
          <Textarea rows={3} value={form.observaciones} onChange={(e) => set("observaciones", e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Alerta</Label>
            <Input value={form.alerta} onChange={(e) => set("alerta", e.target.value)} placeholder="Ej. Sin avance 27 días" />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={form.seguimiento}
              onChange={(e) => set("seguimiento", e.target.checked)}
            />
            Requiere seguimiento
          </label>
        </div>
        <Button onClick={save} disabled={pending}>
          {pending ? "Guardando…" : "Guardar gestión"}
        </Button>

        {/* Historial */}
        <h4 className="mt-4 flex items-center gap-2 text-sm font-semibold">
          <History className="size-4" /> Historial
        </h4>
        <div className="flex gap-2">
          <Input
            placeholder="Agregar nota al historial…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveNote()}
          />
          <Button variant="outline" onClick={saveNote} disabled={pending}>Anotar</Button>
        </div>
        <ol className="mt-1 space-y-2 border-l pl-4">
          {history.length === 0 && (
            <li className="text-sm text-muted-foreground">Sin movimientos aún.</li>
          )}
          {history.map((h) => (
            <li key={h.id} className="relative text-sm">
              <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary" />
              <p>{h.descripcion}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" />
                {formatDate(h.created_at, { dateStyle: "medium", timeStyle: "short" })}
                {h.author_id && ` · ${nameById.get(h.author_id) ?? "Equipo"}`}
              </p>
            </li>
          ))}
        </ol>

        <p className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          {request.telefono && <span className="flex items-center gap-1"><Phone className="size-3" />{request.telefono}</span>}
          {request.localidad && <span className="flex items-center gap-1"><MapPin className="size-3" />{request.localidad}</span>}
          <span>Recibida {formatDate(request.fecha_recepcion)}</span>
        </p>
      </DialogContent>
    </Dialog>
  );
}
