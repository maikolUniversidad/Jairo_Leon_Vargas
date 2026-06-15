"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import {
  History,
  Clock,
  MessageSquare,
  CheckSquare,
  GripVertical,
  CalendarClock,
  UserCog,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { PriorityBadge } from "@/lib/status";
import { formatDate } from "@/lib/utils";
import {
  TASK_STATUS_LABELS,
  CONTEXTO_LABELS,
  type Task,
  type TaskStatus,
  type Profile,
  type TaskHistory,
  type TaskComment,
  type TaskChecklistItem,
} from "@/types/database";
import {
  updateTaskStatus,
  addTaskComment,
  addChecklistItem,
  toggleChecklistItem,
  addTaskAssignee,
  removeTaskAssignee,
  getTaskDetail,
} from "@/actions/tareas";

export interface Assignment {
  responsables: string[];
  participantes: string[];
}

const COLUMNS: TaskStatus[] = [
  "pendiente", "en_proceso", "bloqueada", "en_revision", "aprobada", "finalizada", "cancelada",
];

const COLUMN_TONE: Record<TaskStatus, string> = {
  pendiente: "border-t-slate-400",
  en_proceso: "border-t-amber-400",
  bloqueada: "border-t-red-400",
  en_revision: "border-t-blue-400",
  aprobada: "border-t-emerald-400",
  finalizada: "border-t-emerald-600",
  cancelada: "border-t-slate-300",
};

export function TaskBoard({
  tasks,
  profiles,
  assigneesByTask = {},
}: {
  tasks: Task[];
  profiles: Profile[];
  assigneesByTask?: Record<string, Assignment>;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);
  const [selected, setSelected] = useState<Task | null>(null);
  const [local, setLocal] = useState<Task[]>(tasks);
  const [, start] = useTransition();

  useEffect(() => setLocal(tasks), [tasks]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(p.id, p.full_name ?? p.email ?? "—");
    return m;
  }, [profiles]);

  const byColumn = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      pendiente: [], en_proceso: [], bloqueada: [], en_revision: [],
      aprobada: [], finalizada: [], cancelada: [],
    };
    for (const t of local) map[t.estado]?.push(t);
    return map;
  }, [local]);

  const move = (id: string, estado: TaskStatus) => {
    const task = local.find((t) => t.id === id);
    if (!task || task.estado === estado) return;
    setLocal((prev) => prev.map((t) => (t.id === id ? { ...t, estado } : t)));
    start(async () => {
      const res = await updateTaskStatus(id, estado);
      if (res.ok) toast.success(`→ ${TASK_STATUS_LABELS[estado]}`);
      else {
        toast.error(res.message);
        setLocal((prev) => prev.map((t) => (t.id === id ? { ...t, estado: task.estado } : t)));
      }
    });
  };

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <div
            key={col}
            onDragOver={(e) => { e.preventDefault(); setOverCol(col); }}
            onDragLeave={() => setOverCol((c) => (c === col ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              const id = dragId || e.dataTransfer.getData("text/plain");
              if (id) move(id, col);
              setDragId(null); setOverCol(null);
            }}
            className={`flex w-72 shrink-0 flex-col rounded-xl border border-t-4 bg-muted/30 ${COLUMN_TONE[col]} ${
              overCol === col ? "ring-2 ring-primary/40" : ""
            }`}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-sm font-semibold">{TASK_STATUS_LABELS[col]}</span>
              <Badge variant="muted">{byColumn[col].length}</Badge>
            </div>
            <div className="flex min-h-[60px] flex-1 flex-col gap-2 px-2 pb-3">
              {byColumn[col].map((t) => {
                const a = assigneesByTask[t.id];
                return (
                  <article
                    key={t.id}
                    draggable
                    onDragStart={(e) => {
                      setDragId(t.id);
                      e.dataTransfer.setData("text/plain", t.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => setSelected(t)}
                    className="group cursor-pointer rounded-lg border bg-background p-3 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex items-start gap-1.5">
                      <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground" />
                      <p className="text-sm font-medium leading-tight">{t.titulo}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-5">
                      <PriorityBadge priority={t.prioridad} />
                      {t.contexto_operativo === "campana" && <Badge variant="warning">Campaña</Badge>}
                      {t.fecha_limite && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarClock className="size-3" />{formatDate(t.fecha_limite)}
                        </span>
                      )}
                    </div>
                    {a && (a.responsables.length > 0 || a.participantes.length > 0) && (
                      <div className="mt-1.5 flex flex-wrap gap-1 pl-5">
                        {a.responsables.map((u) => (
                          <Badge key={u} variant="secondary" className="gap-1">
                            <UserCog className="size-3" />{nameById.get(u) ?? "—"}
                          </Badge>
                        ))}
                        {a.participantes.map((u) => (
                          <Badge key={u} variant="muted">{nameById.get(u) ?? "—"}</Badge>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
              {byColumn[col].length === 0 && (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground/60">Arrastra tareas aquí</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <TaskDetailDialog task={selected} profiles={profiles} nameById={nameById} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function TaskDetailDialog({
  task, profiles, nameById, onClose,
}: {
  task: Task;
  profiles: Profile[];
  nameById: Map<string, string>;
  onClose: () => void;
}) {
  const [, start] = useTransition();
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [checklist, setChecklist] = useState<TaskChecklistItem[]>([]);
  const [assignees, setAssignees] = useState<{ user_id: string; rol: string }[]>([]);
  const [comment, setComment] = useState("");
  const [item, setItem] = useState("");
  const [addPerson, setAddPerson] = useState("");
  const [addRol, setAddRol] = useState<"responsable" | "participante">("responsable");

  const load = () => {
    getTaskDetail(task.id).then((d) => {
      setHistory(d.history as TaskHistory[]);
      setComments(d.comments as TaskComment[]);
      setChecklist(d.checklist as TaskChecklistItem[]);
      setAssignees(d.assignees as { user_id: string; rol: string }[]);
    });
  };
  useEffect(load, [task.id]);

  const done = checklist.filter((c) => c.completado).length;
  const assignedIds = new Set(assignees.map((a) => a.user_id));
  const candidates = profiles.filter((p) => !assignedIds.has(p.id));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{task.titulo}</DialogTitle></DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{TASK_STATUS_LABELS[task.estado]}</Badge>
          <PriorityBadge priority={task.prioridad} />
          <Badge variant="muted">{CONTEXTO_LABELS[task.contexto_operativo]}</Badge>
          {task.fecha_limite && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarClock className="size-3" /> Vence {formatDate(task.fecha_limite)}
            </span>
          )}
        </div>

        {task.descripcion && (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{task.descripcion}</p>
        )}

        {/* Asignados */}
        <h4 className="mt-2 flex items-center gap-2 text-sm font-semibold">
          <Users className="size-4" /> Responsables y participantes
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {assignees.length === 0 && <span className="text-sm text-muted-foreground">Nadie asignado.</span>}
          {assignees.map((a) => (
            <Badge key={a.user_id} variant={a.rol === "responsable" ? "secondary" : "muted"} className="gap-1">
              {a.rol === "responsable" && <UserCog className="size-3" />}
              {nameById.get(a.user_id) ?? "—"}
              <button
                type="button"
                aria-label="Quitar"
                onClick={() =>
                  start(async () => {
                    const res = await removeTaskAssignee(task.id, a.user_id);
                    if (res.ok) load(); else toast.error(res.message);
                  })
                }
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={addPerson} onValueChange={setAddPerson}>
            <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="Agregar persona" /></SelectTrigger>
            <SelectContent>
              {candidates.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">Todos asignados</div>}
              {candidates.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name || p.email || p.id.slice(0, 8)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={addRol} onValueChange={(v) => setAddRol(v as "responsable" | "participante")}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="responsable">Responsable</SelectItem>
              <SelectItem value="participante">Participante</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            onClick={() => {
              if (!addPerson) return;
              start(async () => {
                const res = await addTaskAssignee(task.id, addPerson, addRol);
                if (res.ok) { setAddPerson(""); load(); } else toast.error(res.message);
              });
            }}
          >
            Agregar
          </Button>
        </div>

        {/* Checklist */}
        <h4 className="mt-2 flex items-center gap-2 text-sm font-semibold">
          <CheckSquare className="size-4" /> Checklist {checklist.length > 0 && `(${done}/${checklist.length})`}
        </h4>
        <ul className="space-y-1">
          {checklist.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" checked={c.completado}
                onChange={(e) =>
                  start(async () => {
                    setChecklist((prev) => prev.map((x) => (x.id === c.id ? { ...x, completado: e.target.checked } : x)));
                    await toggleChecklistItem(c.id, e.target.checked);
                  })
                }
              />
              <span className={c.completado ? "text-muted-foreground line-through" : ""}>{c.texto}</span>
            </li>
          ))}
        </ul>
        <Input
          placeholder="Nuevo ítem…" value={item} onChange={(e) => setItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && item.trim()) {
              start(async () => {
                const res = await addChecklistItem({ task_id: task.id, texto: item });
                if (res.ok) { setItem(""); load(); } else toast.error(res.message);
              });
            }
          }}
        />

        {/* Comentarios */}
        <h4 className="mt-2 flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="size-4" /> Comentarios
        </h4>
        <Input
          placeholder="Escribe un comentario…" value={comment} onChange={(e) => setComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && comment.trim()) {
              start(async () => {
                const res = await addTaskComment({ task_id: task.id, comentario: comment });
                if (res.ok) { setComment(""); load(); } else toast.error(res.message);
              });
            }
          }}
        />
        <ul className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg bg-muted/40 p-2 text-sm">
              <p>{c.comentario}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {c.author_id && `${nameById.get(c.author_id) ?? "Equipo"} · `}
                {formatDate(c.created_at, { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </li>
          ))}
        </ul>

        {/* Historial */}
        <h4 className="mt-2 flex items-center gap-2 text-sm font-semibold">
          <History className="size-4" /> Historial de estados
        </h4>
        <ol className="space-y-2 border-l pl-4">
          {history.length === 0 && <li className="text-sm text-muted-foreground">Sin movimientos.</li>}
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
      </DialogContent>
    </Dialog>
  );
}
