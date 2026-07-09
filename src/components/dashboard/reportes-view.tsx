"use client";

import { useState, useTransition } from "react";
import { Inbox, ListChecks, Users, CalendarDays, Contact, FileText, Download, User } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/shared";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from "@/hooks/use-tab-param";
import { formatDate } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";
import {
  getPersonReport,
  type GeneralReport,
  type PersonOption,
  type PersonReport,
} from "@/actions/reportes";

type Counts = Record<string, number>;

function Breakdown({ title, counts, csv }: { title: string; counts: Counts; csv: string }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map((e) => e[1]));
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{title}</h3>
          <Button
            variant="ghost" size="sm"
            onClick={() => downloadCsv(csv, ["Categoría", "Cantidad"], entries)}
          >
            <Download className="size-3.5" /> CSV
          </Button>
        </div>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos.</p>
        ) : (
          <ul className="space-y-1.5">
            {entries.map(([k, v]) => (
              <li key={k} className="text-sm">
                <div className="flex items-center justify-between">
                  <span className="capitalize">{k.replace(/_/g, " ")}</span>
                  <span className="font-medium">{v}</span>
                </div>
                <div className="mt-0.5 h-1.5 rounded-full bg-muted">
                  <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(v / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function ReportesView({
  general,
  users,
}: {
  general: GeneralReport;
  users: PersonOption[];
}) {
  const [tab, setTab] = useTabParam<"general" | "persona">("vista", "general", ["general", "persona"]);
  const [userId, setUserId] = useState("");
  const [report, setReport] = useState<PersonReport | null>(null);
  const [pending, start] = useTransition();

  function loadPerson(id: string) {
    setUserId(id);
    if (!id) { setReport(null); return; }
    start(async () => setReport(await getPersonReport(id)));
  }

  const userName = users.find((u) => u.id === userId)?.full_name ?? "persona";

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as "general" | "persona")}>
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="persona">Por persona</TabsTrigger>
      </TabsList>

      {/* ───────── General ───────── */}
      <TabsContent value="general" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Solicitudes" value={general.solicitudes.total} icon={Inbox} tone="primary" />
          <StatCard label="Tareas" value={general.tareas.total} icon={ListChecks} />
          <StatCard label="Ciudadanos" value={general.ciudadanos.total} icon={Users} tone="primary" />
          <StatCard label="Eventos próximos" value={general.eventos.proximos} icon={CalendarDays} />
          <StatCard label="Contactos" value={general.contactos.total} icon={Contact} />
          <StatCard label="Documentos" value={general.documentos.total} icon={FileText} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Breakdown title="Solicitudes por estado" counts={general.solicitudes.porEstado} csv="solicitudes-por-estado" />
          <Breakdown title="Solicitudes por semáforo" counts={general.solicitudes.porSemaforo} csv="solicitudes-por-semaforo" />
          <Breakdown title="Solicitudes por localidad" counts={general.solicitudes.porLocalidad} csv="solicitudes-por-localidad" />
          <Breakdown title="Solicitudes por tipo" counts={general.solicitudes.porTipo} csv="solicitudes-por-tipo" />
          <Breakdown title="Tareas por estado" counts={general.tareas.porEstado} csv="tareas-por-estado" />
          <Breakdown title="Ciudadanos por localidad" counts={general.ciudadanos.porLocalidad} csv="ciudadanos-por-localidad" />
          <Breakdown title="Contactos por tipo" counts={general.contactos.porTipo} csv="contactos-por-tipo" />
        </div>
      </TabsContent>

      {/* ───────── Por persona ───────── */}
      <TabsContent value="persona" className="space-y-4">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <User className="size-5 text-muted-foreground" />
            <Select value={userId} onValueChange={loadPerson}>
              <SelectTrigger className="w-72"><SelectValue placeholder="Selecciona una persona" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email || u.id.slice(0, 8)}</SelectItem>)}
              </SelectContent>
            </Select>
            {report && (
              <Button
                variant="outline" size="sm" className="ml-auto"
                onClick={() => downloadCsv(
                  `reporte-${userName}`,
                  ["Fecha", "Fuente", "Acción", "Entidad", "Detalle"],
                  report.timeline.map((t) => [formatDate(t.created_at, { dateStyle: "short", timeStyle: "short" }), t.fuente, t.accion, t.entidad ?? "", t.detalle ?? ""]),
                )}
              >
                <Download className="size-4" /> Exportar actividad
              </Button>
            )}
          </CardContent>
        </Card>

        {pending && <p className="text-sm text-muted-foreground">Cargando…</p>}

        {report && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(report.resumen).map(([k, v]) => (
                <Card key={k}><CardContent className="p-4">
                  <p className="text-2xl font-bold">{v}</p>
                  <p className="text-xs text-muted-foreground">{k}</p>
                </CardContent></Card>
              ))}
            </div>

            <Card>
              <CardContent className="p-5">
                <h3 className="mb-3 text-sm font-semibold">Actividad reciente</h3>
                {report.timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin actividad registrada.</p>
                ) : (
                  <ol className="space-y-2 border-l pl-4">
                    {report.timeline.map((t, i) => (
                      <li key={i} className="relative text-sm">
                        <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary" />
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={t.fuente === "actividad" ? "secondary" : "muted"}>{t.accion}</Badge>
                          {t.entidad && <span className="text-muted-foreground">{t.entidad}</span>}
                          {t.detalle && <span className="truncate text-muted-foreground">· {t.detalle}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground">{formatDate(t.created_at, { dateStyle: "medium", timeStyle: "short" })}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
