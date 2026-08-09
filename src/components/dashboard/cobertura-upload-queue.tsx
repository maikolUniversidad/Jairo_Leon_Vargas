"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2, RotateCcw, TriangleAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/media-kind";
import { type ItemSubida } from "@/hooks/use-upload-queue";

/**
 * Panel flotante con el progreso de la cola. Se queda abajo a la derecha para
 * que el tablero siga usable mientras sube un levantamiento entero.
 */
export function CoberturaUploadQueue({
  items,
  activos,
  conError,
  onCancelar,
  onReintentar,
  onLimpiar,
}: {
  items: ItemSubida[];
  activos: number;
  conError: number;
  onCancelar: (id: string) => void;
  onReintentar: (id: string) => void;
  onLimpiar: () => void;
}) {
  const [colapsado, setColapsado] = useState(false);
  if (items.length === 0) return null;

  const listos = items.filter((i) => i.estado === "listo").length;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-background shadow-lg">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        {activos > 0 ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
        ) : conError > 0 ? (
          <TriangleAlert className="size-4 shrink-0 text-amber-500" />
        ) : (
          <Check className="size-4 shrink-0 text-emerald-500" />
        )}
        <span className="flex-1 truncate text-sm font-medium">
          {activos > 0
            ? `Subiendo ${activos} archivo${activos === 1 ? "" : "s"}…`
            : conError > 0
              ? `${conError} sin subir`
              : `${listos} archivo${listos === 1 ? "" : "s"} listo${listos === 1 ? "" : "s"}`}
        </span>
        {activos === 0 && (
          <button onClick={onLimpiar} className="text-xs text-muted-foreground hover:text-foreground">
            Limpiar
          </button>
        )}
        <button
          onClick={() => setColapsado((c) => !c)}
          className="text-muted-foreground hover:text-foreground"
          aria-label={colapsado ? "Mostrar detalle" : "Ocultar detalle"}
        >
          {colapsado ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      </div>

      {!colapsado && (
        <ul className="max-h-64 divide-y overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs" title={item.nombre}>
                  {item.nombre}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatBytes(item.size)}
                </span>
                {item.estado === "error" && (
                  <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => onReintentar(item.id)}>
                    <RotateCcw className="size-3.5" />
                  </Button>
                )}
                {(item.estado === "espera" || item.estado === "subiendo") && (
                  <button
                    onClick={() => onCancelar(item.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Cancelar"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {item.estado === "subiendo" || item.estado === "espera" ? (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-200"
                    style={{ width: `${item.progreso}%` }}
                  />
                </div>
              ) : (
                <p
                  className={`mt-0.5 text-[11px] ${
                    item.estado === "listo"
                      ? "text-emerald-600"
                      : item.estado === "error"
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }`}
                >
                  {item.estado === "listo" ? "Listo" : (item.message ?? "Cancelada")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
