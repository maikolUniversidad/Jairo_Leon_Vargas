import { Inbox, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";

import { PageHeader, EmptyState, StatCard } from "@/components/dashboard/shared";
import { SolicitudesBoard } from "@/components/dashboard/solicitudes-board";
import { createClient } from "@/lib/supabase/server";
import type { CitizenRequest, Profile } from "@/types/database";

async function getData(): Promise<{ requests: CitizenRequest[]; profiles: Profile[] }> {
  try {
    const supabase = await createClient();
    const [{ data: requests }, { data: profiles }] = await Promise.all([
      supabase
        .from("requests")
        .select("*")
        .is("deleted_at", null)
        .order("fecha_recepcion", { ascending: false })
        .limit(500),
      supabase.from("profiles").select("*").eq("is_active", true),
    ]);
    return {
      requests: (requests as CitizenRequest[]) ?? [],
      profiles: (profiles as Profile[]) ?? [],
    };
  } catch {
    return { requests: [], profiles: [] };
  }
}

export default async function SolicitudesPage() {
  const { requests, profiles } = await getData();

  const abiertas = requests.filter((r) => !["cerrada", "archivada"].includes(r.estado));
  const rojas = requests.filter((r) => r.semaforo === "rojo");
  const enGestion = requests.filter((r) => r.estado === "en_gestion");
  const cerradas = requests.filter((r) => r.estado === "cerrada");

  return (
    <>
      <PageHeader
        title="Solicitudes ciudadanas"
        description="Casos de salud, entidades, hojas de vida, peticiones y apuntes — con radicado, semáforo, gestión e historial."
      />

      {requests.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Sin solicitudes"
          description="Las solicitudes radicadas desde la landing aparecerán aquí con su código JLV-AÑO-000000."
        />
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Abiertas" value={abiertas.length} icon={Inbox} tone="primary" />
            <StatCard label="En semáforo rojo" value={rojas.length} icon={AlertTriangle} tone="warning" />
            <StatCard label="En gestión" value={enGestion.length} icon={Clock} tone="default" />
            <StatCard label="Cerradas" value={cerradas.length} icon={CheckCircle2} tone="success" />
          </div>
          <SolicitudesBoard requests={requests} profiles={profiles} />
        </>
      )}
    </>
  );
}
