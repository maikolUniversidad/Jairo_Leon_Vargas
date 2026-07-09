"use client";

import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  values: number[]; // alineado a `labels`
}

// Layout en unidades del viewBox (el SVG escala al ancho del contenedor).
const W = 1000;
const H = 300;
const PAD = { left: 44, right: 16, top: 14, bottom: 30 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

function niceMax(m: number): number {
  if (m <= 5) return Math.max(1, m);
  const pow = Math.pow(10, Math.floor(Math.log10(m)));
  const step = pow / 2;
  return Math.ceil(m / step) * step;
}

/**
 * Gráfico de líneas multi-serie sobre una línea de tiempo. Ejes, grilla, hover
 * con crosshair y leyenda CLICKEABLE que actúa como filtro (resalta una serie y
 * avisa al padre). Sin dependencias.
 */
export function LineTimeChart({
  labels,
  series,
  activeKey = null,
  onLegendClick,
  height = 260,
}: {
  labels: string[];
  series: ChartSeries[];
  activeKey?: string | null;
  onLegendClick?: (key: string) => void;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ i: number; xPct: number } | null>(null);

  const n = labels.length;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const xAt = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => PAD.top + plotH - (v / max) * plotH;

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, k) => (max / ticks) * k);
  const showEvery = n > 12 ? Math.ceil(n / 12) : 1;

  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el || n === 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const xUnit = ratio * W;
    let i = Math.round(((xUnit - PAD.left) / plotW) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    setHover({ i, xPct: (xAt(i) / W) * 100 });
  }

  return (
    <div>
      {/* Leyenda clickeable = filtro */}
      <div className="mb-2 flex flex-wrap items-center gap-3">
        {series.map((s) => {
          const active = activeKey === s.key;
          const dim = activeKey && !active;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onLegendClick?.(s.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition",
                active ? "border-primary bg-primary/5 font-medium" : "border-transparent hover:bg-muted",
                dim && "opacity-40",
              )}
            >
              <span className="h-2.5 w-3.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </button>
          );
        })}
        {activeKey && (
          <button type="button" onClick={() => onLegendClick?.(activeKey)} className="text-xs text-muted-foreground underline">
            quitar filtro
          </button>
        )}
      </div>

      <div ref={ref} className="relative" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
          {/* Grilla + eje Y */}
          {yTicks.map((t, k) => (
            <g key={k}>
              <line x1={PAD.left} x2={W - PAD.right} y1={yAt(t)} y2={yAt(t)} stroke="currentColor" className="text-border" strokeWidth={1} />
              <text x={PAD.left - 6} y={yAt(t) + 3} textAnchor="end" className="fill-muted-foreground" style={{ fontSize: 11 }}>
                {Math.round(t)}
              </text>
            </g>
          ))}
          {/* Eje X */}
          {labels.map((lb, i) =>
            i % showEvery === 0 ? (
              <text key={i} x={xAt(i)} y={H - 8} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11 }}>
                {lb}
              </text>
            ) : null,
          )}
          {/* Crosshair */}
          {hover && (
            <line x1={xAt(hover.i)} x2={xAt(hover.i)} y1={PAD.top} y2={PAD.top + plotH} stroke="currentColor" className="text-muted-foreground/40" strokeWidth={1} />
          )}
          {/* Series */}
          {series.map((s) => {
            const dim = activeKey && activeKey !== s.key;
            const pts = s.values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");
            return (
              <g key={s.key} opacity={dim ? 0.2 : 1}>
                <polyline points={pts} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                {hover && (
                  <circle cx={xAt(hover.i)} cy={yAt(s.values[hover.i] ?? 0)} r={3.5} fill={s.color} stroke="#fff" strokeWidth={1.5} />
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hover && (
          <div
            className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-lg border bg-background/95 px-2.5 py-1.5 text-xs shadow"
            style={{ left: `${hover.xPct}%` }}
          >
            <p className="mb-0.5 font-medium">{labels[hover.i]}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: s.color }} />
                {s.label}: <span className="font-medium tabular-nums">{s.values[hover.i] ?? 0}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
