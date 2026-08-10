/**
 * Formateador del brief de una cobertura.
 *
 * Es una función pura a propósito: no consulta la base de datos ni depende de
 * React. Así se prueba sin infraestructura y el mismo texto sirve tanto para el
 * botón de copiar como para el que abre el chat de IA.
 */

import { mediaKind, type MediaKind } from "@/lib/media-kind";

export interface BriefCobertura {
  nombre: string;
  descripcion?: string | null;
  fecha?: string | null;
  lugar?: string | null;
  estado?: string | null;
  objetivo?: string | null;
  resumen?: string | null;
  mensajes_clave?: string | null;
  temas?: string[] | null;
  resultados?: string | null;
  compromisos?: string | null;
  aliados?: string | null;
  publico_estimado?: number | null;
  hashtags?: string[] | null;
}

export interface BriefAsistente {
  nombre: string;
  rol?: string | null;
  vinculo?: "contacto" | "ciudadano" | null;
}

export interface BriefArchivo {
  fase: "crudo" | "editado" | "aprobado";
  nombre: string;
  mime?: string | null;
  descripcion?: string | null;
}

const FASE_LABEL: Record<BriefArchivo["fase"], string> = {
  crudo: "Contenido Crudo",
  editado: "Contenido Editado",
  aprobado: "Contenido Aprobado",
};

const KIND_PLURAL: Record<MediaKind, [string, string]> = {
  imagen: ["foto", "fotos"],
  video: ["video", "videos"],
  audio: ["audio", "audios"],
  pdf: ["PDF", "PDF"],
  documento: ["documento", "documentos"],
  archivo: ["archivo", "archivos"],
};

const ENCABEZADO =
  "Esta es la información de una cobertura de prensa del equipo de comunicaciones. " +
  "Úsala como contexto para lo que te pida a continuación (redactar publicaciones, " +
  "un boletín, un guion, o resumir la jornada). Si algo no aparece aquí, dímelo en " +
  "vez de inventarlo.";

const vacio = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/** Línea «- Etiqueta: valor», omitida si el valor está vacío. */
function dato(etiqueta: string, valor: unknown): string | null {
  if (vacio(valor)) return null;
  return `- **${etiqueta}:** ${String(valor).trim()}`;
}

/** Bloque con título y cuerpo de varias líneas, omitido si el cuerpo está vacío. */
function bloque(titulo: string, cuerpo: unknown): string | null {
  if (vacio(cuerpo)) return null;
  return `### ${titulo}\n${String(cuerpo).trim()}`;
}

function listaEtiquetas(etiqueta: string, valores: string[] | null | undefined): string | null {
  const limpias = (valores ?? []).map((v) => v.trim()).filter(Boolean);
  if (limpias.length === 0) return null;
  return `- **${etiqueta}:** ${limpias.join(", ")}`;
}

/** «3 videos y 12 fotos», ordenado de más a menos. */
function resumirTipos(archivos: BriefArchivo[]): string {
  const conteo = new Map<MediaKind, number>();
  for (const a of archivos) {
    const k = mediaKind(a.mime, a.nombre);
    conteo.set(k, (conteo.get(k) ?? 0) + 1);
  }
  const partes = [...conteo.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([kind, n]) => {
      const [singular, plural] = KIND_PLURAL[kind];
      return `${n} ${n === 1 ? singular : plural}`;
    });
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

function seccionAsistentes(asistentes: BriefAsistente[]): string | null {
  if (asistentes.length === 0) return null;

  const porRol = new Map<string, string[]>();
  for (const a of asistentes) {
    const rol = a.rol?.trim() || "Asistentes";
    const lista = porRol.get(rol) ?? [];
    lista.push(a.nombre.trim());
    porRol.set(rol, lista);
  }

  const lineas = [...porRol.entries()].map(
    ([rol, nombres]) => `- **${rol}:** ${nombres.join(", ")}`,
  );
  return `### Quiénes estuvieron\n${lineas.join("\n")}`;
}

function seccionContenido(archivos: BriefArchivo[]): string | null {
  if (archivos.length === 0) {
    return "### Material disponible\nTodavía no se ha subido contenido a esta cobertura.";
  }

  const partes: string[] = ["### Material disponible"];
  for (const fase of ["crudo", "editado", "aprobado"] as const) {
    const dellaFase = archivos.filter((a) => a.fase === fase);
    if (dellaFase.length === 0) continue;

    partes.push(`- **${FASE_LABEL[fase]}:** ${resumirTipos(dellaFase)}`);
    // Solo las piezas con descripción: el resto son nombres de archivo de cámara
    // que no le dicen nada útil a la IA.
    for (const a of dellaFase.filter((x) => !vacio(x.descripcion))) {
      partes.push(`  - ${a.nombre.trim()}: ${a.descripcion!.trim()}`);
    }
  }
  return partes.join("\n");
}

/** Construye el brief completo en Markdown. Omite todo lo que esté vacío. */
export function construirBrief(
  cobertura: BriefCobertura,
  asistentes: BriefAsistente[] = [],
  archivos: BriefArchivo[] = [],
): string {
  const ficha = [
    dato("Fecha", cobertura.fecha),
    dato("Lugar", cobertura.lugar),
    dato("Estado", cobertura.estado?.replace(/_/g, " ")),
    dato("Aliados", cobertura.aliados),
    cobertura.publico_estimado ? dato("Público estimado", cobertura.publico_estimado) : null,
    listaEtiquetas("Temas", cobertura.temas),
    listaEtiquetas("Hashtags", cobertura.hashtags),
  ].filter(Boolean);

  const secciones = [
    ENCABEZADO,
    `## Cobertura: ${cobertura.nombre.trim()}`,
    ficha.length > 0 ? ficha.join("\n") : null,
    bloque("De qué se trata", cobertura.descripcion),
    bloque("Objetivo", cobertura.objetivo),
    bloque("Qué se hizo", cobertura.resumen),
    bloque("Mensajes clave", cobertura.mensajes_clave),
    bloque("Resultados", cobertura.resultados),
    bloque("Compromisos", cobertura.compromisos),
    seccionAsistentes(asistentes),
    seccionContenido(archivos),
  ].filter(Boolean);

  return secciones.join("\n\n");
}
