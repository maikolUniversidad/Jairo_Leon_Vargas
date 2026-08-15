"use client";

import { useMemo } from "react";
import { AlertTriangle, Boxes, CheckCircle2, Clock, PackageOpen } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/dashboard/shared";
import { useTabParam } from "@/hooks/use-tab-param";
import type {
  EquipoConResumen,
  InventarioStats,
  NovedadInventario,
  PrestamoInventario,
  UsuarioInventario,
} from "@/lib/inventario-shared";
import { EquiposPanel } from "./equipos-panel";
import { PrestamosPanel } from "./prestamos-panel";
import { NovedadesPanel } from "./novedades-panel";

const VISTAS = ["equipos", "prestamos", "novedades"] as const;

export function InventarioManager({
  equipos,
  prestamos,
  novedades,
  usuarios,
  stats,
  canManage,
}: {
  equipos: EquipoConResumen[];
  prestamos: PrestamoInventario[];
  novedades: NovedadInventario[];
  usuarios: UsuarioInventario[];
  stats: InventarioStats;
  canManage: boolean;
}) {
  const [vista, setVista] = useTabParam("vista", VISTAS[0], VISTAS);

  const equiposMin = useMemo(() => equipos.map((e) => ({ id: e.id, nombre: e.nombre })), [equipos]);
  const equiposPrestamo = useMemo(
    () => equipos.map((e) => ({ id: e.id, nombre: e.nombre, disponible: e.activo && e.estado === "disponible" })),
    [equipos],
  );

  return (
    <div className="space-y-5">
      {/* Estadísticas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Equipos" value={stats.total} icon={Boxes} tone="primary" />
        <StatCard label="Disponibles" value={stats.disponibles} icon={CheckCircle2} tone="success" />
        <StatCard label="En préstamo" value={stats.prestados} icon={PackageOpen} tone="warning" />
        <StatCard label="Mantenimiento / daño" value={stats.mantenimiento} icon={AlertTriangle} tone="warning" />
        <StatCard label="Préstamos vencidos" value={stats.vencidos} icon={Clock} tone={stats.vencidos > 0 ? "warning" : "default"} />
      </div>

      {/* Selector de vista (en móvil la navegación vive en la barra inferior) */}
      <Tabs value={vista} onValueChange={(v) => setVista(v as (typeof VISTAS)[number])}>
        <TabsList className="hidden lg:inline-flex">
          <TabsTrigger value="equipos">Equipos</TabsTrigger>
          <TabsTrigger value="prestamos">Préstamos</TabsTrigger>
          <TabsTrigger value="novedades">
            Novedades
            {stats.novedades_abiertas > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500/90 px-1.5 text-[10px] font-semibold text-white">
                {stats.novedades_abiertas}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {vista === "equipos" && (
        <EquiposPanel equipos={equipos} usuarios={usuarios} canManage={canManage} />
      )}
      {vista === "prestamos" && (
        <PrestamosPanel prestamos={prestamos} equipos={equiposPrestamo} canManage={canManage} />
      )}
      {vista === "novedades" && (
        <NovedadesPanel novedades={novedades} equipos={equiposMin} canManage={canManage} />
      )}
    </div>
  );
}
