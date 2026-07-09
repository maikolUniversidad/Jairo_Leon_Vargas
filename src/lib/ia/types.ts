/** Tipos compartidos del Asistente IA (cliente + servidor). */

export type ModeloIA = "deepseek-chat" | "deepseek-reasoner" | "gpt-4o-mini";

export interface ModeloInfo {
  id: ModeloIA;
  label: string;
  descripcion: string;
  /** Requiere OpenAI (visión / no soportado por DeepSeek). */
  vision?: boolean;
  provider: "deepseek" | "openai";
}

export const MODELOS: ModeloInfo[] = [
  { id: "deepseek-chat", label: "DeepSeek Chat", descripcion: "Rápido y económico para texto.", provider: "deepseek" },
  { id: "deepseek-reasoner", label: "DeepSeek Reasoner", descripcion: "Razonamiento paso a paso.", provider: "deepseek" },
  { id: "gpt-4o-mini", label: "GPT-4o mini", descripcion: "OpenAI, con análisis de imágenes.", vision: true, provider: "openai" },
];

export function nombreModelo(id: ModeloIA | string): string {
  return MODELOS.find((m) => m.id === id)?.label ?? id;
}

export function modeloInfo(id: ModeloIA | string): ModeloInfo | undefined {
  return MODELOS.find((m) => m.id === id);
}

/** Adjunto ya procesado en el cliente (imagen como dataURL o texto extraído). */
export interface Attachment {
  id: string;
  name: string;
  kind: "image" | "text";
  mime: string;
  dataUrl?: string; // imágenes: data:...;base64,
  text?: string; // csv/excel/texto: contenido extraído
}

/** Especificación de una gráfica que el asistente puede emitir en un bloque ```chart. */
export interface ChartSpec {
  type: "bar" | "line" | "area" | "pie";
  title?: string;
  data: Record<string, unknown>[];
  xKey?: string;
  valueKey?: string;
  nameKey?: string;
  series?: { key: string; name?: string; color?: string }[];
  unidad?: string;
}
