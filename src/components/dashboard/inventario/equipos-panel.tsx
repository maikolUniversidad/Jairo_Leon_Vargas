"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle, Boxes, PackageOpen, Plus, Puzzle, Search, Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/shared";
import { getEquipoDetalle } from "@/actions/inventario";
import {
  CATEGORIAS_EQUIPO,
  CATEGORIA_LABEL,
  ESTADOS_EQUIPO,
  ESTADO_EQUIPO_LABEL,
  type EquipoConResumen,
  type EquipoDetalle,
  type EquipoInventario,
  type ParteEquipo,
  type PrestamoInventario,
  type UsuarioInventario,
} from "@/lib/inventario-shared";
import { EstadoEquipoBadge } from "./helpers";
import { EquipoFormDialog } from "./equipo-form-dialog";
import { EquipoDetailDialog } from "./equipo-detail-dialog";
import { EntregaDialog, DevolucionDialog } from "./prestamo-dialogs";
import { NovedadDialog } from "./novedad-dialog";

export function EquiposPanel({
  equipos,
  usuarios,
  canManage,
}: {
  equipos: EquipoConResumen[];
  usuarios: UsuarioInventario[];
  canManage: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [fCategoria, setFCategoria] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [cargando, setCargando] = useState<string | null>(null);

  // Diálogos
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<EquipoInventario | null>(null);
  const [detalle, setDetalle] = useState<EquipoDetalle | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [entrega, setEntrega] = useState<{ equipo: EquipoInventario; partes: ParteEquipo[] } | null>(null);
  const [devolucion, setDevolucion] = useState<{ prestamo: PrestamoInventario; partes: ParteEquipo[] } | null>(null);
  const [novedadEquipo, setNovedadEquipo] = useState<string | null>(null);
  const [novedadOpen, setNovedadOpen] = useState(false);

  const equiposMin = useMemo(() => equipos.map((e) => ({ id: e.id, nombre: e.nombre })), [equipos]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return equipos.filter((e) => {
      if (fCategoria && e.categoria !== fCategoria) return false;
      if (fEstado && e.estado !== fEstado) return false;
      if (!q) return true;
      return [e.nombre, e.codigo, e.marca, e.modelo, e.serial]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [equipos, busqueda, fCategoria, fEstado]);

  const cargarDetalle = async (id: string): Promise<EquipoDetalle | null> => {
    setCargando(id);
    try {
      return await getEquipoDetalle(id);
    } finally {
      setCargando(null);
    }
  };

  const verFicha = async (id: string) => {
    const d = await cargarDetalle(id);
    if (d) {
      setDetalle(d);
      setDetailOpen(true);
    }
  };

  const prestar = async (id: string) => {
    const d = await cargarDetalle(id);
    if (d) setEntrega({ equipo: d.equipo, partes: d.partes });
  };

  const recibir = async (id: string) => {
    const d = await cargarDetalle(id);
    const activo = d?.prestamos.find((p) => p.estado === "activo");
    if (d && activo) setDevolucion({ prestamo: activo, partes: d.partes });
  };

  const nuevo = () => {
    setEditando(null);
    setFormOpen(true);
  };

  const abrirNovedad = (id: string | null) => {
    setNovedadEquipo(id);
    setNovedadOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, código, marca…"
            className="pl-9"
          />
        </div>
        <select
          value={fCategoria}
          onChange={(e) => setFCategoria(e.target.value)}
          className="h-10 rounded-lg border bg-background px-2 text-sm"
          aria-label="Filtrar por categoría"
        >
          <option value="">Todas las categorías</option>
          {CATEGORIAS_EQUIPO.map((c) => (
            <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>
          ))}
        </select>
        <select
          value={fEstado}
          onChange={(e) => setFEstado(e.target.value)}
          className="h-10 rounded-lg border bg-background px-2 text-sm"
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {ESTADOS_EQUIPO.map((s) => (
            <option key={s} value={s}>{ESTADO_EQUIPO_LABEL[s]}</option>
          ))}
        </select>
        {canManage && (
          <Button onClick={nuevo}>
            <Plus className="mr-1 size-4" /> Nuevo equipo
          </Button>
        )}
      </div>

      {/* Grid */}
      {filtrados.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title={equipos.length === 0 ? "Sin equipos en el inventario" : "Nada coincide con el filtro"}
          description={
            equipos.length === 0
              ? canManage
                ? "Registra el primer equipo para empezar a gestionar préstamos y novedades."
                : "Aún no hay equipos registrados."
              : "Ajusta la búsqueda o los filtros."
          }
        >
          {equipos.length === 0 && canManage && (
            <Button onClick={nuevo}>
              <Plus className="mr-1 size-4" /> Nuevo equipo
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((e) => (
            <Card key={e.id} className={e.activo ? "" : "opacity-60"}>
              <CardContent className="space-y-2 p-4">
                <button type="button" onClick={() => verFicha(e.id)} className="block w-full text-left">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{e.nombre}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {CATEGORIA_LABEL[e.categoria]}
                        {e.codigo && ` · ${e.codigo}`}
                        {e.marca && ` · ${e.marca}`}
                      </p>
                    </div>
                    <EstadoEquipoBadge estado={e.estado} />
                  </div>
                </button>

                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Puzzle className="size-3" /> {e.partes_total} partes
                    {e.partes_incompletas > 0 && <span className="text-amber-600">({e.partes_incompletas} con novedad)</span>}
                  </span>
                  {e.novedades_abiertas > 0 && (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="size-3" /> {e.novedades_abiertas} novedad(es)
                    </span>
                  )}
                </div>

                {e.prestamo_activo && (
                  <p className={`text-xs ${e.prestamo_activo.vencido ? "text-destructive" : "text-muted-foreground"}`}>
                    Con {e.prestamo_activo.responsable_nombre}
                    {e.prestamo_activo.vencido && " · vencido"}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => verFicha(e.id)} disabled={cargando === e.id}>
                    Ver ficha
                  </Button>
                  {canManage && e.activo && e.estado === "disponible" && (
                    <Button size="sm" onClick={() => prestar(e.id)} disabled={cargando === e.id}>
                      <PackageOpen className="mr-1 size-4" /> Prestar
                    </Button>
                  )}
                  {canManage && e.estado === "prestado" && (
                    <Button size="sm" onClick={() => recibir(e.id)} disabled={cargando === e.id}>
                      <Undo2 className="mr-1 size-4" /> Recibir
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ─── Diálogos ─── */}
      <EquipoFormDialog open={formOpen} onOpenChange={setFormOpen} equipo={editando} />

      {detalle && (
        <EquipoDetailDialog
          open={detailOpen}
          onOpenChange={setDetailOpen}
          detalle={detalle}
          canManage={canManage}
          onEdit={() => {
            setDetailOpen(false);
            setEditando(detalle.equipo);
            setFormOpen(true);
          }}
          onPrestar={() => {
            setDetailOpen(false);
            setEntrega({ equipo: detalle.equipo, partes: detalle.partes });
          }}
          onRecibir={() => {
            const activo = detalle.prestamos.find((p) => p.estado === "activo");
            if (activo) {
              setDetailOpen(false);
              setDevolucion({ prestamo: activo, partes: detalle.partes });
            }
          }}
          onNovedad={() => {
            setDetailOpen(false);
            abrirNovedad(detalle.equipo.id);
          }}
        />
      )}

      {entrega && (
        <EntregaDialog
          open={Boolean(entrega)}
          onOpenChange={(v) => !v && setEntrega(null)}
          equipo={entrega.equipo}
          partes={entrega.partes}
          usuarios={usuarios}
        />
      )}

      {devolucion && (
        <DevolucionDialog
          open={Boolean(devolucion)}
          onOpenChange={(v) => !v && setDevolucion(null)}
          prestamo={devolucion.prestamo}
          partes={devolucion.partes}
        />
      )}

      <NovedadDialog
        open={novedadOpen}
        onOpenChange={setNovedadOpen}
        equipos={equiposMin}
        equipoInicial={novedadEquipo}
        canManage={canManage}
      />
    </div>
  );
}
