import { Badge, type BadgeProps } from "@/components/ui/badge";
import type {
  Priority,
  RequestStatus,
  TaskStatus,
  Semaforo,
} from "@/types/database";
import {
  REQUEST_STATUS_LABELS,
  TASK_STATUS_LABELS,
} from "@/types/database";
import { REQUEST_CATEGORY_LABELS } from "@/lib/validations";

const REQUEST_TONE: Record<RequestStatus, BadgeProps["variant"]> = {
  recibida: "muted",
  clasificada: "secondary",
  asignada: "secondary",
  en_gestion: "warning",
  respondida: "success",
  cerrada: "success",
  archivada: "outline",
};

const TASK_TONE: Record<TaskStatus, BadgeProps["variant"]> = {
  pendiente: "muted",
  en_proceso: "warning",
  bloqueada: "danger",
  en_revision: "secondary",
  aprobada: "success",
  finalizada: "success",
  cancelada: "outline",
};

const PRIORITY_TONE: Record<Priority, BadgeProps["variant"]> = {
  baja: "muted",
  media: "secondary",
  alta: "warning",
  urgente: "danger",
};

const SEMAFORO_TONE: Record<Semaforo, BadgeProps["variant"]> = {
  verde: "success",
  amarillo: "warning",
  rojo: "danger",
};

const SEMAFORO_DOT: Record<Semaforo, string> = {
  verde: "🟢",
  amarillo: "🟡",
  rojo: "🔴",
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <Badge variant={REQUEST_TONE[status]}>{REQUEST_STATUS_LABELS[status]}</Badge>;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge variant={TASK_TONE[status]}>{TASK_STATUS_LABELS[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge variant={PRIORITY_TONE[priority]}>{priority}</Badge>;
}

export function SemaforoBadge({ value }: { value: Semaforo }) {
  return (
    <Badge variant={SEMAFORO_TONE[value]}>
      {SEMAFORO_DOT[value]} {value}
    </Badge>
  );
}

export function CategoriaBadge({ categoria }: { categoria: string }) {
  const label =
    (REQUEST_CATEGORY_LABELS as Record<string, string>)[categoria] ??
    categoria.replace(/_/g, " ");
  return <Badge variant="secondary">{label}</Badge>;
}
