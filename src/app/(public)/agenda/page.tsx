import type { Metadata } from "next";
import { CalendarDays, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageIntro } from "@/components/landing/page-intro";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { CalendarEvent } from "@/types/database";

export const metadata: Metadata = {
  title: "Agenda en territorio",
  description: "Próximos eventos, recorridos y encuentros ciudadanos.",
};

async function getPublicEvents(): Promise<CalendarEvent[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("visibilidad", "publica")
      .is("deleted_at", null)
      .order("fecha_inicio", { ascending: true })
      .limit(30);
    return (data as CalendarEvent[]) ?? [];
  } catch {
    return [];
  }
}

export default async function AgendaPage() {
  const events = await getPublicEvents();

  return (
    <div className="container max-w-4xl py-12 md:py-16">
      <PageIntro
        eyebrow="En el territorio"
        title="Agenda en territorio"
        description="Recorridos, reuniones comunitarias y encuentros ciudadanos."
      />

      {events.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center text-muted-foreground">
            <CalendarDays className="size-10 opacity-40" />
            <p>No hay eventos públicos programados por ahora.</p>
            <p className="text-sm">Vuelve pronto o suscríbete para enterarte primero.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {events.map((ev) => (
            <Card key={ev.id} className="border-l-4 border-l-primary shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Badge variant="muted" className="mb-2">{ev.tipo}</Badge>
                  <h3 className="font-bold">{ev.titulo}</h3>
                  {ev.descripcion && (
                    <p className="mt-1 text-sm text-muted-foreground">{ev.descripcion}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="size-4" />
                      {formatDate(ev.fecha_inicio, { dateStyle: "full", timeStyle: "short" })}
                    </span>
                    {ev.lugar && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-4" /> {ev.lugar}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
