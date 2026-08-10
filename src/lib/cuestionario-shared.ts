// Tipos y catálogos del cuestionario por voz.
// En un módulo neutral (no "use server") porque un archivo de server actions
// solo puede exportar funciones async.

/**
 * Campos básicos, los del diálogo de creación.
 * El cuestionario también se responde al crear, no solo al editar.
 */
export const CAMPOS_BASICOS = ["nombre", "descripcion", "fecha", "lugar"] as const;

/** Campos de la ficha ampliada (migración 0033). */
export const CAMPOS_FICHA = [
  "objetivo",
  "resumen",
  "mensajes_clave",
  "temas",
  "resultados",
  "compromisos",
  "aliados",
  "publico_estimado",
  "hashtags",
] as const;

/**
 * Todo lo que puede llenar una respuesta.
 * Debe coincidir con el check de `cobertura_preguntas.campo` (migración 0038).
 */
export const CAMPOS_PREGUNTA = [...CAMPOS_BASICOS, ...CAMPOS_FICHA] as const;

export type CampoBasico = (typeof CAMPOS_BASICOS)[number];
export type CampoFicha = (typeof CAMPOS_FICHA)[number];
export type CampoPregunta = (typeof CAMPOS_PREGUNTA)[number];

/**
 * Cuándo tiene sentido preguntar algo.
 * `posterior` solo aplica con el evento ya hecho; al abrir el cuestionario se
 * pregunta si la jornada ya ocurrió y se filtra con esto.
 */
export const MOMENTOS = ["siempre", "posterior"] as const;
export type Momento = (typeof MOMENTOS)[number];

/** Cómo se guarda cada campo: decide cómo se pinta y cómo se convierte. */
export const TIPO_CAMPO: Record<CampoPregunta, "texto" | "lista" | "numero" | "fecha"> = {
  nombre: "texto",
  descripcion: "texto",
  fecha: "fecha",
  lugar: "texto",
  objetivo: "texto",
  resumen: "texto",
  mensajes_clave: "texto",
  temas: "lista",
  resultados: "texto",
  compromisos: "texto",
  aliados: "texto",
  publico_estimado: "numero",
  hashtags: "lista",
};

export const CAMPO_LABEL: Record<CampoPregunta, string> = {
  nombre: "Nombre",
  descripcion: "Descripción",
  fecha: "Fecha",
  lugar: "Lugar",
  objetivo: "Objetivo",
  resumen: "Qué se hizo",
  mensajes_clave: "Mensajes clave",
  temas: "Temas",
  resultados: "Resultados",
  compromisos: "Compromisos",
  aliados: "Aliados",
  publico_estimado: "Público estimado",
  hashtags: "Hashtags",
};

/**
 * Preguntas que aplican según si la jornada ya ocurrió.
 * Antes del evento, preguntar «¿cuánta gente llegó?» no tiene sentido.
 */
export function preguntasAplicables(preguntas: Pregunta[], yaOcurrio: boolean): Pregunta[] {
  return yaOcurrio ? preguntas : preguntas.filter((p) => p.momento === "siempre");
}

export interface Pregunta {
  id: string;
  pregunta: string;
  ayuda: string | null;
  campo: CampoPregunta;
  orden: number;
  activa: boolean;
  momento: Momento;
}

export interface Respuesta {
  pregunta_id: string;
  transcripcion: string;
  audio_path: string | null;
  duracion_seg: number | null;
  updated_at: string;
}

/** Lo que la IA propone. Un campo ausente es «no propone nada». */
export type FichaExtraida = Partial<{
  nombre: string;
  descripcion: string;
  /** ISO `YYYY-MM-DD`, como la espera la columna `date`. */
  fecha: string;
  lugar: string;
  objetivo: string;
  resumen: string;
  mensajes_clave: string;
  temas: string[];
  resultados: string;
  compromisos: string;
  aliados: string;
  publico_estimado: number;
  hashtags: string[];
}>;

/**
 * Índice de la primera pregunta sin responder, o 0 si están todas.
 * El carrusel abre ahí para que retomar no obligue a pasar por lo ya hecho.
 */
export function primeraPendiente(preguntas: Pregunta[], respondidas: Set<string>): number {
  const i = preguntas.findIndex((p) => !respondidas.has(p.id));
  return i === -1 ? 0 : i;
}

/** Mantiene el índice dentro del rango; con la lista vacía devuelve 0. */
export function acotar(indice: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(indice, total - 1));
}
