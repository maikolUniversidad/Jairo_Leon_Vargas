import { Bell } from "lucide-react";

import { requireRole } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/dashboard/shared";
import { NotificationComposer } from "@/components/dashboard/notification-composer";
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
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

interface Batch {
  id: string;
  titulo: string;
  tipo: string;
  canales: string[];
  audiencia_tipo: string;
  audiencia_valor: string | null;
  total_destinatarios: number;
  resultado_canales: Record<string, string>;
  created_at: string;
}

interface UserOption {
  id: string;
  full_name: string | null;
  email: string | null;
}

export default async function NotificacionesPage() {
  // Solo roles emisores (defensa adicional a RLS / can_send_notifications()).
  await requireRole([
    "super_admin",
    "administrador",
    "direccion_general",
    "coordinador_utl",
    "comunicaciones",
  ]);

  const supabase = await createClient();
  const [{ data: users }, { data: batches }] = await Promise.all([
    supabase.from("profiles").select("id,full_name,email").eq("is_active", true).order("full_name"),
    supabase
      .from("notification_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <>
      <PageHeader
        title="Notificaciones"
        description="Envía mensajes multicanal al equipo. Cada envío queda auditado."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <NotificationComposer users={(users as UserOption[]) ?? []} />
        </div>

        <div className="lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            Historial de envíos (auditoría)
          </h2>
          {!batches || batches.length === 0 ? (
            <EmptyState icon={Bell} title="Sin envíos aún" description="Tus notificaciones enviadas aparecerán aquí." />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mensaje</TableHead>
                      <TableHead>Canales</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(batches as Batch[]).map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="max-w-[14rem]">
                          <span className="font-medium">{b.titulo}</span>
                          <span className="block text-xs text-muted-foreground">{b.tipo}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {b.canales.map((c) => (
                              <Badge key={c} variant="muted" title={b.resultado_canales?.[c] ?? ""}>
                                {c}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {b.audiencia_tipo === "todos"
                            ? "Todo el equipo"
                            : `${b.audiencia_tipo}: ${b.audiencia_valor ?? "—"}`}
                          <span className="block text-xs text-muted-foreground">
                            {b.total_destinatarios} destinatario(s)
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(b.created_at, { dateStyle: "short", timeStyle: "short" })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
