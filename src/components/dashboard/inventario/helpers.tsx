import { Badge } from "@/components/ui/badge";
import {
  ESTADO_EQUIPO_LABEL,
  ESTADO_EQUIPO_TONO,
  ESTADO_PRESTAMO_LABEL,
  type EstadoEquipo,
  type EstadoPrestamo,
} from "@/lib/inventario-shared";

/** Insignia del estado de un equipo con su tono. */
export function EstadoEquipoBadge({ estado }: { estado: EstadoEquipo }) {
  return <Badge variant={ESTADO_EQUIPO_TONO[estado]}>{ESTADO_EQUIPO_LABEL[estado]}</Badge>;
}

/** Insignia del estado de un préstamo. `vencido` la pinta en rojo aunque siga activo. */
export function EstadoPrestamoBadge({
  estado,
  vencido = false,
}: {
  estado: EstadoPrestamo;
  vencido?: boolean;
}) {
  if (vencido && estado === "activo") return <Badge variant="danger">Vencido</Badge>;
  const tono =
    estado === "activo" ? "warning" : estado === "devuelto" ? "success" : estado === "rechazado" ? "muted" : "secondary";
  return <Badge variant={tono}>{ESTADO_PRESTAMO_LABEL[estado]}</Badge>;
}

export function formatFecha(iso: string | null, conHora = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(conHora ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function formatMoneda(valor: number | null): string {
  if (valor == null) return "—";
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}
