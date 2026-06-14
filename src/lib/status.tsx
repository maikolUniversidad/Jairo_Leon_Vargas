import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { Priority, RequestStatus, TaskStatus } from "@/types/database";

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

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <Badge variant={REQUEST_TONE[status]}>{status.replace("_", " ")}</Badge>;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge variant={TASK_TONE[status]}>{status.replace("_", " ")}</Badge>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge variant={PRIORITY_TONE[priority]}>{priority}</Badge>;
}
