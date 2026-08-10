"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { TriangleAlert, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { detectarDispositivo } from "@/lib/exif";
import { MINIATURAS_CONCURRENTES, conLimite, miniatura } from "@/lib/thumbnails";
import { mediaKind, tipoContenido, type MediaKind, type TipoContenido } from "@/lib/media-kind";
import { type EquipoCobertura } from "@/lib/equipos-shared";
import { type ArchivoRevisado } from "@/hooks/use-upload-queue";
import { type Fase } from "@/actions/coberturas";
import { CoberturaPreviewCard } from "./cobertura-preview-card";

const FASE_LABEL: Record<Fase, string> = {
  crudo: "Contenido Crudo",
  editado: "Contenido Editado",
  aprobado: "Contenido Aprobado",
};
const FASES: Fase[] = ["crudo", "editado", "aprobado"];

interface Entrada {
  id: string;
  file: File;
  kind: MediaKind;
  tipo: TipoContenido;
  dispositivo: string | null;
  equipoId: string;
  miniaturaUrl: string | null;
  cargando: boolean;
}

/**
 * Revisión en lote antes de subir: qué se está subiendo, de qué equipo es, con
 * qué se grabó y de qué tipo. Sin equipo no arranca la subida — con 200 archivos
 * nadie vuelve a etiquetar después.
 */
export function CoberturaPreviewDialog({
  abierto,
  archivos,
  faseInicial,
  equipos,
  onCancelar,
  onConfirmar,
}: {
  abierto: boolean;
  archivos: File[];
  faseInicial: Fase;
  equipos: EquipoCobertura[];
  onCancelar: () => void;
  onConfirmar: (revisados: ArchivoRevisado[]) => void;
}) {
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [fase, setFase] = useState<Fase>(faseInicial);
  const [equipoLote, setEquipoLote] = useState<string>("");

  /**
   * Las URL de objeto se acumulan aquí, no en el estado: hay que revocarlas al
   * cerrar pase lo que pase, y con 200 archivos no hacerlo tumba la pestaña.
   */
  const urls = useRef<string[]>([]);

  useEffect(() => setFase(faseInicial), [faseInicial]);

  // Arma el lote y, en segundo plano, saca miniatura y dispositivo de cada uno.
  useEffect(() => {
    if (!abierto || archivos.length === 0) return;
    let vivo = true;

    const base: Entrada[] = archivos.map((file, i) => {
      const kind = mediaKind(file.type, file.name);
      return {
        id: `pv-${i}-${file.name}-${file.size}`,
        file,
        kind,
        tipo: tipoContenido(kind),
        dispositivo: null,
        equipoId: "",
        miniaturaUrl: null,
        // Solo imagen y video producen miniatura; el resto no debe girar en vano.
        cargando: kind === "imagen" || kind === "video",
      };
    });
    setEntradas(base);
    setSeleccion(new Set());

    void conLimite(base, MINIATURAS_CONCURRENTES, async (entrada) => {
      const [url, dispositivo] = await Promise.all([
        miniatura(entrada.file, entrada.kind),
        detectarDispositivo(entrada.file, entrada.kind),
      ]);
      if (url) urls.current.push(url);
      if (!vivo) return null;
      setEntradas((prev) =>
        prev.map((e) =>
          e.id === entrada.id ? { ...e, miniaturaUrl: url, dispositivo, cargando: false } : e,
        ),
      );
      return null;
    });

    return () => {
      vivo = false;
    };
  }, [abierto, archivos]);

  // Revoca al cerrar, no al desmontar cada tarjeta: el navegador retiene el
  // blob completo mientras la URL viva.
  useEffect(() => {
    if (abierto) return;
    for (const u of urls.current) URL.revokeObjectURL(u);
    urls.current = [];
    setEntradas([]);
    setSeleccion(new Set());
    setEquipoLote("");
  }, [abierto]);

  const parchear = useCallback((id: string, patch: Partial<Entrada>) => {
    setEntradas((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  /** Sin selección, la acción del lote aplica a todo: es lo que se espera. */
  const destino = useMemo(
    () => (seleccion.size > 0 ? entradas.filter((e) => seleccion.has(e.id)) : entradas),
    [entradas, seleccion],
  );

  const asignarEquipo = (equipoId: string) => {
    setEquipoLote(equipoId);
    if (!equipoId) return;
    const ids = new Set(destino.map((e) => e.id));
    setEntradas((prev) => prev.map((e) => (ids.has(e.id) ? { ...e, equipoId } : e)));
  };

  const quitar = (id: string) => {
    setEntradas((prev) => prev.filter((e) => e.id !== id));
    setSeleccion((prev) => {
      const s = new Set(prev);
      s.delete(id);
      return s;
    });
  };

  const alternar = (id: string, v: boolean) =>
    setSeleccion((prev) => {
      const s = new Set(prev);
      if (v) s.add(id);
      else s.delete(id);
      return s;
    });

  const todosSeleccionados = entradas.length > 0 && seleccion.size === entradas.length;
  const sinEquipo = entradas.filter((e) => !e.equipoId).length;
  const hayEquipos = equipos.length > 0;
  const puedeSubir = entradas.length > 0 && sinEquipo === 0 && hayEquipos;

  const confirmar = () => {
    onConfirmar(
      entradas.map((e) => ({
        file: e.file,
        fase,
        equipoId: e.equipoId,
        tipoContenido: e.tipo,
        dispositivo: e.dispositivo,
      })),
    );
  };

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCancelar()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            Revisar {entradas.length} archivo{entradas.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            Asigna el equipo que produjo el material y confirma el tipo antes de subir.
          </DialogDescription>
        </DialogHeader>

        {!hayEquipos ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <TriangleAlert className="mx-auto mb-2 size-6 text-amber-500" />
            <p className="text-sm font-medium">No hay equipos configurados</p>
            <p className="mt-1 text-xs text-muted-foreground">
              El material se atribuye a un equipo de grabación o fotografía. Crea al menos uno para
              poder subir.
            </p>
            <Link
              href="/dashboard/configuracion"
              className="mt-3 inline-block text-xs font-medium text-primary underline"
            >
              Ir a Configuración
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b pb-3">
              <label className="text-xs text-muted-foreground">Equipo</label>
              <select
                value={equipoLote}
                onChange={(e) => asignarEquipo(e.target.value)}
                className="rounded border bg-background px-2 py-1 text-xs"
              >
                <option value="">Elegir…</option>
                {equipos.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.nombre}
                  </option>
                ))}
              </select>

              <label className="ml-2 text-xs text-muted-foreground">Fase</label>
              <select
                value={fase}
                onChange={(e) => setFase(e.target.value as Fase)}
                className="rounded border bg-background px-2 py-1 text-xs"
              >
                {FASES.map((f) => (
                  <option key={f} value={f}>
                    {FASE_LABEL[f]}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() =>
                  setSeleccion(todosSeleccionados ? new Set() : new Set(entradas.map((e) => e.id)))
                }
                className="ml-2 text-xs text-muted-foreground underline hover:text-foreground"
              >
                {todosSeleccionados ? "Quitar selección" : `Seleccionar todos (${entradas.length})`}
              </button>

              {seleccion.size > 0 && (
                <span className="text-xs text-muted-foreground">
                  · el equipo se aplica a {seleccion.size} seleccionado
                  {seleccion.size === 1 ? "" : "s"}
                </span>
              )}

              {sinEquipo > 0 && (
                <span className="ml-auto flex items-center gap-1 text-xs text-amber-600">
                  <TriangleAlert className="size-3.5" />
                  {sinEquipo} sin equipo
                </span>
              )}
            </div>

            <div className="grid max-h-[55vh] grid-cols-2 gap-2 overflow-y-auto py-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {entradas.map((e) => (
                <CoberturaPreviewCard
                  key={e.id}
                  nombre={e.file.name}
                  size={e.file.size}
                  kind={e.kind}
                  tipo={e.tipo}
                  dispositivo={e.dispositivo}
                  miniaturaUrl={e.miniaturaUrl}
                  cargando={e.cargando}
                  seleccionado={seleccion.has(e.id)}
                  onSeleccionar={(v) => alternar(e.id, v)}
                  onCambiarTipo={(t) => parchear(e.id, { tipo: t })}
                  onQuitar={() => quitar(e.id)}
                />
              ))}
            </div>
          </>
        )}

        <div className="flex items-center justify-end gap-2 border-t pt-3">
          <Button variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={!puedeSubir}
            title={sinEquipo > 0 ? `Faltan ${sinEquipo} archivos por asignar` : undefined}
          >
            <Upload className="mr-1.5 size-4" />
            Subir {entradas.length} archivo{entradas.length === 1 ? "" : "s"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
