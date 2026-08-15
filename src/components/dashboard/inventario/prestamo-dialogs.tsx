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
import { registrarDevolucion, registrarEntrega, solicitarPrestamo } from "@/actions/inventario";
import {
  CONDICIONES,
  CONDICION_LABEL,
  ESTADO_EQUIPO_LABEL,
  type ChecklistItem,
  type Condicion,
  type EquipoInventario,
  type ParteEquipo,
  type PrestamoInventario,
  type UsuarioInventario,
} from "@/lib/inventario-shared";
import { EvidenciaUploader } from "./evidencia-uploader";

/** Checklist de partes marcables. */
function Checklist({
  items,
  onToggle,
}: {
  items: ChecklistItem[];
  onToggle: (parteId: string, incluida: boolean) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Piezas del kit</p>
      <div className="space-y-1.5">
        {items.map((it) => (
          <label key={it.parte_id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={it.incluida}
              onChange={(e) => onToggle(it.parte_id, e.target.checked)}
              className="size-4 rounded border-input"
            />
            {it.nombre}
          </label>
        ))}
      </div>
    </div>
  );
}

function condSelect(value: string, onChange: (v: string) => void, id: string) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
    >
      {CONDICIONES.map((c) => (
        <option key={c} value={c}>{CONDICION_LABEL[c]}</option>
      ))}
    </select>
  );
}

/* ─────────────────────────────── Entrega ─────────────────────────────── */

export function EntregaDialog({
  open,
  onOpenChange,
  equipo,
  partes,
  usuarios,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  equipo: EquipoInventario;
  partes: ParteEquipo[];
  usuarios: UsuarioInventario[];
}) {
  const router = useRouter();
  const [responsable, setResponsable] = useState("");
  const [fechaPrevista, setFechaPrevista] = useState("");
  const [proposito, setProposito] = useState("");
  const [condicion, setCondicion] = useState<Condicion>("bueno");
  const [notas, setNotas] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [nuevoPrestamoId, setNuevoPrestamoId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (open) {
      setResponsable("");
      setFechaPrevista("");
      setProposito("");
      setCondicion(equipo.condicion);
      setNotas("");
      setChecklist(partes.map((p) => ({ parte_id: p.id, nombre: p.nombre, incluida: true })));
      setNuevoPrestamoId(null);
    }
  }, [open, equipo, partes]);

  const toggle = (parteId: string, incluida: boolean) =>
    setChecklist((cl) => cl.map((it) => (it.parte_id === parteId ? { ...it, incluida } : it)));

  const entregar = () => {
    if (!responsable) {
      toast.error("Elige a quién se le entrega.");
      return;
    }
    start(async () => {
      const res = await registrarEntrega({
        equipo_id: equipo.id,
        responsable_id: responsable,
        proposito,
        fecha_prevista: fechaPrevista || null,
        condicion_salida: condicion,
        checklist_salida: checklist,
        notas_salida: notas,
      });
      if (res.ok && res.data) {
        toast.success(res.message);
        setNuevoPrestamoId(res.data.id);
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
          <DialogTitle>Entregar «{equipo.nombre}»</DialogTitle>
          <DialogDescription>
            Registra a quién sale, en qué condición y con qué piezas. Podrás grabar un video de la entrega.
          </DialogDescription>
        </DialogHeader>

        {nuevoPrestamoId ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
            <div>
              <p className="font-semibold">Entrega registrada</p>
              <p className="text-sm text-muted-foreground">
                Graba o sube un video/foto de cómo se entrega el equipo (opcional).
              </p>
            </div>
            <div className="flex justify-center">
              <EvidenciaUploader equipoId={equipo.id} momento="entrega" prestamoId={nuevoPrestamoId} size="default" />
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Finalizar</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <Label htmlFor="ent-resp">Se entrega a *</Label>
                <select
                  id="ent-resp"
                  value={responsable}
                  onChange={(e) => setResponsable(e.target.value)}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                >
                  <option value="">Elegir persona…</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>{u.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="ent-fecha">Devolución prevista</Label>
                  <Input id="ent-fecha" type="date" value={fechaPrevista} onChange={(e) => setFechaPrevista(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="ent-cond">Condición de salida</Label>
                  {condSelect(condicion, (v) => setCondicion(v as Condicion), "ent-cond")}
                </div>
              </div>

              <div>
                <Label htmlFor="ent-prop">Propósito</Label>
                <Input id="ent-prop" value={proposito} onChange={(e) => setProposito(e.target.value)} placeholder="Cobertura plaza central" />
              </div>

              <Checklist items={checklist} onToggle={toggle} />

              <div>
                <Label htmlFor="ent-notas">Notas de la entrega</Label>
                <Textarea id="ent-notas" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button onClick={entregar} disabled={pending || !responsable}>
                Registrar entrega
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────── Solicitud ─────────────────────────────── */

/** Cualquier miembro del staff puede pedir un equipo disponible. */
export function SolicitudDialog({
  open,
  onOpenChange,
  equipos,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  equipos: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [equipoId, setEquipoId] = useState("");
  const [fechaPrevista, setFechaPrevista] = useState("");
  const [proposito, setProposito] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (open) {
      setEquipoId("");
      setFechaPrevista("");
      setProposito("");
    }
  }, [open]);

  const enviar = () => {
    if (!equipoId) {
      toast.error("Elige un equipo.");
      return;
    }
    start(async () => {
      const res = await solicitarPrestamo({
        equipo_id: equipoId,
        proposito,
        fecha_prevista: fechaPrevista || null,
      });
      if (res.ok) {
        toast.success(res.message);
        onOpenChange(false);
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
          <DialogTitle>Solicitar un equipo</DialogTitle>
          <DialogDescription>Un gestor revisará tu solicitud y te entregará el equipo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="sol-equipo">Equipo *</Label>
            <select
              id="sol-equipo"
              value={equipoId}
              onChange={(e) => setEquipoId(e.target.value)}
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
            >
              <option value="">Elegir equipo…</option>
              {equipos.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="sol-fecha">Fecha en que lo necesitas devolver</Label>
            <Input id="sol-fecha" type="date" value={fechaPrevista} onChange={(e) => setFechaPrevista(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="sol-prop">¿Para qué lo necesitas?</Label>
            <Textarea id="sol-prop" rows={2} value={proposito} onChange={(e) => setProposito(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={pending || !equipoId}>
            Enviar solicitud
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────── Devolución ─────────────────────────────── */

export function DevolucionDialog({
  open,
  onOpenChange,
  prestamo,
  partes,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prestamo: PrestamoInventario;
  partes: ParteEquipo[];
}) {
  const router = useRouter();
  const [condicion, setCondicion] = useState<Condicion>("bueno");
  const [notas, setNotas] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [aMantenimiento, setAMantenimiento] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (open) {
      setCondicion("bueno");
      setNotas("");
      setAMantenimiento(false);
      // Parte por parte: arranca de lo que salió, o de las partes del equipo.
      const base =
        prestamo.checklist_salida ?? partes.map((p) => ({ parte_id: p.id, nombre: p.nombre, incluida: true }));
      setChecklist(base.map((it) => ({ ...it, incluida: true })));
    }
  }, [open, prestamo, partes]);

  const toggle = (parteId: string, incluida: boolean) =>
    setChecklist((cl) => cl.map((it) => (it.parte_id === parteId ? { ...it, incluida } : it)));

  const devolver = () => {
    start(async () => {
      const res = await registrarDevolucion(prestamo.id, {
        condicion_devolucion: condicion,
        checklist_devolucion: checklist,
        notas_devolucion: notas,
        estado_equipo: aMantenimiento ? "mantenimiento" : null,
      });
      if (res.ok) {
        toast.success(res.message);
        onOpenChange(false);
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
          <DialogTitle>Recibir «{prestamo.equipo_nombre}»</DialogTitle>
          <DialogDescription>
            De {prestamo.responsable_nombre}. Verifica la condición y las piezas, y graba cómo se recibe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-col items-start gap-2 rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">Video/foto de la recepción</p>
            <EvidenciaUploader equipoId={prestamo.equipo_id} momento="recepcion" prestamoId={prestamo.id} />
          </div>

          <div>
            <Label htmlFor="dev-cond">Condición al recibir</Label>
            {condSelect(condicion, (v) => setCondicion(v as Condicion), "dev-cond")}
            {condicion === "malo" && (
              <p className="mt-1 text-[11px] text-amber-600">
                El equipo quedará marcado como «{ESTADO_EQUIPO_LABEL.danado}».
              </p>
            )}
          </div>

          <Checklist items={checklist} onToggle={toggle} />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={aMantenimiento}
              onChange={(e) => setAMantenimiento(e.target.checked)}
              className="size-4 rounded border-input"
            />
            Enviar a mantenimiento (no queda disponible)
          </label>

          <div>
            <Label htmlFor="dev-notas">Notas de la devolución</Label>
            <Textarea id="dev-notas" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={devolver} disabled={pending}>
            Registrar devolución
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
