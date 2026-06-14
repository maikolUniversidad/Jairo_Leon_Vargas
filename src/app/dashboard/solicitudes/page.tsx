import { Inbox } from "lucide-react";

import { PageHeader, EmptyState } from "@/components/dashboard/shared";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RequestStatusBadge, PriorityBadge } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { CitizenRequest } from "@/types/database";

async function getRequests(): Promise<CitizenRequest[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("requests")
      .select("*")
      .is("deleted_at", null)
      .order("fecha_recepcion", { ascending: false })
      .limit(100);
    return (data as CitizenRequest[]) ?? [];
  } catch {
    return [];
  }
}

export default async function SolicitudesPage() {
  const requests = await getRequests();

  return (
    <>
      <PageHeader
        title="Solicitudes ciudadanas"
        description="Casos, peticiones y propuestas con radicado y seguimiento."
      />

      {requests.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Sin solicitudes"
          description="Las solicitudes radicadas desde la landing aparecerán aquí con su código JLV-AÑO-000000."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Radicado</TableHead>
                  <TableHead>Asunto</TableHead>
                  <TableHead>Localidad</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Recepción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs font-semibold">{r.radicado}</TableCell>
                    <TableCell className="max-w-xs">
                      <span className="font-medium">{r.asunto}</span>
                      <span className="block text-xs text-muted-foreground">{r.tipo_solicitud}</span>
                    </TableCell>
                    <TableCell className="text-sm">{r.localidad ?? "—"}</TableCell>
                    <TableCell><PriorityBadge priority={r.prioridad} /></TableCell>
                    <TableCell><RequestStatusBadge status={r.estado} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(r.fecha_recepcion)}
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
