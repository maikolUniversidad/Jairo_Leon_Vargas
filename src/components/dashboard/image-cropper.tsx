"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ZoomIn, Crop as CropIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CropTarget {
  /** Relación de aspecto (ancho/alto), p. ej. 3/2 o 1. */
  aspect: number;
  /** Píxeles exactos de salida. */
  width: number;
  height: number;
  /** Máscara circular (para fotos de perfil). */
  round?: boolean;
  /** Etiqueta corta para mostrar en la interfaz, p. ej. "512×512 px". */
  label?: string;
}

/**
 * Tamaños estándar de la plataforma. Cada preset corresponde a cómo se muestra
 * realmente la imagen, para que nunca se deforme ni se suba más grande de lo necesario.
 */
export const CROP_PRESETS = {
  /** Fotos de perfil / contactos: se muestran en círculo. */
  avatar: { aspect: 1, width: 512, height: 512, round: true, label: "512×512 px (círculo)" },
  /** Portadas de noticias/publicaciones. */
  cover169: { aspect: 16 / 9, width: 1200, height: 675, label: "1200×675 px (16:9)" },
  /** Banner ancho (portada de workspace). */
  banner31: { aspect: 3, width: 1200, height: 400, label: "1200×400 px (3:1)" },
  /** Foto destacada 3:2. */
  foto32: { aspect: 3 / 2, width: 1200, height: 800, label: "1200×800 px (3:2)" },
} satisfies Record<string, CropTarget>

// Ancho del recuadro de recorte en pantalla (px). La altura se deriva del aspecto.
const BOX_W = 300;

/**
 * Recorta una imagen antes de subirla: previsualiza, permite acercar y mover, y
 * exporta al tamaño exacto en píxeles indicado en `target`.
 */
export function ImageCropper({
  file,
  target,
  open,
  onCancel,
  onConfirm,
  busy,
}: {
  file: File | null;
  target: CropTarget;
  open: boolean;
  onCancel: () => void;
  onConfirm: (file: File) => void;
  busy?: boolean;
}) {
  const boxW = BOX_W;
  const boxH = Math.round(BOX_W / target.aspect);

  const imgRef = useRef<HTMLImageElement>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  // Escala base para que la imagen SIEMPRE cubra el recuadro (cover).
  const baseScale = nat ? Math.max(boxW / nat.w, boxH / nat.h) : 1;
  const scale = baseScale * zoom;
  const dispW = nat ? nat.w * scale : boxW;
  const dispH = nat ? nat.h * scale : boxH;

  const clamp = useCallback(
    (x: number, y: number) => ({
      x: Math.min(0, Math.max(boxW - dispW, x)),
      y: Math.min(0, Math.max(boxH - dispH, y)),
    }),
    [boxW, boxH, dispW, dispH],
  );

  // Centra la imagen cuando carga o cambia el archivo.
  function onImgLoad() {
    const el = imgRef.current;
    if (!el) return;
    const w = el.naturalWidth;
    const h = el.naturalHeight;
    setNat({ w, h });
    const s = Math.max(boxW / w, boxH / h);
    setZoom(1);
    setOffset({ x: (boxW - w * s) / 2, y: (boxH - h * s) / 2 });
  }

  // Zoom manteniendo el centro del recuadro.
  function changeZoom(nextZoom: number) {
    if (!nat) return setZoom(nextZoom);
    const oldScale = baseScale * zoom;
    const newScale = baseScale * nextZoom;
    const cx = (boxW / 2 - offset.x) / oldScale;
    const cy = (boxH / 2 - offset.y) / oldScale;
    const nx = boxW / 2 - cx * newScale;
    const ny = boxH / 2 - cy * newScale;
    setZoom(nextZoom);
    const dW = nat.w * newScale;
    const dH = nat.h * newScale;
    setOffset({
      x: Math.min(0, Math.max(boxW - dW, nx)),
      y: Math.min(0, Math.max(boxH - dH, ny)),
    });
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const nx = drag.current.ox + (e.clientX - drag.current.px);
    const ny = drag.current.oy + (e.clientY - drag.current.py);
    setOffset(clamp(nx, ny));
  }
  function onPointerUp() {
    drag.current = null;
  }

  async function confirm() {
    const el = imgRef.current;
    if (!el || !nat) return;
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Región de la imagen fuente visible dentro del recuadro.
    const sx = -offset.x / scale;
    const sy = -offset.y / scale;
    const sW = boxW / scale;
    const sH = boxH / scale;

    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(el, sx, sy, sW, sH, 0, 0, target.width, target.height);

    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", 0.9),
    );
    if (!blob) return;
    const baseName = (file?.name ?? "imagen").replace(/\.[^.]+$/, "");
    onConfirm(new File([blob], `${baseName}.jpg`, { type: "image/jpeg" }));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CropIcon className="size-5 text-primary" /> Ajustar imagen
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          {/* Recuadro de recorte */}
          <div
            className={cn(
              "relative touch-none overflow-hidden bg-muted",
              target.round ? "rounded-full" : "rounded-xl",
            )}
            style={{ width: boxW, height: boxH }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={imgRef}
                src={url}
                alt="Recorte"
                onLoad={onImgLoad}
                draggable={false}
                className="absolute left-0 top-0 max-w-none cursor-grab select-none active:cursor-grabbing"
                style={{ width: dispW, height: dispH, transform: `translate(${offset.x}px, ${offset.y}px)` }}
              />
            )}
            {/* Guías (regla de tercios) */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-y-0 left-1/3 w-px bg-white/40" />
              <div className="absolute inset-y-0 left-2/3 w-px bg-white/40" />
              <div className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
              <div className="absolute inset-x-0 top-2/3 h-px bg-white/40" />
              <div className={cn("absolute inset-0 ring-2 ring-white/70", target.round ? "rounded-full" : "rounded-xl")} />
            </div>
          </div>

          {/* Zoom */}
          <div className="flex w-full items-center gap-3">
            <ZoomIn className="size-4 shrink-0 text-muted-foreground" />
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => changeZoom(Number(e.target.value))}
              className="w-full accent-primary"
              aria-label="Zoom"
            />
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Arrastra para reposicionar y usa el zoom. Se guardará a{" "}
            <b>{target.width}×{target.height} px</b>{target.round ? " (recorte circular)" : ""}.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancelar</Button>
          <Button onClick={confirm} disabled={busy || !nat}>
            {busy ? "Subiendo…" : "Recortar y subir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
