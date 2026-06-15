"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarClock as SyncIcon, Copy, RefreshCw, Apple, Calendar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { getCalendarSubscription, regenerateCalendarToken } from "@/actions/calendar";

export function CalendarSync() {
  const [ics, setIcs] = useState("");
  const [webcal, setWebcal] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    getCalendarSubscription().then((s) => {
      if (s) { setIcs(s.icsUrl); setWebcal(s.webcalUrl); }
    });
  }, []);

  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <SyncIcon className="size-4" /> Sincroniza tu calendario
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Suscríbete a este enlace en <strong>Google Calendar</strong> o <strong>iPhone</strong> y verás
          tus eventos y tus tareas (con fecha límite). Se actualiza solo.
        </p>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input readOnly value={ics} className="flex-1 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
          <Button
            variant="outline"
            onClick={() => { navigator.clipboard.writeText(ics); toast.success("Enlace copiado"); }}
            disabled={!ics}
          >
            <Copy className="size-4" /> Copiar
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm" disabled={!webcal}>
            <a href={webcal}><Apple className="size-4" /> Agregar a iPhone / Apple</a>
          </Button>
          <Button asChild variant="secondary" size="sm" disabled={!ics}>
            <a
              href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(ics)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Calendar className="size-4" /> Agregar a Google
            </a>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await regenerateCalendarToken();
                if (res.ok && res.data) { setIcs(res.data.icsUrl); setWebcal(res.data.webcalUrl); toast.success(res.message); }
                else toast.error(res.message);
              })
            }
          >
            <RefreshCw className="size-4" /> Regenerar enlace
          </Button>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          En Google: Otros calendarios → “Desde URL” → pega el enlace. En iPhone: Ajustes → Calendario →
          Cuentas → Añadir → Otra → Calendario suscrito. Es privado: no lo compartas.
        </p>
      </CardContent>
    </Card>
  );
}
