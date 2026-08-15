/**
 * Territorio: los niveles del mapa de Colombia y cómo se le pregunta a la
 * prensa por cada zona.
 *
 * Puro: sin React, sin red, sin base de datos. La construcción de la consulta
 * es lo que decide si una zona trae noticias suyas o basura de otro país, así
 * que se prueba sola.
 */

export const NIVELES = ["nacion", "departamento", "municipio"] as const;
export type Nivel = (typeof NIVELES)[number];

export const NIVEL_LABEL: Record<Nivel, string> = {
  nacion: "Colombia",
  departamento: "Departamento",
  municipio: "Municipio",
};

export interface Zona {
  nivel: Nivel;
  /** Código DANE (divipola). Para la nación, "CO". */
  codigo: string;
  nombre: string;
  /** Departamento al que pertenece un municipio. */
  departamento?: string | null;
}

export const ZONA_NACION: Zona = { nivel: "nacion", codigo: "CO", nombre: "Colombia" };

/**
 * Llave estable de una zona, para la caché y la URL.
 * Se usa el código DANE porque los nombres se repiten: hay ocho «San Antonio».
 */
export function zonaKey(z: Pick<Zona, "nivel" | "codigo">): string {
  return `${z.nivel}:${z.codigo}`;
}

export function parseZonaKey(key: string): { nivel: Nivel; codigo: string } | null {
  const [nivel, ...resto] = key.split(":");
  const codigo = resto.join(":");
  if (!codigo || !NIVELES.includes(nivel as Nivel)) return null;
  return { nivel: nivel as Nivel, codigo };
}

/**
 * Código DANE de departamento a partir del de un municipio.
 * Divipola: los dos primeros dígitos son el departamento —«05001» es Medellín,
 * en Antioquia (05)—, salvo que el código venga sin el cero de la izquierda.
 */
export function departamentoDeMunicipio(codigoMunicipio: string): string {
  const s = String(codigoMunicipio).trim();
  return s.length >= 5 ? s.slice(0, 2) : s.slice(0, s.length - 3).padStart(2, "0");
}

/* ─────────────────────── Consulta a la prensa ─────────────────────── */

/**
 * Nombres que confunden a un buscador si se preguntan solos: son también
 * países, ciudades de otros países o palabras comunes. Con estos se exige
 * siempre el departamento al lado.
 */
const AMBIGUOS = new Set([
  "cordoba", "sucre", "bolivar", "santander", "san andres", "la palma",
  "california", "florida", "venecia", "roma", "toledo", "valencia", "sevilla",
  "granada", "cartagena", "santa fe", "la union", "el paso", "buenos aires",
  "chile", "argelia", "el carmen", "san jose", "san juan", "san luis",
  "san pedro", "san rafael", "santa ana", "santa rosa", "puerto rico",
  "concordia", "guatemala", "palestina", "lima", "quito", "tarapaca",
]);

const sinTildes = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Consulta para Google News de una zona.
 *
 * Un municipio se pregunta con su departamento cuando el nombre es ambiguo
 * —«Córdoba» solo devuelve noticias de España o de Argentina— y siempre se
 * ancla a Colombia. Sin esto, media lista es de otro país.
 */
export function consultaZona(z: Zona): string {
  if (z.nivel === "nacion") return "Colombia";

  const nombre = z.nombre.trim();
  if (z.nivel === "departamento") return `"${nombre}" Colombia`;

  const depto = z.departamento?.trim();
  const necesitaDepto = Boolean(depto) && AMBIGUOS.has(sinTildes(nombre));
  return necesitaDepto ? `"${nombre}" "${depto}" Colombia` : `"${nombre}" Colombia`;
}

/** Etiqueta legible: «Medellín, Antioquia». */
export function zonaLabel(z: Zona): string {
  if (z.nivel === "municipio" && z.departamento) return `${z.nombre}, ${z.departamento}`;
  return z.nombre;
}

/* ─────────────────────── Frescura de la caché ─────────────────────── */

/** Horas que se considera fresca una recolección antes de volver a consultar. */
export const HORAS_CACHE = 6;

/**
 * ¿Hay que volver a consultar la prensa?
 * Sin fecha previa, sí. La prensa local no cambia cada minuto y cada consulta
 * cuesta una llamada externa: seis horas es un equilibrio razonable.
 */
export function cacheVencida(recolectadoEn: string | Date | null | undefined, ahora = new Date()): boolean {
  if (!recolectadoEn) return true;
  const t = recolectadoEn instanceof Date ? recolectadoEn : new Date(recolectadoEn);
  if (Number.isNaN(t.getTime())) return true;
  return ahora.getTime() - t.getTime() > HORAS_CACHE * 3600_000;
}
