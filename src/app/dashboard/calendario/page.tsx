import { CalendarDays } from "lucide-react";

import { PageHeader, EmptyState } from "@/components/dashboard/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { CalendarEvent } from "@/types/database";

async function getEvents(): Promise<CalendarEvent[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("events")
      .select("*")
      .is("deleted_at", null)
      .order("fecha_inicio", { ascending: true })
      .limit(100);
    return (data as CalendarEvent[]) ?? [];
  } catch {
    return [];
  }
}

export default async function CalendarioPage() {
  const events = await getEvents();

  return (
    <>
      <PageHeader
        title="Calendario interno"
        description="Agenda del despacho y del equipo: reuniones, recorridos y eventos."
      />
      {events.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Sin eventos" description="Crea eventos para coordinar la agenda del equipo." />
      ) : (
        <div className="grid gap-3">
          {events.map((ev) => (
            <Card key={ev.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="muted">{ev.tipo}</Badge>
                    <Badge variant={ev.visibilidad === "publica" ? "success" : "secondary"}>
                      {ev.visibilidad}
                    </Badge>
                  </div>
                  <h3 className="mt-1 font-medium">{ev.titulo}</h3>
                  {ev.lugar && <p className="text-sm text-muted-foreground">{ev.lugar}</p>}
                </div>
                <span className="text-sm text-muted-foreground">
                  {formatDate(ev.fecha_inicio, { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
