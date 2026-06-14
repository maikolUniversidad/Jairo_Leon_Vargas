import { PageHeader } from "@/components/dashboard/shared";
import { CalendarView, type CalItem } from "@/components/dashboard/calendar-view";
import { EventCreateDialog } from "@/components/dashboard/event-create-dialog";
import { createClient } from "@/lib/supabase/server";
import type { CalendarEvent, Task, CitizenRequest } from "@/types/database";

async function getItems(): Promise<CalItem[]> {
  try {
    const supabase = await createClient();
    const [{ data: events }, { data: tasks }, { data: requests }] = await Promise.all([
      supabase.from("events").select("*").is("deleted_at", null).limit(500),
      supabase
        .from("tasks")
        .select("id,titulo,fecha_limite,estado")
        .is("deleted_at", null)
        .not("fecha_limite", "is", null)
        .limit(500),
      supabase
        .from("requests")
        .select("id,radicado,asunto,fecha_limite,fecha_gestion")
        .is("deleted_at", null)
        .limit(500),
    ]);

    const items: CalItem[] = [];

    for (const e of (events as CalendarEvent[]) ?? []) {
      items.push({
        id: `ev-${e.id}`,
        date: e.fecha_inicio,
        title: e.titulo,
        kind: "evento",
        meta: e.tipo,
        lugar: e.lugar,
        modalidad: e.modalidad,
      });
    }
    for (const t of (tasks as Pick<Task, "id" | "titulo" | "fecha_limite" | "estado">[]) ?? []) {
      if (!t.fecha_limite) continue;
      if (["finalizada", "cancelada"].includes(t.estado)) continue;
      items.push({
        id: `tk-${t.id}`,
        date: t.fecha_limite,
        title: `Vence: ${t.titulo}`,
        kind: "tarea",
      });
    }
    for (const r of (requests as Pick<CitizenRequest, "id" | "radicado" | "asunto" | "fecha_limite" | "fecha_gestion">[]) ?? []) {
      const date = r.fecha_limite ?? r.fecha_gestion;
      if (!date) continue;
      items.push({
        id: `rq-${r.id}`,
        date,
        title: r.asunto,
        kind: "solicitud",
        meta: r.radicado,
      });
    }
    return items;
  } catch {
    return [];
  }
}

export default async function CalendarioPage() {
  const items = await getItems();

  return (
    <>
      <PageHeader
        title="Calendario"
        description="Agenda del equipo: eventos, vencimientos de tareas y fechas de gestión de solicitudes."
        action={<EventCreateDialog />}
      />
      <CalendarView items={items} />
    </>
  );
}
