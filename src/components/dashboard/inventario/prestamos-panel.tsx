"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, PackageOpen, Undo2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/dashboard/shared";
import { aprobarSolicitud, getEquipoDetalle, rechazarSolicitud } from "@/actions/inventario";
import {
  type ParteEquipo,
  type PrestamoInventario,
} from "@/lib/inventario-shared";
import { EstadoPrestamoBadge, formatFecha } from "./helpers";
import { DevolucionDialog, SolicitudDialog } from "./prestamo-dialogs";

function Fila({
  p,
  acciones,
}: {
  p: PrestamoInventario;
  acciones?: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{p.equipo_nombre}</span>
          <EstadoPrestamoBadge estado={p.estado} vencido={p.vencido} />
        </div>
        <p className="text-xs text-muted-foreground">
          {p.responsable_nombre}
          {p.fecha_salida && ` · salió ${formatFecha(p.fecha_salida)}`}
          {p.fecha_prevista && ` · devuelve ${formatFecha(p.fecha_prevista)}`}
          {p.proposito && ` · ${p.proposito}`}
        </p>
      </div>
      {acciones}
    </li>
  );
}

export function PrestamosPanel({
  prestamos,
  equipos,
  canManage,
}: {
  prestamos: PrestamoInventario[];
  equipos: { id: string; nombre: string; disponible: boolean }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [solicitudOpen, setSolicitudOpen] = useState(false);
  const [devolucion, setDevolucion] = useState<{ prestamo: PrestamoInventario; partes: ParteEquipo[] } | null>(null);

  const activos = useMemo(() => prestamos.filter((p) => p.estado === "activo"), [prestamos]);
  const solicitudes = useMemo(() => prestamos.filter((p) => p.estado === "solicitado"), [prestamos]);
  const historial = useMemo(
    () => prestamos.filter((p) => p.estado === "devuelto" || p.estado === "rechazado"),
    [prestamos],
  );

  const disponibles = useMemo(() => equipos.filter((e) => e.disponible), [equipos]);

  const recibir = (p: PrestamoInventario) =>
    start(async () => {
      const d = await getEquipoDetalle(p.equipo_id);
      setDevolucion({ prestamo: p, partes: d?.partes ?? [] });
    });

  const aprobar = (p: PrestamoInventario) =>
    start(async () => {
      const res = await aprobarSolicitud(p.id, { condicion_salida: "bueno" });
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else toast.error(res.message);
    });

  const rechazar = (p: PrestamoInventario) =>
    start(async () => {
      const res = await rechazarSolicitud(p.id);
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else toast.error(res.message);
    });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setSolicitudOpen(true)}>
          <PackageOpen className="mr-1 size-4" /> Solicitar equipo
        </Button>
      </div>

      <Tabs defaultValue="activos">
        <TabsList>
          <TabsTrigger value="activos">En préstamo ({activos.length})</TabsTrigger>
          <TabsTrigger value="solicitudes">Solicitudes ({solicitudes.length})</TabsTrigger>
          <TabsTrigger value="historial">Historial ({historial.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="activos">
          {activos.length === 0 ? (
            <EmptyState icon={PackageOpen} title="Nada en préstamo" description="Todos los equipos están en su lugar." />
          ) : (
            <ul className="space-y-2">
              {activos.map((p) => (
                <Fila
                  key={p.id}
                  p={p}
                  acciones={
                    canManage ? (
                      <Button size="sm" onClick={() => recibir(p)} disabled={pending}>
                        <Undo2 className="mr-1 size-4" /> Recibir
                      </Button>
                    ) : undefined
                  }
                />
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="solicitudes">
          {solicitudes.length === 0 ? (
            <EmptyState icon={Check} title="Sin solicitudes pendientes" />
          ) : (
            <ul className="space-y-2">
              {solicitudes.map((p) => (
                <Fila
                  key={p.id}
                  p={p}
                  acciones={
                    canManage ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => aprobar(p)} disabled={pending}>
                          <Check className="mr-1 size-4" /> Aprobar y entregar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => rechazar(p)} disabled={pending}>
                          <X className="size-4" />
                        </Button>
                      </div>
                    ) : undefined
                  }
                />
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="historial">
          {historial.length === 0 ? (
            <EmptyState icon={Undo2} title="Sin historial todavía" />
          ) : (
            <ul className="space-y-2">
              {historial.map((p) => (
                <Fila key={p.id} p={p} />
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <SolicitudDialog open={solicitudOpen} onOpenChange={setSolicitudOpen} equipos={disponibles} />

      {devolucion && (
        <DevolucionDialog
          open={Boolean(devolucion)}
          onOpenChange={(v) => !v && setDevolucion(null)}
          prestamo={devolucion.prestamo}
          partes={devolucion.partes}
        />
      )}
    </div>
  );
}
