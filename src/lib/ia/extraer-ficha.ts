import "server-only";

import { completeWithTools } from "./provider";
import {
  CAMPOS_PREGUNTA,
  TIPO_CAMPO,
  type CampoPregunta,
  type FichaExtraida,
} from "@/lib/cuestionario-shared";

/**
 * Convierte lo hablado en una cobertura a los campos de su ficha.
 *
 * `normalizarFicha` es puro y es donde vive el riesgo real: el modelo devuelve
 * lo que quiere —números en letras, listas como texto corrido, campos vacíos— y
 * lo que entre a la base tiene que estar limpio. Por eso se prueba solo.
 */

/**
 * Fecha en ISO `YYYY-MM-DD`, que es lo que espera la columna `date`.
 * Solo se acepta lo inequívoco: el modelo tiene instrucción de devolver ISO, y
 * una fecha mal interpretada es peor que ninguna. «El catorce» se descarta.
 */
function aFecha(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const m = valor.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, a, mes, d] = m;
  const iso = `${a}-${mes}-${d}`;
  // Rechaza lo imposible (2026-13-45) sin depender de la corrección silenciosa
  // de Date, que convertiría el 32 de enero en 1 de febrero.
  const f = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(f.getTime())) return null;
  return f.toISOString().slice(0, 10) === iso ? iso : null;
}

/** Primer entero no negativo de un texto: "unas 300 personas" → 300. */
function aNumero(valor: unknown): number | null {
  if (typeof valor === "number") {
    return Number.isFinite(valor) && valor >= 0 ? Math.round(valor) : null;
  }
  if (typeof valor !== "string") return null;
  // Se quitan los separadores de miles antes de buscar: "1.200" es 1200, no 1.
  const limpio = valor.replace(/[. \s](?=\d{3}\b)/g, "");
  const m = limpio.match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Lista desde un arreglo o desde texto separado por comas o saltos de línea. */
function aLista(valor: unknown, conNumeral: boolean): string[] {
  const crudo = Array.isArray(valor)
    ? valor
    : typeof valor === "string"
      ? valor.split(/[,\n;]/)
      : [];

  const vistos = new Set<string>();
  const out: string[] = [];
  for (const item of crudo) {
    if (typeof item !== "string") continue;
    let s = item.trim();
    if (!s) continue;
    if (conNumeral) s = s.startsWith("#") ? s : `#${s.replace(/^#+/, "")}`;
    // Sin distinguir mayúsculas: "#Salud" y "#salud" son la misma etiqueta.
    const clave = s.toLowerCase();
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push(s);
  }
  return out;
}

/**
 * Limpia lo que devolvió el modelo y descarta lo que no aporta.
 *
 * Un campo ausente significa «no propone nada», y eso es distinto de proponer
 * texto vacío: en la revisión, lo que no se propone ni siquiera aparece.
 */
export function normalizarFicha(crudo: unknown): FichaExtraida {
  if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) return {};
  const entrada = crudo as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const campo of CAMPOS_PREGUNTA) {
    const valor = entrada[campo];
    if (valor === undefined || valor === null) continue;
    const tipo = TIPO_CAMPO[campo];

    if (tipo === "numero") {
      const n = aNumero(valor);
      if (n !== null) out[campo] = n;
      continue;
    }

    if (tipo === "fecha") {
      const f = aFecha(valor);
      if (f) out[campo] = f;
      continue;
    }

    if (tipo === "lista") {
      const lista = aLista(valor, campo === "hashtags");
      if (lista.length > 0) out[campo] = lista;
      continue;
    }

    if (typeof valor !== "string") continue;
    const texto = valor.trim();
    if (texto) out[campo] = texto;
  }

  return out as FichaExtraida;
}

/* ────────────────────────── Llamada al modelo ────────────────────────── */

export interface TranscripcionPregunta {
  pregunta: string;
  campo: CampoPregunta;
  transcripcion: string;
}

const HERRAMIENTA = {
  type: "function" as const,
  function: {
    name: "guardar_ficha",
    description: "Guarda la ficha de la cobertura con la información extraída de lo hablado.",
    parameters: {
      type: "object",
      properties: {
        nombre: { type: "string", description: "Nombre corto que identifique la jornada." },
        descripcion: { type: "string", description: "Descripción breve de la jornada." },
        fecha: { type: "string", description: "Fecha de la jornada en formato ISO YYYY-MM-DD." },
        lugar: { type: "string", description: "Barrio, localidad o dirección." },
        objetivo: { type: "string", description: "A qué fue la jornada, en una frase." },
        resumen: { type: "string", description: "Qué se hizo, en prosa breve." },
        mensajes_clave: { type: "string", description: "Mensajes que vale la pena sostener." },
        temas: { type: "array", items: { type: "string" }, description: "Temas tratados." },
        resultados: { type: "string", description: "Resultados concretos." },
        compromisos: { type: "string", description: "Acuerdos: con quién y para cuándo." },
        aliados: { type: "string", description: "Aliados u organizaciones presentes." },
        publico_estimado: { type: "integer", description: "Número aproximado de asistentes." },
        hashtags: { type: "array", items: { type: "string" }, description: "Etiquetas para publicar." },
      },
    },
  },
};

const SISTEMA = `Eres el asistente de una Unidad de Trabajo Legislativo en Bogotá.
Recibes respuestas habladas sobre una jornada en territorio, transcritas de audio.

Reglas:
- Redacta en español de Colombia, claro y sobrio. Sin adjetivos de campaña.
- Usa SOLO lo que la persona dijo. Nunca inventes datos, cifras ni nombres.
- Si una respuesta no aporta nada para su campo, OMITE ese campo por completo.
- Las transcripciones traen muletillas y frases a medias: límpialas, pero no
  cambies lo que se dijo.
- La fecha va SIEMPRE en formato ISO YYYY-MM-DD. Si lo dicho no permite saber el
  año, el mes y el día con certeza, omite el campo: una fecha mal interpretada es
  peor que ninguna.
- Llama siempre a la herramienta guardar_ficha.`;

/**
 * Manda las transcripciones al modelo y devuelve la ficha propuesta, ya limpia.
 * Devuelve `{}` si el modelo no propone nada utilizable: nunca inventa.
 */
export async function extraerFicha(
  respuestas: TranscripcionPregunta[],
  modelo = "auto",
): Promise<FichaExtraida> {
  const utiles = respuestas.filter((r) => r.transcripcion.trim().length > 0);
  if (utiles.length === 0) return {};

  const cuerpo = utiles
    .map((r) => `Pregunta (campo "${r.campo}"): ${r.pregunta}\nRespuesta: ${r.transcripcion.trim()}`)
    .join("\n\n");

  const { toolCalls } = await completeWithTools(
    modelo,
    [
      { role: "system", content: SISTEMA },
      { role: "user", content: cuerpo },
    ],
    [HERRAMIENTA],
  );

  const llamada = toolCalls.find((t) => t.function?.name === "guardar_ficha");
  if (!llamada) return {};

  try {
    return normalizarFicha(JSON.parse(llamada.function.arguments));
  } catch {
    // El modelo devolvió argumentos que no son JSON válido: no se propone nada
    // en vez de tumbar el cuestionario entero.
    return {};
  }
}
