"use client";

import { Camera, FileAudio, FileQuestion, FileText, FileVideo, ImageIcon, Loader2, X } from "lucide-react";

import {
  TIPOS_CONTENIDO,
  TIPO_CONTENIDO_LABEL,
  formatBytes,
  type MediaKind,
  type TipoContenido,
} from "@/lib/media-kind";

const ICONO: Record<MediaKind, typeof FileText> = {
  imagen: ImageIcon,
  video: FileVideo,
  audio: FileAudio,
  pdf: FileText,
  documento: FileText,
  archivo: FileQuestion,
};

/**
 * Una tarjeta del lote por revisar. Presentacional puro: todo el estado vive en
 * el diálogo, que es quien sabe qué está seleccionado y qué falta por asignar.
 */
export function CoberturaPreviewCard({
  nombre,
  size,
  kind,
  tipo,
  dispositivo,
  miniaturaUrl,
  cargando,
  seleccionado,
  onSeleccionar,
  onCambiarTipo,
  onQuitar,
}: {
  nombre: string;
  size: number;
  kind: MediaKind;
  tipo: TipoContenido;
  dispositivo: string | null;
  miniaturaUrl: string | null;
  cargando: boolean;
  seleccionado: boolean;
  onSeleccionar: (v: boolean) => void;
  onCambiarTipo: (t: TipoContenido) => void;
  onQuitar: () => void;
}) {
  const Icono = ICONO[kind];

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-lg border bg-background transition ${
        seleccionado ? "ring-2 ring-primary" : "hover:border-muted-foreground/40"
      }`}
    >
      {/* Toda la zona de la miniatura alterna la selección: con 200 archivos,
          apuntarle a una casilla de 16 px es un castigo. */}
      <button
        type="button"
        onClick={() => onSeleccionar(!seleccionado)}
        aria-pressed={seleccionado}
        aria-label={`Seleccionar ${nombre}`}
        className="relative flex h-28 w-full items-center justify-center bg-muted/40"
      >
        {miniaturaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob: local, aún sin subir
          <img src={miniaturaUrl} alt="" className="h-full w-full object-cover" />
        ) : cargando ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground/60" />
        ) : (
          <Icono className="size-7 text-muted-foreground/50" />
        )}

        <span
          className={`absolute left-1.5 top-1.5 flex size-4 items-center justify-center rounded border text-[10px] ${
            seleccionado ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 bg-background/80"
          }`}
          aria-hidden
        >
          {seleccionado ? "✓" : ""}
        </span>
      </button>

      <button
        type="button"
        onClick={onQuitar}
        aria-label={`Quitar ${nombre}`}
        title="Quitar del lote"
        className="absolute right-1.5 top-1.5 rounded bg-background/80 p-0.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive focus:opacity-100"
      >
        <X className="size-3.5" />
      </button>

      <div className="flex flex-1 flex-col gap-1 p-2">
        <p className="truncate text-xs font-medium" title={nombre}>
          {nombre}
        </p>
        <p className="text-[11px] text-muted-foreground">{formatBytes(size)}</p>

        <select
          value={tipo}
          onChange={(e) => onCambiarTipo(e.target.value as TipoContenido)}
          aria-label={`Tipo de contenido de ${nombre}`}
          className="mt-0.5 w-full rounded border bg-background px-1.5 py-1 text-[11px]"
        >
          {TIPOS_CONTENIDO.map((t) => (
            <option key={t} value={t}>
              {TIPO_CONTENIDO_LABEL[t]}
            </option>
          ))}
        </select>

        <p className="flex items-center gap-1 text-[11px] text-muted-foreground" title={dispositivo ?? "Dispositivo no detectado"}>
          <Camera className="size-3 shrink-0" />
          <span className="truncate">{dispositivo ?? "—"}</span>
        </p>
      </div>
    </div>
  );
}
