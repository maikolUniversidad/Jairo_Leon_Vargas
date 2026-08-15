"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addParte, removeParte, updateParte } from "@/actions/inventario";
import {
  ESTADOS_PARTE,
  ESTADO_PARTE_LABEL,
  PARTES_SUGERIDAS,
  type EstadoParte,
  type ParteEquipo,
} from "@/lib/inventario-shared";

const TONO_PARTE: Record<EstadoParte, "success" | "warning" | "danger"> = {
  ok: "success",
  faltante: "warning",
  danado: "danger",
};

/** Piezas y partes de un equipo: agregar, cambiar estado y quitar. */
export function ParteEditor({
  equipoId,
  partes,
  canManage,
}: {
  equipoId: string;
  partes: ParteEquipo[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [, start] = useTransition();

  const refrescar = () => start(() => router.refresh());

  const agregar = () => {
    if (nombre.trim().length < 1) return;
    start(async () => {
      const res = await addParte(equipoId, { nombre, cantidad, esencial: true, estado: "ok" });
      if (res.ok) {
        setNombre("");
        setCantidad("1");
        refrescar();
      } else {
        toast.error(res.message);
      }
    });
  };

  const cambiarEstado = (id: string, estado: EstadoParte) =>
    start(async () => {
      const res = await updateParte(id, { estado });
      if (!res.ok) toast.error(res.message);
      else refrescar();
    });

  const quitar = (id: string) =>
    start(async () => {
      const res = await removeParte(id);
      if (res.ok) refrescar();
      else toast.error(res.message);
    });

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-3">
          <div className="min-w-[10rem] flex-1">
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Batería, cargador, memoria SD…"
              list="partes-sugeridas"
              aria-label="Nombre de la parte"
              onKeyDown={(e) => e.key === "Enter" && agregar()}
            />
            <datalist id="partes-sugeridas">
              {PARTES_SUGERIDAS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          <Input
            type="number"
            min={0}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="w-20"
            aria-label="Cantidad"
          />
          <Button size="sm" onClick={agregar} disabled={nombre.trim().length < 1}>
            <Plus className="mr-1 size-4" /> Agregar
          </Button>
        </div>
      )}

      {partes.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Sin piezas registradas. {canManage && "Agrega las partes del kit para verificarlas en cada préstamo."}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {partes.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="flex-1">
                {p.nombre}
                {p.cantidad > 1 && <span className="text-muted-foreground"> ×{p.cantidad}</span>}
              </span>
              {canManage ? (
                <select
                  value={p.estado}
                  onChange={(e) => cambiarEstado(p.id, e.target.value as EstadoParte)}
                  className="h-8 rounded border bg-background px-2 text-xs"
                  aria-label={`Estado de ${p.nombre}`}
                >
                  {ESTADOS_PARTE.map((s) => (
                    <option key={s} value={s}>{ESTADO_PARTE_LABEL[s]}</option>
                  ))}
                </select>
              ) : (
                <Badge variant={TONO_PARTE[p.estado]}>{ESTADO_PARTE_LABEL[p.estado]}</Badge>
              )}
              {canManage && (
                <button
                  type="button"
                  onClick={() => quitar(p.id)}
                  aria-label={`Quitar ${p.nombre}`}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
