"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Globe, Lock, Trash2, CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { setEventPublish, softDeleteEvent } from "@/actions/eventos";

export interface ManagedEvent {
  id: string;
  titulo: string;
  tipo: string;
  fecha_inicio: string;
  visibilidad: "publica" | "interna";
  estado: string;
}

export function EventsManager({ events }: { events: ManagedEvent[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="mb-1 flex items-center gap-2 font-semibold">
          <CalendarDays className="size-4" /> Eventos
        </h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Marca un evento como <strong>público</strong> para que aparezca en la agenda del sitio web, o
          déjalo <strong>interno</strong> para el equipo.
        </p>

        {events.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Aún no hay eventos. Crea uno con “Nuevo evento”.</p>
        ) : (
          <ul className="divide-y">
            {events.map((e) => {
              const publico = e.visibilidad === "publica";
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.tipo} · {formatDate(e.fecha_inicio, { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <Badge variant={publico ? "success" : "muted"} className="gap-1">
                    {publico ? <Globe className="size-3" /> : <Lock className="size-3" />}
                    {publico ? "En agenda web" : "Interno"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await setEventPublish(e.id, !publico);
                        if (res.ok) { toast.success(res.message); router.refresh(); }
                        else toast.error(res.message);
                      })
                    }
                  >
                    {publico ? "Hacer interno" : "Publicar en web"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await softDeleteEvent(e.id);
                        if (res.ok) { toast.success(res.message); router.refresh(); }
                        else toast.error(res.message);
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
