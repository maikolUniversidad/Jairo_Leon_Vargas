/**
 * Análisis del material de una cobertura: qué se ve en cada pieza, para qué
 * sirve y con qué etiquetas.
 *
 * Este módulo es PURO a propósito —arma los mensajes y valida la respuesta, pero
 * no llama a nadie— para poder probarlo sin red ni base de datos. La llamada al
 * proveedor vive en `actions/analisis.ts`, que sí es server-only.
 */

import { type TipoContenido } from "@/lib/media-kind";

/** Modelo por tipo: visión solo donde hace falta, que es lo que cuesta. */
export const MODELO_VISION = "gpt-4o-mini";
export const MODELO_TEXTO = "deepseek-chat";

/** Recorte del texto de un documento. Más allá no mejora el resumen y sí el costo. */
export const MAX_TEXTO_DOCUMENTO = 12_000;

export interface EntradaAnalisis {
  tipo: TipoContenido;
  nombre: string;
  /** Fotos y videos: la miniatura de Drive como data URL. */
  imagenDataUrl?: string;
  /** Documentos: el texto ya extraído. */
  texto?: string;
}

export interface ResultadoAnalisis {
  resumen: string;
  utilidad: string;
  etiquetas: string[];
}

/** Mensaje en el formato OpenAI-compatible que usa el proveedor del proyecto. */
export type MensajeAnalisis =
  | { role: "system"; content: string }
  | {
      role: "user";
      content:
        | string
        | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
    };

export class AnalisisNoAplicable extends Error {}
export class AnalisisInvalido extends Error {}

/* ────────────────────────────── Instrucciones ────────────────────────────── */

const REGLAS_COMUNES = `
Respondes SIEMPRE con un único objeto JSON, sin texto alrededor y sin bloques de código, con exactamente estas claves:
{"resumen": string, "utilidad": string, "etiquetas": string[]}

- "resumen": dos o tres frases sobre qué se ve o qué dice la pieza. Concreto, sin adjetivos de relleno.
- "utilidad": para qué sirve esta pieza en una publicación. Si no sirve, dilo y explica por qué (movida, mal encuadrada, ilegible).
- "etiquetas": entre 3 y 6, en minúscula, sin almohadilla, sin tildes innecesarias.

NUNCA identifiques a nadie por su nombre ni afirmes quién aparece. Describe a las personas por su papel aparente ("una funcionaria", "un grupo de vecinos"). Es material de ciudadanos y no te corresponde ponerles nombre.
Si no puedes ver o leer bien la pieza, dilo en "resumen" en vez de inventar.`.trim();

const SISTEMA_FOTO = `
Analizas fotografías del equipo de comunicaciones de una oficina pública colombiana, para que puedan decidir qué publicar.
Describe qué ocurre, el tipo de plano (general, medio, primer plano, detalle) y si la foto está en condiciones de publicarse.

${REGLAS_COMUNES}`.trim();

const SISTEMA_VIDEO = `
Analizas UN FOTOGRAMA extraído de un video del equipo de comunicaciones de una oficina pública colombiana.
No has visto el video completo: describe solo lo que muestra el fotograma y no supongas qué pasa antes o después.
Menciona el tipo de plano y si la imagen está en condiciones de publicarse.

${REGLAS_COMUNES}`.trim();

const SISTEMA_DOCUMENTO = `
Resumes documentos del equipo de comunicaciones de una oficina pública colombiana (actas, comunicados, listados, presentaciones).
Di de qué trata, qué datos concretos aporta y para qué sirve al redactar una publicación o un boletín.

${REGLAS_COMUNES}`.trim();

/** Qué modelo necesita cada tipo. Lanza si el tipo no se analiza. */
export function modeloPara(tipo: TipoContenido): string {
  if (tipo === "foto" || tipo === "video") return MODELO_VISION;
  if (tipo === "documento") return MODELO_TEXTO;
  throw new AnalisisNoAplicable("Este tipo de archivo no se analiza automáticamente.");
}

/** Arma los mensajes que se le mandan al proveedor. */
export function construirMensajes(entrada: EntradaAnalisis): MensajeAnalisis[] {
  if (entrada.tipo === "foto" || entrada.tipo === "video") {
    if (!entrada.imagenDataUrl) {
      throw new AnalisisNoAplicable("Todavía no hay miniatura para analizar esta pieza.");
    }
    return [
      { role: "system", content: entrada.tipo === "foto" ? SISTEMA_FOTO : SISTEMA_VIDEO },
      {
        role: "user",
        content: [
          { type: "text", text: `Archivo: ${entrada.nombre}` },
          { type: "image_url", image_url: { url: entrada.imagenDataUrl } },
        ],
      },
    ];
  }

  if (entrada.tipo === "documento") {
    const texto = entrada.texto?.trim() ?? "";
    if (!texto) {
      // Un PDF escaneado no tiene texto extraíble. No es un error que se arregle
      // reintentando, así que se distingue del fallo de red.
      throw new AnalisisNoAplicable("El documento no tiene texto legible (¿es un escaneo?).");
    }
    return [
      { role: "system", content: SISTEMA_DOCUMENTO },
      {
        role: "user",
        content: `Archivo: ${entrada.nombre}\n\n---\n${texto.slice(0, MAX_TEXTO_DOCUMENTO)}`,
      },
    ];
  }

  throw new AnalisisNoAplicable("Este tipo de archivo no se analiza automáticamente.");
}

/* ─────────────────────────── Lectura de la respuesta ─────────────────────────── */

/** Quita los bloques ```json con los que algunos modelos envuelven la respuesta. */
function desenvolver(texto: string): string {
  const limpio = texto.trim();
  const cerca = limpio.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (cerca?.[1]) return cerca[1].trim();
  // Algunos modelos anteponen una frase: se toma el primer objeto balanceado.
  const inicio = limpio.indexOf("{");
  const fin = limpio.lastIndexOf("}");
  if (inicio >= 0 && fin > inicio) return limpio.slice(inicio, fin + 1);
  return limpio;
}

const frase = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Valida y normaliza lo que devolvió el modelo. Lanza si no es aprovechable. */
export function parsearResultado(bruto: string): ResultadoAnalisis {
  let dato: unknown;
  try {
    dato = JSON.parse(desenvolver(bruto));
  } catch {
    throw new AnalisisInvalido("El modelo no devolvió un JSON válido.");
  }
  if (!dato || typeof dato !== "object") {
    throw new AnalisisInvalido("El modelo no devolvió un objeto.");
  }

  const obj = dato as Record<string, unknown>;
  const resumen = frase(obj.resumen);
  if (!resumen) throw new AnalisisInvalido("El análisis vino sin resumen.");

  const etiquetas: string[] = [];
  const vistas = new Set<string>();
  if (Array.isArray(obj.etiquetas)) {
    for (const e of obj.etiquetas) {
      const limpia = frase(e).toLowerCase().replace(/^#/, "");
      if (limpia && !vistas.has(limpia)) {
        vistas.add(limpia);
        etiquetas.push(limpia);
      }
      if (etiquetas.length === 6) break;
    }
  }

  return { resumen, utilidad: frase(obj.utilidad), etiquetas };
}

/* ───────────────────────────── Texto para guardar ───────────────────────────── */

/**
 * Une resumen y utilidad en el texto que se guarda y se muestra. En los videos
 * deja constancia de que se miró un fotograma, para que nadie —ni la IA que lee
 * el brief después— suponga que alguien vio el clip completo.
 */
export function redactarAnalisis(tipo: TipoContenido, r: ResultadoAnalisis): string {
  const partes = [r.resumen];
  if (r.utilidad) partes.push(`Utilidad: ${r.utilidad}`);
  if (tipo === "video") partes.push("(Análisis basado en un fotograma, no en el video completo.)");
  return partes.join(" ");
}
