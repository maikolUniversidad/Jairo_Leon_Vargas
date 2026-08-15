"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { addNovedad } from "@/actions/inventario";
import {
  ESTADOS_EQUIPO,
  ESTADO_EQUIPO_LABEL,
  SEVERIDADES,
  SEVERIDAD_LABEL,
  TIPOS_NOVEDAD,
  TIPO_NOVEDAD_LABEL,
  type Severidad,
  type TipoNovedad,
} from "@/lib/inventario-shared";
import { EvidenciaUploader } from "./evidencia-uploader";

/** Registra una novedad (accidente, daño, mantenimiento, pérdida…) sobre un equipo. */
export function NovedadDialog({
  open,
  onOpenChange,
  equipos,
  equipoInicial,
  canManage,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  equipos: { id: string; nombre: string }[];
  equipoInicial?: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [equipoId, setEquipoId] = useState("");
  const [tipo, setTipo] = useState<TipoNovedad>("accidente");
  const [severidad, setSeveridad] = useState<Severidad>("media");
  const [descripcion, setDescripcion] = useState("");
  const [costo, setCosto] = useState("");
  const [estadoEquipo, setEstadoEquipo] = useState("");
  const [creada, setCreada] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (open) {
      setEquipoId(equipoInicial ?? "");
      setTipo("accidente");
      setSeveridad("media");
      setDescripcion("");
      setCosto("");
      setEstadoEquipo("");
      setCreada(null);
    }
  }, [open, equipoInicial]);

  const guardar = () => {
    if (!equipoId) {
      toast.error("Elige un equipo.");
      return;
    }
    start(async () => {
      const res = await addNovedad({
        equipo_id: equipoId,
        tipo,
        severidad,
        descripcion,
        costo: costo.trim() === "" ? null : costo,
        estado_equipo: canManage && estadoEquipo ? estadoEquipo : null,
      });
      if (res.ok) {
        toast.success(res.message);
        if (res.data) setCreada(res.data.id);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar novedad</DialogTitle>
          <DialogDescription>
            Accidentes, daños, mantenimiento o pérdidas. Podrás adjuntar fotos o video.
          </DialogDescription>
        </DialogHeader>

        {creada ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
            <div>
              <p className="font-semibold">Novedad registrada</p>
              <p className="text-sm text-muted-foreground">Adjunta evidencia del hecho (opcional).</p>
            </div>
            <div className="flex justify-center">
              <EvidenciaUploader equipoId={equipoId} momento="accidente" novedadId={creada} size="default" />
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Finalizar</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <Label htmlFor="nov-equipo">Equipo *</Label>
                <select
                  id="nov-equipo"
                  value={equipoId}
                  onChange={(e) => setEquipoId(e.target.value)}
                  disabled={Boolean(equipoInicial)}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm disabled:opacity-70"
                >
                  <option value="">Elegir equipo…</option>
                  {equipos.map((e) => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="nov-tipo">Tipo</Label>
                  <select
                    id="nov-tipo"
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as TipoNovedad)}
                    className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                  >
                    {TIPOS_NOVEDAD.map((t) => (
                      <option key={t} value={t}>{TIPO_NOVEDAD_LABEL[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="nov-sev">Severidad</Label>
                  <select
                    id="nov-sev"
                    value={severidad}
                    onChange={(e) => setSeveridad(e.target.value as Severidad)}
                    className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                  >
                    {SEVERIDADES.map((s) => (
                      <option key={s} value={s}>{SEVERIDAD_LABEL[s]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="nov-desc">Descripción *</Label>
                <Textarea
                  id="nov-desc"
                  rows={3}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="¿Qué pasó? ¿Cómo y cuándo?"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="nov-costo">Costo estimado (COP)</Label>
                  <Input id="nov-costo" type="number" min={0} value={costo} onChange={(e) => setCosto(e.target.value)} placeholder="0" />
                </div>
                {canManage && (
                  <div>
                    <Label htmlFor="nov-estado">Dejar el equipo como…</Label>
                    <select
                      id="nov-estado"
                      value={estadoEquipo}
                      onChange={(e) => setEstadoEquipo(e.target.value)}
                      className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                    >
                      <option value="">Sin cambio</option>
                      {ESTADOS_EQUIPO.filter((s) => s !== "prestado").map((s) => (
                        <option key={s} value={s}>{ESTADO_EQUIPO_LABEL[s]}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button onClick={guardar} disabled={pending || descripcion.trim().length < 3}>
                Registrar novedad
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
