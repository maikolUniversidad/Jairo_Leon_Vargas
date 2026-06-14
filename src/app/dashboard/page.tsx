import {
  Inbox,
  CheckCircle2,
  ListChecks,
  AlertTriangle,
  CalendarDays,
  Users,
  MapPinned,
  Megaphone,
} from "lucide-react";

import { PageHeader, StatCard } from "@/components/dashboard/shared";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

interface Kpis {
  solicitudesTotal: number;
  solicitudesAbiertas: number;
  solicitudesCerradas: number;
  tareasPendientes: number;
  tareasVencidas: number;
  eventosProximos: number;
  ciudadanos: number;
  zonasActivas: number;
  publicacionesRevision: number;
}

const EMPTY: Kpis = {
  solicitudesTotal: 0,
  solicitudesAbiertas: 0,
  solicitudesCerradas: 0,
  tareasPendientes: 0,
  tareasVencidas: 0,
  eventosProximos: 0,
  ciudadanos: 0,
  zonasActivas: 0,
  publicacionesRevision: 0,
};

/** Ejecuta una consulta `head + count` y devuelve el número, o 0 si falla. */
async function take(p: PromiseLike<{ count: number | null }>): Promise<number> {
  try {
    return (await p).count ?? 0;
  } catch {
    return 0;
  }
}

async function getKpis(): Promise<Kpis> {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    return EMPTY;
  }

  const nowIso = new Date().toISOString();
  const head = { count: "exact" as const, head: true };

  const [
    solicitudesTotal,
    solicitudesAbiertas,
    solicitudesCerradas,
    tareasPendientes,
    tareasVencidas,
    eventosProximos,
    ciudadanos,
    zonasActivas,
    publicacionesRevision,
  ] = await Promise.all([
    take(supabase.from("requests").select("*", head)),
    take(
      supabase
        .from("requests")
        .select("*", head)
        .in("estado", ["recibida", "clasificada", "asignada", "en_gestion"]),
    ),
    take(supabase.from("requests").select("*", head).eq("estado", "cerrada")),
    take(
      supabase
        .from("tasks")
        .select("*", head)
        .in("estado", ["pendiente", "en_proceso"]),
    ),
    take(
      supabase
        .from("tasks")
        .select("*", head)
        .lt("fecha_limite", nowIso)
        .not("estado", "in", "(finalizada,cancelada,aprobada)"),
    ),
    take(supabase.from("events").select("*", head).gte("fecha_inicio", nowIso)),
    take(supabase.from("citizens").select("*", head).is("deleted_at", null)),
    take(supabase.from("zones").select("*", head).eq("estado", "activa")),
    take(
      supabase.from("content_posts").select("*", head).eq("estado", "en_revision"),
    ),
  ]);

  return {
    solicitudesTotal,
    solicitudesAbiertas,
    solicitudesCerradas,
    tareasPendientes,
    tareasVencidas,
    eventosProximos,
    ciudadanos,
    zonasActivas,
    publicacionesRevision,
  };
}

export default async function DashboardHome() {
  const k = await getKpis();

  return (
    <>
      <PageHeader
        title="Panel principal"
        description="Resumen operativo de la UTL y la gestión ciudadana."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Solicitudes recibidas" value={k.solicitudesTotal} icon={Inbox} tone="primary" />
        <StatCard label="Solicitudes abiertas" value={k.solicitudesAbiertas} icon={Inbox} tone="warning" />
        <StatCard label="Solicitudes cerradas" value={k.solicitudesCerradas} icon={CheckCircle2} tone="success" />
        <StatCard label="Tareas pendientes" value={k.tareasPendientes} icon={ListChecks} />
        <StatCard label="Tareas vencidas" value={k.tareasVencidas} icon={AlertTriangle} tone="warning" />
        <StatCard label="Eventos próximos" value={k.eventosProximos} icon={CalendarDays} />
        <StatCard label="Ciudadanos registrados" value={k.ciudadanos} icon={Users} tone="primary" />
        <StatCard label="Zonas activas" value={k.zonasActivas} icon={MapPinned} />
        <StatCard label="Publicaciones en revisión" value={k.publicacionesRevision} icon={Megaphone} />
      </div>

      <Card className="mt-6">
        <CardContent className="p-6">
          <h2 className="font-semibold">Bienvenido/a a UTL 360</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Si los indicadores están en cero, verifica que Supabase esté
            configurado (variables de entorno) y que las migraciones SQL se hayan
            ejecutado. Consulta el README para el paso a paso.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
