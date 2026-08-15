"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/dashboard/shared";
import { toggleNovedadResuelta } from "@/actions/inventario";
import {
  SEVERIDAD_LABEL,
  TIPO_NOVEDAD_LABEL,
  type NovedadInventario,
} from "@/lib/inventario-shared";
import { formatFecha, formatMoneda } from "./helpers";
import { NovedadDialog } from "./novedad-dialog";

function ItemNovedad({
  n,
  canManage,
  onToggle,
}: {
  n: NovedadInventario;
  canManage: boolean;
  onToggle: (id: string, resuelto: boolean) => void;
}) {
  const grave = n.tipo === "accidente" || n.tipo === "perdida" || n.severidad === "critica";
  return (
    <li className="rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={grave ? "danger" : "warning"}>{TIPO_NOVEDAD_LABEL[n.tipo]}</Badge>
        <span className="font-medium">{n.equipo_nombre}</span>
        <span className="text-xs text-muted-foreground">Severidad {SEVERIDAD_LABEL[n.severidad]}</span>
        {n.resuelto && <Badge variant="success">Resuelta</Badge>}
        <span className="ml-auto text-xs text-muted-foreground">{formatFecha(n.created_at, true)}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap">{n.descripcion}</p>
      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {n.costo != null && <span>Costo: {formatMoneda(n.costo)}</span>}
        {n.reportado_por_nombre && <span>Reportó: {n.reportado_por_nombre}</span>}
        {canManage && (
          <button
            type="button"
            onClick={() => onToggle(n.id, !n.resuelto)}
            className="ml-auto text-primary hover:underline"
          >
            {n.resuelto ? "Reabrir" : "Marcar resuelta"}
          </button>
        )}
      </div>
    </li>
  );
}

export function NovedadesPanel({
  novedades,
  equipos,
  canManage,
}: {
  novedades: NovedadInventario[];
  equipos: { id: string; nombre: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  const abiertas = useMemo(() => novedades.filter((n) => !n.resuelto), [novedades]);
  const resueltas = useMemo(() => novedades.filter((n) => n.resuelto), [novedades]);

  const toggle = (id: string, resuelto: boolean) =>
    start(async () => {
      const res = await toggleNovedadResuelta(id, resuelto);
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else toast.error(res.message);
    });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1 size-4" /> Registrar novedad
        </Button>
      </div>

      <Tabs defaultValue="abiertas">
        <TabsList>
          <TabsTrigger value="abiertas">Abiertas ({abiertas.length})</TabsTrigger>
          <TabsTrigger value="resueltas">Resueltas ({resueltas.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="abiertas">
          {abiertas.length === 0 ? (
            <EmptyState icon={AlertTriangle} title="Sin novedades abiertas" description="Ningún equipo tiene incidencias pendientes." />
          ) : (
            <ul className="space-y-2">
              {abiertas.map((n) => (
                <ItemNovedad key={n.id} n={n} canManage={canManage} onToggle={toggle} />
              ))}
            </ul>
          )}
          {pending && null}
        </TabsContent>

        <TabsContent value="resueltas">
          {resueltas.length === 0 ? (
            <EmptyState icon={AlertTriangle} title="Nada resuelto todavía" />
          ) : (
            <ul className="space-y-2">
              {resueltas.map((n) => (
                <ItemNovedad key={n.id} n={n} canManage={canManage} onToggle={toggle} />
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <NovedadDialog open={open} onOpenChange={setOpen} equipos={equipos} canManage={canManage} />
    </div>
  );
}
