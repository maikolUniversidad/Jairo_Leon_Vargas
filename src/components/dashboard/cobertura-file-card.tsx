"use client";

import { useEffect, useState } from "react";
import {
  FileAudio, FileQuestion, FileText, FileVideo, ImageIcon, Star,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  TIPO_CONTENIDO_LABEL,
  formatBytes,
  mediaKind,
  tieneMiniatura,
  type MediaKind,
} from "@/lib/media-kind";
import { type CoberturaFile } from "@/actions/coberturas";

const ICONO: Record<MediaKind, typeof FileText> = {
  imagen: ImageIcon,
  video: FileVideo,
  audio: FileAudio,
  pdf: FileText,
  documento: FileText,
  archivo: FileQuestion,
};

/** Fuente de la miniatura: el proxy propio para Drive, la URL directa si sigue en Supabase. */
function miniaturaSrc(file: CoberturaFile, kind: MediaKind, ancho: number): string | null {
  if (file.drive_file_id) return `/api/drive/thumb/${file.drive_file_id}?w=${ancho}`;
  if (file.storage_path && kind === "imagen") return file.url;
  return null;
}

export function CoberturaFileCard({
  file,
  arrastrando,
  onAbrir,
  onDragStart,
  onDragEnd,
}: {
  file: CoberturaFile;
  arrastrando: boolean;
  onAbrir: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const kind = mediaKind(file.mime, file.nombre);
  const Icono = ICONO[kind];
  const src = tieneMiniatura(kind) ? miniaturaSrc(file, kind, 400) : null;

  // Drive tarda unos segundos en generar la miniatura de un archivo recién
  // subido: el primer 404 no es definitivo, así que se reintenta una vez.
  const [intento, setIntento] = useState(0);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    if (!fallo || intento >= 1) return;
    const t = setTimeout(() => {
      setFallo(false);
      setIntento((n) => n + 1);
    }, 6000);
    return () => clearTimeout(t);
  }, [fallo, intento]);

  const mostrarMiniatura = src && !fallo;

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onAbrir}
      // El arrastre es solo para el ratón: con teclado se abre la ficha, que
      // lleva dentro el selector de fase.
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAbrir();
        }
      }}
      title={file.nombre}
      className={`group cursor-pointer overflow-hidden rounded-lg border bg-background shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        arrastrando ? "opacity-40" : ""
      }`}
    >
      <div className="relative flex aspect-video items-center justify-center bg-muted/60">
        {mostrarMiniatura ? (
          // Miniatura servida por la propia app; `next/image` no aporta aquí
          // porque el proxy ya devuelve el tamaño pedido y cachea en el navegador.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={intento}
            src={src}
            alt=""
            loading="lazy"
            onError={() => setFallo(true)}
            className="size-full object-cover"
          />
        ) : (
          <Icono className="size-8 text-muted-foreground/50" />
        )}

        {kind === "video" && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-9 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm">
              <span className="ml-0.5 border-y-[7px] border-l-[11px] border-y-transparent border-l-white" />
            </span>
          </span>
        )}

        {file.destacado && (
          <Star className="absolute left-1.5 top-1.5 size-4 fill-amber-400 text-amber-500 drop-shadow" />
        )}
        {file.version > 1 && (
          <Badge variant="muted" className="absolute right-1.5 top-1.5 bg-black/60 text-white">
            v{file.version}
          </Badge>
        )}
      </div>

      <div className="px-2 py-1.5">
        <p className="truncate text-xs font-medium leading-tight">{file.nombre}</p>
        {/* La etiqueta viene de la columna, no de `kind`: es el valor que se pudo
            corregir a mano en la revisión previa. `kind` solo decide cómo pintar. */}
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {TIPO_CONTENIDO_LABEL[file.tipo_contenido]} · {formatBytes(file.size)}
        </p>
        {(file.equipo_nombre || file.dispositivo) && (
          <p
            className="mt-0.5 truncate text-[11px] text-muted-foreground/80"
            title={[file.equipo_nombre, file.dispositivo].filter(Boolean).join(" · ")}
          >
            {[file.equipo_nombre, file.dispositivo].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </article>
  );
}
