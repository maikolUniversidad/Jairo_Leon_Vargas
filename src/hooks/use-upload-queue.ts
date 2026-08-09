"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { subirArchivoCobertura } from "@/lib/upload-cobertura";
import { type CoberturaFile, type Fase } from "@/actions/coberturas";

/** Tres subidas a la vez: aprovecha el ancho de banda sin ahogar la conexión. */
const CONCURRENCIA = 3;

export type EstadoSubida = "espera" | "subiendo" | "listo" | "error" | "cancelado";

export interface ItemSubida {
  id: string;
  nombre: string;
  fase: Fase;
  size: number;
  estado: EstadoSubida;
  /** 0–100, redondeado: evita re-renderizar el panel con cada evento del XHR. */
  progreso: number;
  message?: string;
}

interface Pendiente {
  file: File;
  controller: AbortController;
}

/**
 * Cola de subidas con progreso por archivo. Vive por encima del tablero para
 * que se pueda seguir trabajando —mover tarjetas, editar fichas— mientras un
 * levantamiento entero se sube de fondo.
 */
export function useUploadQueue(
  coberturaId: string,
  onSubido: (file: CoberturaFile) => void,
) {
  const [items, setItems] = useState<ItemSubida[]>([]);
  const pendientes = useRef(new Map<string, Pendiente>());
  const contador = useRef(0);
  /**
   * Control de arranque por referencia, no por estado: `setItems` no se aplica
   * hasta el siguiente render, así que dos renders seguidos —o el doble efecto
   * del modo estricto— podrían lanzar dos veces el mismo archivo.
   */
  const iniciados = useRef(new Set<string>());
  const enCurso = useRef(0);

  const parchear = useCallback((id: string, patch: Partial<ItemSubida>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const encolar = useCallback((files: File[], fase: Fase) => {
    const nuevos: ItemSubida[] = [];
    for (const file of files) {
      if (file.size === 0) continue; // las carpetas llegan como entradas vacías
      const id = `up-${++contador.current}`;
      pendientes.current.set(id, { file, controller: new AbortController() });
      nuevos.push({
        id,
        nombre: file.name,
        fase,
        size: file.size,
        estado: "espera",
        progreso: 0,
      });
    }
    if (nuevos.length > 0) setItems((prev) => [...prev, ...nuevos]);
    return nuevos.length;
  }, []);

  const ejecutar = useCallback(
    async (item: ItemSubida) => {
      const pendiente = pendientes.current.get(item.id);
      if (!pendiente) return;

      let ultimo = 0;
      try {
        const res = await subirArchivoCobertura(coberturaId, item.fase, pendiente.file, {
          signal: pendiente.controller.signal,
          onProgress: (f) => {
            const pct = Math.round(f * 100);
            if (pct !== ultimo) {
              ultimo = pct;
              parchear(item.id, { progreso: pct });
            }
          },
        });

        if (res.ok && res.file) {
          pendientes.current.delete(item.id);
          onSubido(res.file);
          parchear(item.id, { estado: "listo", progreso: 100 });
        } else if (res.cancelado) {
          pendientes.current.delete(item.id);
          parchear(item.id, { estado: "cancelado", message: res.message });
        } else {
          // Se conserva el File para poder reintentar sin volver a elegirlo.
          parchear(item.id, { estado: "error", message: res.message ?? "No se pudo subir." });
        }
      } finally {
        // Libera el hueco pase lo que pase; el cambio de estado despierta al
        // efecto, que arranca el siguiente de la cola.
        enCurso.current = Math.max(0, enCurso.current - 1);
      }
    },
    [coberturaId, onSubido, parchear],
  );

  // Cada cambio de estado abre un hueco: el efecto arranca el siguiente en
  // espera hasta llenar la concurrencia, y vuelve a correr al terminar cada uno.
  useEffect(() => {
    if (enCurso.current >= CONCURRENCIA) return;
    const siguiente = items.find((i) => i.estado === "espera" && !iniciados.current.has(i.id));
    if (!siguiente) return;

    iniciados.current.add(siguiente.id);
    enCurso.current += 1;
    parchear(siguiente.id, { estado: "subiendo" });
    void ejecutar({ ...siguiente, estado: "subiendo" });
  }, [items, ejecutar, parchear]);

  const cancelar = useCallback((id: string) => {
    pendientes.current.get(id)?.controller.abort();
    setItems((prev) =>
      prev.map((i) =>
        i.id === id && (i.estado === "espera" || i.estado === "subiendo")
          ? { ...i, estado: "cancelado", message: "Cancelada." }
          : i,
      ),
    );
  }, []);

  const reintentar = useCallback((id: string) => {
    const pendiente = pendientes.current.get(id);
    if (!pendiente) return;
    // El AbortController anterior puede estar disparado; se renueva.
    pendientes.current.set(id, { file: pendiente.file, controller: new AbortController() });
    iniciados.current.delete(id);
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, estado: "espera", progreso: 0, message: undefined } : i,
      ),
    );
  }, []);

  const limpiarTerminados = useCallback(() => {
    setItems((prev) => {
      for (const i of prev) {
        if (i.estado === "listo" || i.estado === "cancelado") {
          pendientes.current.delete(i.id);
          iniciados.current.delete(i.id);
        }
      }
      return prev.filter((i) => i.estado !== "listo" && i.estado !== "cancelado");
    });
  }, []);

  const activos = items.filter((i) => i.estado === "espera" || i.estado === "subiendo").length;
  const conError = items.filter((i) => i.estado === "error").length;

  return { items, activos, conError, encolar, cancelar, reintentar, limpiarTerminados };
}
