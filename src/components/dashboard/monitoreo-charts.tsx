"use client";

import { useMemo } from "react";
import { PieChart, LineChart } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LineTimeChart, type ChartSeries } from "@/components/dashboard/line-time-chart";
import type { MonitorItem } from "@/types/database";

const FUENTE_COLOR: Record<string, string> = {
  noticia: "#8e378e",
  x: "#0f172a",
  youtube: "#dc2626",
  facebook: "#2563eb",
  instagram: "#db2777",
  tiktok: "#0f766e",
  web: "#64748b",
  manual: "#94a3b8",
};
const FUENTE_LABEL: Record<string, string> = {
  noticia: "Noticias",
  x: "X",
  youtube: "YouTube",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  web: "Web",
  manual: "Manual",
};
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function MonitorCharts({
  items,
  activeSent = "todos",
  onToggleSent,
  activeFuente = "todos",
  onToggleFuente,
}: {
  items: MonitorItem[];
  activeSent?: string;
  onToggleSent?: (key: string) => void;
  activeFuente?: string;
  onToggleFuente?: (fuente: string) => void;
}) {
  const porFuente = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.fuente, (m.get(it.fuente) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  // Últimos 12 meses: total + por sentimiento.
  const monthly = useMemo(() => {
    const now = new Date();
    const labels: string[] = [];
    const idx = new Map<string, number>();
    const total: number[] = [];
    const pos: number[] = [];
    const neg: number[] = [];
    const neu: number[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      idx.set(`${d.getFullYear()}-${d.getMonth()}`, labels.length);
      const yr = i >= 12 - 1 || d.getMonth() === 0 ? ` ${String(d.getFullYear()).slice(2)}` : "";
      labels.push(`${MESES[d.getMonth()]}${yr}`);
      total.push(0); pos.push(0); neg.push(0); neu.push(0);
    }
    for (const it of items) {
      const raw = it.published_at ?? it.fetched_at;
      if (!raw) continue;
      const d = new Date(raw);
      if (isNaN(d.getTime())) continue;
      const b = idx.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (b === undefined) continue;
      total[b]! += 1;
      if (it.sentimiento === "positivo") pos[b]! += 1;
      else if (it.sentimiento === "negativo") neg[b]! += 1;
      else if (it.sentimiento === "neutral") neu[b]! += 1;
    }
    return { labels, total, pos, neg, neu };
  }, [items]);

  if (items.length === 0) return null;

  const maxF = Math.max(1, ...porFuente.map(([, n]) => n));

  const series: ChartSeries[] = [
    { key: "total", label: "Todas", color: "#8e378e", values: monthly.total },
    { key: "positivo", label: "Positivas", color: "#35a74a", values: monthly.pos },
    { key: "negativo", label: "Negativas", color: "#e92025", values: monthly.neg },
    { key: "neutral", label: "Neutrales", color: "#94a3b8", values: monthly.neu },
  ];
  const activeKey = activeSent === "todos" ? null : activeSent;

  return (
    <div className="space-y-3">
      {/* Menciones por fuente (clic = filtro) */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <PieChart className="size-4 text-primary" /> Menciones por fuente
            <span className="text-xs font-normal text-muted-foreground">· clic para filtrar</span>
          </h3>
          <ul className="space-y-1">
            {porFuente.map(([fuente, n]) => {
              const active = activeFuente === fuente;
              return (
                <li key={fuente}>
                  <button
                    type="button"
                    onClick={() => onToggleFuente?.(fuente)}
                    className={cn(
                      "grid w-full grid-cols-[64px_1fr_28px] items-center gap-2 rounded-md px-1 py-1 text-left text-xs transition",
                      active ? "bg-primary/10" : "hover:bg-muted",
                      activeFuente !== "todos" && !active && "opacity-50",
                    )}
                  >
                    <span className="truncate text-muted-foreground">{FUENTE_LABEL[fuente] ?? fuente}</span>
                    <span className="h-2.5 rounded-full bg-muted">
                      <span className="block h-2.5 rounded-full" style={{ width: `${(n / maxF) * 100}%`, backgroundColor: FUENTE_COLOR[fuente] ?? "#64748b" }} />
                    </span>
                    <span className="text-right font-medium tabular-nums">{n}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Actividad por mes (líneas). Clic en la leyenda = filtro por sentimiento. */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <LineChart className="size-4 text-primary" /> Actividad por mes
            <span className="text-xs font-normal text-muted-foreground">· clic en la leyenda para filtrar</span>
          </h3>
          <LineTimeChart
            labels={monthly.labels}
            series={series}
            activeKey={activeKey}
            onLegendClick={(k) => onToggleSent?.(k === "total" ? "todos" : k)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
