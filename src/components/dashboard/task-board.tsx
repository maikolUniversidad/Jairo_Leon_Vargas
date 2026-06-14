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
  getTaskDetail,
} from "@/actions/tareas";

const COLUMNS: TaskStatus[] = [
  "pendiente",
  "en_proceso",
  "bloqueada",
  "en_revision",
  "aprobada",
  "finalizada",
  "cancelada",
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
  tasks: initial,
  profiles,
}: {
  tasks: Task[];
  profiles: Profile[];
}) {
  const [tasks, setTasks] = useState<Task[]>(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);
  const [selected, setSelected] = useState<Task | null>(null);
  const [, start] = useTransition();

  useEffect(() => setTasks(initial), [initial]);

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
    for (const t of tasks) map[t.estado]?.push(t);
    return map;
  }, [tasks]);

  const move = (id: string, estado: TaskStatus) => {
    const task = tasks.find((t) => t.id === id);
    if (!task || task.estado === estado) return;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, estado } : t)));
    start(async () => {
      const res = await updateTaskStatus(id, estado);
      if (res.ok) toast.success(`→ ${TASK_STATUS_LABELS[estado]}`);
      else {
        toast.error(res.message);
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, estado: task.estado } : t)));
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
              setDragId(null);
              setOverCol(null);
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
              {byColumn[col].map((t) => (
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
                  {t.descripcion && (
                    <p className="mt-1 line-clamp-2 pl-5 text-xs text-muted-foreground">{t.descripcion}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-5">
                    <PriorityBadge priority={t.prioridad} />
                    {t.contexto_operativo === "campana" && (
                      <Badge variant="warning">Campaña</Badge>
                    )}
                    {t.fecha_limite && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarClock className="size-3" />
                        {formatDate(t.fecha_limite)}
                      </span>
                    )}
                  </div>
                  {t.responsable_id && (
                    <p className="mt-1.5 pl-5 text-xs text-muted-foreground">
                      {nameById.get(t.responsable_id) ?? "Asignada"}
                    </p>
                  )}
                </article>
              ))}
              {byColumn[col].length === 0 && (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground/60">
                  Arrastra tareas aquí
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <TaskDetailDialog task={selected} nameById={nameById} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function TaskDetailDialog({
  task,
  nameById,
  onClose,
}: {
  task: Task;
  nameById: Map<string, string>;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [checklist, setChecklist] = useState<TaskChecklistItem[]>([]);
  const [comment, setComment] = useState("");
  const [item, setItem] = useState("");

  const load = () => {
    getTaskDetail(task.id).then((d) => {
      setHistory(d.history as TaskHistory[]);
      setComments(d.comments as TaskComment[]);
      setChecklist(d.checklist as TaskChecklistItem[]);
    });
  };
  useEffect(load, [task.id]);

  const done = checklist.filter((c) => c.completado).length;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task.titulo}</DialogTitle>
        </DialogHeader>

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

        {/* Checklist */}
        <h4 className="mt-2 flex items-center gap-2 text-sm font-semibold">
          <CheckSquare className="size-4" /> Checklist {checklist.length > 0 && `(${done}/${checklist.length})`}
        </h4>
        <ul className="space-y-1">
          {checklist.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={c.completado}
                onChange={(e) =>
                  start(async () => {
                    setChecklist((prev) =>
                      prev.map((x) => (x.id === c.id ? { ...x, completado: e.target.checked } : x)),
                    );
                    await toggleChecklistItem(c.id, e.target.checked);
                  })
                }
              />
              <span className={c.completado ? "text-muted-foreground line-through" : ""}>{c.texto}</span>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input
            placeholder="Nuevo ítem…"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && item.trim()) {
                start(async () => {
                  const res = await addChecklistItem({ task_id: task.id, texto: item });
                  if (res.ok) { setItem(""); load(); } else toast.error(res.message);
                });
              }
            }}
          />
        </div>

        {/* Comentarios */}
        <h4 className="mt-2 flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="size-4" /> Comentarios
        </h4>
        <div className="flex gap-2">
          <Input
            placeholder="Escribe un comentario…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && comment.trim()) {
                start(async () => {
                  const res = await addTaskComment({ task_id: task.id, comentario: comment });
                  if (res.ok) { setComment(""); load(); } else toast.error(res.message);
                });
              }
            }}
          />
        </div>
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
