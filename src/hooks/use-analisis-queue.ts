"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { analizarArchivo, listarPendientesAnalisis, registrarTandaAnalisis } from "@/actions/analisis";
import { type ResultadoArchivo } from "@/actions/analisis";

/**
 * Dos a la vez: cada análisis es una llamada a un modelo, no ancho de banda.
 * Más paralelismo no acelera nada y sí multiplica el gasto por minuto.
 */
const CONCURRENCIA = 2;

/** Espera antes de reintentar cuando Drive todavía no generó la miniatura. */
const ESPERA_MINIATURA_MS = 15_000;
const REINTENTOS_MINIATURA = 2;

export type EstadoAnalisis = "espera" | "analizando" | "listo" | "error" | "omitido";

export interface ItemAnalisis {
  fileId: string;
  nombre: string;
  estado: EstadoAnalisis;
  message?: string;
  /** Reintentos gastados esperando la miniatura de Drive. */
  esperas: number;
}

/**
 * Cola de análisis del material. Va detrás de la de subida: en cuanto un archivo
 * queda registrado se encola aquí, y el tablero sigue usable mientras tanto.
 */
export function useAnalisisQueue(
  coberturaId: string,
  onAnalizado: (resultado: ResultadoArchivo) => void,
) {
  const [items, setItems] = useState<ItemAnalisis[]>([]);
  const iniciados = useRef(new Set<string>());
  const enCurso = useRef(0);
  const temporizadores = useRef(new Set<ReturnType<typeof setTimeout>>());

  const parchear = useCallback((fileId: string, patch: Partial<ItemAnalisis>) => {
    setItems((prev) => prev.map((i) => (i.fileId === fileId ? { ...i, ...patch } : i)));
  }, []);

  const encolar = useCallback((nuevos: { fileId: string; nombre: string }[]) => {
    if (nuevos.length === 0) return 0;
    let agregados = 0;
    setItems((prev) => {
      const conocidos = new Set(prev.map((i) => i.fileId));
      const añadir = nuevos
        .filter((n) => !conocidos.has(n.fileId))
        .map<ItemAnalisis>((n) => ({ fileId: n.fileId, nombre: n.nombre, estado: "espera", esperas: 0 }));
      agregados = añadir.length;
      return añadir.length > 0 ? [...prev, ...añadir] : prev;
    });
    return agregados;
  }, []);

  const ejecutar = useCallback(
    async (item: ItemAnalisis) => {
      try {
        const res = await analizarArchivo(item.fileId);

        if (res.ok) {
          onAnalizado(res.data);
          parchear(item.fileId, { estado: "listo" });
          return;
        }

        if (res.estado === "omitido") {
          parchear(item.fileId, { estado: "omitido", message: res.message });
          return;
        }

        // Drive todavía no generó la miniatura: no es un fallo del análisis, así
        // que se espera y se reintenta un par de veces antes de darlo por perdido.
        if (res.estado === "pendiente" && item.esperas < REINTENTOS_MINIATURA) {
          parchear(item.fileId, { estado: "espera", esperas: item.esperas + 1, message: res.message });
          iniciados.current.delete(item.fileId);
          const t = setTimeout(() => {
            temporizadores.current.delete(t);
            // Un cambio de estado despierta al efecto, que lo vuelve a tomar.
            setItems((prev) => [...prev]);
          }, ESPERA_MINIATURA_MS);
          temporizadores.current.add(t);
          return;
        }

        parchear(item.fileId, { estado: "error", message: res.message });
      } catch {
        parchear(item.fileId, { estado: "error", message: "No se pudo analizar." });
      } finally {
        enCurso.current = Math.max(0, enCurso.current - 1);
      }
    },
    [onAnalizado, parchear],
  );

  useEffect(() => {
    if (enCurso.current >= CONCURRENCIA) return;
    const siguiente = items.find((i) => i.estado === "espera" && !iniciados.current.has(i.fileId));
    if (!siguiente) return;

    iniciados.current.add(siguiente.fileId);
    enCurso.current += 1;
    parchear(siguiente.fileId, { estado: "analizando" });
    void ejecutar(siguiente);
  }, [items, ejecutar, parchear]);

  // Los temporizadores de reintento no deben disparar sobre un componente ido.
  useEffect(() => {
    const pendientes = temporizadores.current;
    return () => {
      for (const t of pendientes) clearTimeout(t);
      pendientes.clear();
    };
  }, []);

  /** Relanza todo lo que quedó sin analizar en la cobertura. */
  const analizarPendientes = useCallback(async (): Promise<number> => {
    const ids = await listarPendientesAnalisis(coberturaId);
    for (const id of ids) iniciados.current.delete(id);
    setItems((prev) => {
      const previos = new Map(prev.map((i) => [i.fileId, i]));
      return ids.map<ItemAnalisis>((id) => ({
        fileId: id,
        nombre: previos.get(id)?.nombre ?? "Archivo",
        estado: "espera",
        esperas: 0,
      }));
    });
    return ids.length;
  }, [coberturaId]);

  const activos = items.filter((i) => i.estado === "espera" || i.estado === "analizando").length;
  const listos = items.filter((i) => i.estado === "listo").length;
  const conError = items.filter((i) => i.estado === "error").length;

  // Al vaciarse la cola se deja constancia de la tanda; sin esto no queda
  // rastro de cuánto material se analizó ni de cuánto falló.
  const anunciado = useRef(false);
  useEffect(() => {
    if (activos > 0) {
      anunciado.current = false;
      return;
    }
    if (anunciado.current || items.length === 0) return;
    anunciado.current = true;
    void registrarTandaAnalisis(coberturaId, listos, conError);
  }, [activos, listos, conError, items.length, coberturaId]);

  return { items, activos, listos, conError, encolar, analizarPendientes };
}
