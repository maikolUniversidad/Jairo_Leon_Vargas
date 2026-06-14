"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export type CalItem = {
  id: string;
  date: string; // ISO
  title: string;
  kind: "evento" | "tarea" | "solicitud";
  meta?: string;
  lugar?: string | null;
  modalidad?: string | null;
};

const KIND_STYLE: Record<CalItem["kind"], string> = {
  evento: "bg-primary/15 text-primary",
  tarea: "bg-amber-100 text-amber-800",
  solicitud: "bg-blue-100 text-blue-800",
};

const KIND_LABEL: Record<CalItem["kind"], string> = {
  evento: "Evento",
  tarea: "Tarea",
  solicitud: "Solicitud",
};

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CalendarView({ items }: { items: CalItem[] }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<string | null>(ymd(today));

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    for (const it of items) {
      const d = new Date(it.date);
      if (Number.isNaN(d.getTime())) continue;
      const key = ymd(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return map;
  }, [items]);

  // Construir matriz de semanas (lunes-domingo)
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // lunes = 0
  const gridStart = new Date(year, month, 1 - startOffset);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }

  const todayKey = ymd(today);
  const selectedItems = selectedDay ? (itemsByDay.get(selectedDay) ?? []) : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardContent className="p-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{MONTHS[month]} {year}</h2>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setCursor(new Date(year, month - 1, 1))}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => { const t = new Date(); setCursor(new Date(t.getFullYear(), t.getMonth(), 1)); setSelectedDay(ymd(t)); }}>
                Hoy
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCursor(new Date(year, month + 1, 1))}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="pb-1 text-center text-xs font-medium text-muted-foreground">{d}</div>
            ))}
            {days.map((d) => {
              const key = ymd(d);
              const inMonth = d.getMonth() === month;
              const dayItems = itemsByDay.get(key) ?? [];
              const isToday = key === todayKey;
              const isSelected = key === selectedDay;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDay(key)}
                  className={`min-h-[78px] rounded-lg border p-1 text-left transition hover:border-primary/50 ${
                    inMonth ? "bg-background" : "bg-muted/30 text-muted-foreground/60"
                  } ${isSelected ? "ring-2 ring-primary" : ""}`}
                >
                  <span className={`inline-flex size-6 items-center justify-center rounded-full text-xs ${
                    isToday ? "bg-primary font-bold text-primary-foreground" : ""
                  }`}>
                    {d.getDate()}
                  </span>
                  <div className="mt-0.5 space-y-0.5">
                    {dayItems.slice(0, 3).map((it) => (
                      <div key={it.id} className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight ${KIND_STYLE[it.kind]}`}>
                        {it.title}
                      </div>
                    ))}
                    {dayItems.length > 3 && (
                      <div className="px-1 text-[10px] text-muted-foreground">+{dayItems.length - 3} más</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Panel del día seleccionado */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold">
            {selectedDay ? formatDate(selectedDay + "T12:00:00", { weekday: "long", day: "numeric", month: "long" }) : "Selecciona un día"}
          </h3>
          <div className="mt-3 space-y-2">
            {selectedItems.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin actividades este día.</p>
            )}
            {selectedItems
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((it) => (
                <div key={it.id} className="rounded-lg border p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${KIND_STYLE[it.kind]}`}>
                      {KIND_LABEL[it.kind]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(it.date, { timeStyle: "short" })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium">{it.title}</p>
                  {it.meta && <p className="text-xs text-muted-foreground">{it.meta}</p>}
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {it.lugar && <span className="flex items-center gap-1"><MapPin className="size-3" />{it.lugar}</span>}
                    {it.modalidad && it.modalidad !== "presencial" && (
                      <span className="flex items-center gap-1"><Video className="size-3" />{it.modalidad}</span>
                    )}
                  </div>
                </div>
              ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t pt-3 text-xs text-muted-foreground">
            <Badge variant="default">Eventos</Badge>
            <Badge variant="warning">Tareas (vence)</Badge>
            <Badge variant="secondary">Solicitudes</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
