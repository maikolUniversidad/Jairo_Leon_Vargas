import { mediaKind, tieneMiniatura, type MediaKind } from "@/lib/media-kind";

/**
 * De dónde sale la miniatura de una pieza.
 *
 * Vive aparte porque la usan la tarjeta del tablero y la portada del listado, y
 * son dos sitios donde es fácil que se desincronicen.
 */
export interface PiezaConMiniatura {
  url: string;
  drive_file_id: string | null;
  storage_path: string | null;
  mime: string | null;
  nombre: string;
}

/**
 * URL de la miniatura, o null si esa pieza no tiene uno aprovechable.
 *
 * Drive va por el proxy propio —su URL directa exige credenciales—; lo que
 * sigue en Supabase se sirve tal cual, pero solo si es imagen: un MP4 en
 * Supabase no tiene miniatura que mostrar.
 */
export function miniaturaSrc(
  pieza: PiezaConMiniatura,
  ancho: number,
  kind: MediaKind = mediaKind(pieza.mime, pieza.nombre),
): string | null {
  if (!tieneMiniatura(kind)) return null;
  if (pieza.drive_file_id) return `/api/drive/thumb/${pieza.drive_file_id}?w=${ancho}`;
  if (pieza.storage_path && kind === "imagen") return pieza.url;
  return null;
}
