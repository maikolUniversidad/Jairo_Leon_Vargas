import { ListChecks } from "lucide-react";

import { PageHeader, EmptyState } from "@/components/dashboard/shared";
import { TaskCreateDialog } from "@/components/dashboard/task-create-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TaskStatusBadge, PriorityBadge } from "@/lib/status";
import { CONTEXTO_LABELS } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { Task } from "@/types/database";

async function getTasks(): Promise<Task[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    return (data as Task[]) ?? [];
  } catch {
    return [];
  }
}

export default async function TareasPage() {
  const tasks = await getTasks();

  return (
    <>
      <PageHeader
        title="Tareas y compromisos"
        description="Control del trabajo diario del equipo."
        action={<TaskCreateDialog />}
      />

      {tasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Sin tareas todavía"
          description="Crea la primera tarea con el botón “Nueva tarea”."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Contexto</TableHead>
                  <TableHead>Vence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.titulo}</TableCell>
                    <TableCell><PriorityBadge priority={t.prioridad} /></TableCell>
                    <TableCell><TaskStatusBadge status={t.estado} /></TableCell>
                    <TableCell>
                      <Badge variant={t.contexto_operativo === "campana" ? "warning" : "muted"}>
                        {CONTEXTO_LABELS[t.contexto_operativo]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(t.fecha_limite)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
