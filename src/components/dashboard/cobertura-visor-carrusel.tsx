"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, FileQuestion } from "lucide-react";

import { mediaKind, tieneMiniatura, type MediaKind } from "@/lib/media-kind";

/**
 * Forma mínima que necesita el visor. Se declara aquí en vez de importar
 * `CoberturaFile` para que el carrusel no dependa de cómo evolucione la ficha:
 * cualquier objeto con estos campos encaja.
 */
export interface PiezaVisor {
  id: string;
  fase: "crudo" | "editado" | "aprobado";
  nombre: string;
  mime?: string | null;
  url: string;
  drive_file_id?: string | null;
  storage_path?: string | null;
}

/** El marco dice en qué fase está la pieza sin tener que leer nada. */
const MARCO: Record<PiezaVisor["fase"], { anillo: string; punto: string; label: string }> = {
  crudo: { anillo: "ring-amber-400", punto: "bg-amber-400", label: "Contenido Crudo" },
  editado: { anillo: "ring-blue-400", punto: "bg-blue-400", label: "Contenido Editado" },
  aprobado: { anillo: "ring-emerald-500", punto: "bg-emerald-500", label: "Contenido Aprobado" },
};

const ORDEN_FASES: PiezaVisor["fase"][] = ["crudo", "editado", "aprobado"];

/**
 * Ordena para recorrer: se termina una fase y se sigue con la siguiente, que es
 * como el equipo revisa el material (todo el crudo, luego lo editado…).
 */
export function ordenarParaRecorrido<T extends PiezaVisor>(piezas: T[]): T[] {
  return [...piezas].sort(
    (a, b) => ORDEN_FASES.indexOf(a.fase) - ORDEN_FASES.indexOf(b.fase),
  );
}

/* ─────────────────────────────── Reproductor ─────────────────────────────── */

function miniatura(p: PiezaVisor, ancho: number): string | null {
  const kind = mediaKind(p.mime, p.nombre);
  if (!tieneMiniatura(kind)) return null;
  if (p.drive_file_id) return `/api/drive/thumb/${p.drive_file_id}?w=${ancho}`;
  if (p.storage_path && kind === "imagen") return p.url;
  return null;
}

function Reproductor({ pieza }: { pieza: PiezaVisor }) {
  const kind: MediaKind = mediaKind(pieza.mime, pieza.nombre);

  // En Drive la reproducción la hace Google: streaming por rangos, así que un
  // video de varios GB arranca al instante sin pasar por el servidor.
  if (pieza.drive_file_id) {
    if (kind === "imagen") {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/drive/thumb/${pieza.drive_file_id}?w=1600`}
          alt={pieza.nombre}
          className="max-h-[58vh] w-full bg-black object-contain"
        />
      );
    }
    return (
      <iframe
        src={`https://drive.google.com/file/d/${pieza.drive_file_id}/preview`}
        allow="autoplay; fullscreen"
        allowFullScreen
        title={pieza.nombre}
        className="h-[58vh] w-full border-0 bg-black"
      />
    );
  }

  if (kind === "imagen") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={pieza.url} alt={pieza.nombre} className="max-h-[58vh] w-full bg-black object-contain" />;
  }
  if (kind === "video") {
    return <video src={pieza.url} controls className="max-h-[58vh] w-full bg-black" />;
  }
  if (kind === "audio") {
    return (
      <div className="flex h-40 items-center justify-center bg-muted/40 px-6">
        <audio src={pieza.url} controls className="w-full" />
      </div>
    );
  }
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-2 bg-muted/40 text-muted-foreground">
      <FileQuestion className="size-8" />
      <p className="text-sm">Este tipo de archivo no se puede previsualizar aquí.</p>
    </div>
  );
}

/* ──────────────────────────────── Carrusel ──────────────────────────────── */

export function CoberturaVisorCarrusel({
  piezas,
  activaId,
  onCambiar,
}: {
  /** Todas las piezas de la cobertura, en el orden en que se quieren recorrer. */
  piezas: PiezaVisor[];
  activaId: string;
  onCambiar: (id: string) => void;
}) {
  const indice = piezas.findIndex((p) => p.id === activaId);
  const actual = indice >= 0 ? piezas[indice] : undefined;
  const tira = useRef<HTMLDivElement>(null);

  const ir = useCallback(
    (delta: number) => {
      if (indice < 0) return;
      const siguiente = piezas[indice + delta];
      if (siguiente) onCambiar(siguiente.id);
    },
    [indice, piezas, onCambiar],
  );

  // Flechas del teclado. El visor ocupa la pantalla, así que es el gesto natural.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const foco = document.activeElement?.tagName;
      if (foco === "INPUT" || foco === "TEXTAREA") return;
      if (e.key === "ArrowLeft") { e.preventDefault(); ir(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); ir(1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ir]);

  // Mantiene visible la miniatura activa al saltar con las flechas.
  useEffect(() => {
    tira.current?.querySelector<HTMLElement>('[data-activa="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activaId]);

  const conteo = useMemo(() => {
    if (indice < 0) return null;
    return `${indice + 1} de ${piezas.length}`;
  }, [indice, piezas.length]);

  if (!actual) return null;
  const marco = MARCO[actual.fase];
  const hayVarias = piezas.length > 1;

  return (
    <div className="flex flex-col">
      <div className={`relative overflow-hidden bg-black ring-4 ring-inset ${marco.anillo}`}>
        <Reproductor pieza={actual} />

        {hayVarias && (
          <>
            <button
              type="button"
              onClick={() => ir(-1)}
              disabled={indice === 0}
              aria-label="Anterior"
              className="absolute left-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75 disabled:pointer-events-none disabled:opacity-0"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => ir(1)}
              disabled={indice === piezas.length - 1}
              aria-label="Siguiente"
              className="absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75 disabled:pointer-events-none disabled:opacity-0"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}

        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
          <span className={`size-2 rounded-full ${marco.punto}`} />
          {marco.label}
          {conteo && <span className="text-white/70">· {conteo}</span>}
        </div>
      </div>

      {hayVarias && (
        <div ref={tira} className="flex gap-1.5 overflow-x-auto bg-muted/40 p-2">
          {piezas.map((p) => {
            const src = miniatura(p, 120);
            const activa = p.id === activaId;
            return (
              <button
                key={p.id}
                type="button"
                data-activa={activa}
                onClick={() => onCambiar(p.id)}
                title={p.nombre}
                aria-label={p.nombre}
                aria-current={activa}
                className={`relative size-14 shrink-0 overflow-hidden rounded border-2 bg-background transition ${
                  activa ? `${MARCO[p.fase].anillo} ring-2` : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" loading="lazy" className="size-full object-cover" />
                ) : (
                  <span className="flex size-full items-center justify-center">
                    <FileQuestion className="size-4 text-muted-foreground/60" />
                  </span>
                )}
                <span className={`absolute inset-x-0 bottom-0 h-1 ${MARCO[p.fase].punto}`} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
