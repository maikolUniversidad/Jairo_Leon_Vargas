"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, PackageOpen, Pencil, Trash2, Undo2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { removeEvidencia, toggleNovedadResuelta } from "@/actions/inventario";
import {
  CATEGORIA_LABEL,
  CONDICION_LABEL,
  MOMENTO_EVIDENCIA_LABEL,
  SEVERIDAD_LABEL,
  TIPO_NOVEDAD_LABEL,
  type EquipoDetalle,
} from "@/lib/inventario-shared";
import { EstadoEquipoBadge, EstadoPrestamoBadge, formatFecha, formatMoneda } from "./helpers";
import { ParteEditor } from "./parte-editor";
import { EvidenciaUploader } from "./evidencia-uploader";

function Dato({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || "—"}</dd>
    </div>
  );
}

export function EquipoDetailDialog({
  open,
  onOpenChange,
  detalle,
  canManage,
  onEdit,
  onPrestar,
  onRecibir,
  onNovedad,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  detalle: EquipoDetalle;
  canManage: boolean;
  onEdit: () => void;
  onPrestar: () => void;
  onRecibir: () => void;
  onNovedad: () => void;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const { equipo, partes, prestamos, novedades, evidencias } = detalle;
  const activo = prestamos.find((p) => p.estado === "activo");

  const borrarEvidencia = (id: string) =>
    start(async () => {
      const res = await removeEvidencia(id);
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else toast.error(res.message);
    });

  const resolver = (id: string, resuelto: boolean) =>
    start(async () => {
      const res = await toggleNovedadResuelta(id, resuelto);
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else toast.error(res.message);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <DialogTitle className="mr-1">{equipo.nombre}</DialogTitle>
            <Badge variant="muted">{CATEGORIA_LABEL[equipo.categoria]}</Badge>
            <EstadoEquipoBadge estado={equipo.estado} />
            {equipo.codigo && <span className="text-xs text-muted-foreground">· {equipo.codigo}</span>}
          </div>
        </DialogHeader>

        {/* Acciones rápidas */}
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="mr-1 size-4" /> Editar
            </Button>
            {equipo.estado === "disponible" && (
              <Button size="sm" onClick={onPrestar}>
                <PackageOpen className="mr-1 size-4" /> Prestar
              </Button>
            )}
            {equipo.estado === "prestado" && activo && (
              <Button size="sm" onClick={onRecibir}>
                <Undo2 className="mr-1 size-4" /> Recibir
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onNovedad}>
              <AlertTriangle className="mr-1 size-4" /> Novedad
            </Button>
          </div>
        )}

        <Tabs defaultValue="ficha">
          <TabsList>
            <TabsTrigger value="ficha">Ficha</TabsTrigger>
            <TabsTrigger value="partes">Partes ({partes.length})</TabsTrigger>
            <TabsTrigger value="prestamos">Préstamos ({prestamos.length})</TabsTrigger>
            <TabsTrigger value="novedades">Novedades ({novedades.length})</TabsTrigger>
            <TabsTrigger value="evidencias">Evidencias ({evidencias.length})</TabsTrigger>
          </TabsList>

          {/* Ficha */}
          <TabsContent value="ficha">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Dato label="Marca" value={equipo.marca} />
              <Dato label="Modelo" value={equipo.modelo} />
              <Dato label="N.º de serie" value={equipo.serial} />
              <Dato label="Condición" value={CONDICION_LABEL[equipo.condicion]} />
              <Dato label="Ubicación" value={equipo.ubicacion} />
              <Dato label="Valor" value={formatMoneda(equipo.valor)} />
              <Dato label="Compra" value={formatFecha(equipo.fecha_compra)} />
            </dl>
            {equipo.notas && <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{equipo.notas}</p>}
            {activo && (
              <div className="mt-3 rounded-lg border bg-amber-50 p-3 text-sm dark:bg-amber-950/20">
                En préstamo con <strong>{activo.responsable_nombre}</strong> desde {formatFecha(activo.fecha_salida)}
                {activo.fecha_prevista && ` · devuelve ${formatFecha(activo.fecha_prevista)}`}
                {activo.vencido && <Badge variant="danger" className="ml-2">Vencido</Badge>}
              </div>
            )}
          </TabsContent>

          {/* Partes */}
          <TabsContent value="partes">
            <ParteEditor equipoId={equipo.id} partes={partes} canManage={canManage} />
          </TabsContent>

          {/* Préstamos */}
          <TabsContent value="prestamos">
            {prestamos.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Sin préstamos registrados.</p>
            ) : (
              <ul className="space-y-2">
                {prestamos.map((p) => (
                  <li key={p.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{p.responsable_nombre}</span>
                      <EstadoPrestamoBadge estado={p.estado} vencido={p.vencido} />
                      <span className="ml-auto text-xs text-muted-foreground">
                        {formatFecha(p.fecha_salida, true)}
                        {p.fecha_devolucion && ` → ${formatFecha(p.fecha_devolucion, true)}`}
                      </span>
                    </div>
                    {p.proposito && <p className="mt-1 text-xs text-muted-foreground">{p.proposito}</p>}
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      {p.condicion_salida && <span>Salida: {CONDICION_LABEL[p.condicion_salida]}</span>}
                      {p.condicion_devolucion && <span>Devolución: {CONDICION_LABEL[p.condicion_devolucion]}</span>}
                      {p.entregado_por_nombre && <span>Entregó: {p.entregado_por_nombre}</span>}
                      {p.recibido_por_nombre && <span>Recibió: {p.recibido_por_nombre}</span>}
                    </div>
                    {(p.notas_salida || p.notas_devolucion) && (
                      <p className="mt-1 text-xs">{p.notas_devolucion || p.notas_salida}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {/* Novedades */}
          <TabsContent value="novedades">
            {novedades.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Sin novedades.</p>
            ) : (
              <ul className="space-y-2">
                {novedades.map((n) => (
                  <li key={n.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={n.tipo === "accidente" || n.tipo === "perdida" ? "danger" : "warning"}>
                        {TIPO_NOVEDAD_LABEL[n.tipo]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">Severidad {SEVERIDAD_LABEL[n.severidad]}</span>
                      {n.resuelto && <Badge variant="success">Resuelta</Badge>}
                      <span className="ml-auto text-xs text-muted-foreground">{formatFecha(n.created_at, true)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{n.descripcion}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      {n.costo != null && <span>Costo: {formatMoneda(n.costo)}</span>}
                      {n.reportado_por_nombre && <span>Reportó: {n.reportado_por_nombre}</span>}
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => resolver(n.id, !n.resuelto)}
                          className="ml-auto text-primary hover:underline"
                        >
                          {n.resuelto ? "Reabrir" : "Marcar resuelta"}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {/* Evidencias */}
          <TabsContent value="evidencias">
            <div className="mb-3 flex flex-col items-start gap-2 rounded-lg border border-dashed p-3">
              <p className="text-xs font-medium text-muted-foreground">Agregar foto o video</p>
              <EvidenciaUploader equipoId={equipo.id} momento="general" />
            </div>
            {evidencias.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Sin evidencias.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {evidencias.map((ev) => (
                  <figure key={ev.id} className="group relative overflow-hidden rounded-lg border">
                    {ev.tipo_media === "video" ? (
                      <video src={ev.url ?? undefined} controls className="aspect-video w-full bg-black object-contain" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ev.url ?? undefined} alt={ev.descripcion ?? "Evidencia"} className="aspect-video w-full object-cover" />
                    )}
                    <figcaption className="flex items-center justify-between px-2 py-1 text-[11px] text-muted-foreground">
                      <span>{MOMENTO_EVIDENCIA_LABEL[ev.momento]}</span>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => borrarEvidencia(ev.id)}
                          aria-label="Eliminar evidencia"
                          className="rounded p-0.5 hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
