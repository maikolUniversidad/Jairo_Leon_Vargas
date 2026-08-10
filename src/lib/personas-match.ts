/**
 * Emparejar nombres dichos en voz alta con las personas que ya están en la
 * plataforma.
 *
 * Whisper transcribe sin tildes fiables, la gente dice «Marta Ospina» donde el
 * registro dice «Marta Lucía Ospina Rojas», y a veces solo el nombre de pila.
 * Aquí se decide cuándo eso es la misma persona y cuándo no.
 *
 * Puro: sin React, sin red, sin base de datos.
 */

export type TipoPersona = "usuario" | "contacto" | "ciudadano";
export type Vinculo = "equipo" | "aliado" | "otro";

export interface PersonaConocida {
  id: string;
  tipo: TipoPersona;
  nombre: string;
}

/** Persona nombrada en el dictado, antes de saber si ya existe. */
export interface PersonaDicha {
  nombre: string;
  vinculo: Vinculo;
  rol?: string | null;
  organizacion?: string | null;
}

export interface PersonaResuelta extends PersonaDicha {
  /** La persona de la plataforma con la que se emparejó, si la hay. */
  match: PersonaConocida | null;
}

/**
 * Minúsculas, sin tildes, sin puntuación y sin dobles espacios.
 *
 * La `ñ` se pliega a `n` a propósito: Whisper escribe «Castaño» y «Castano»
 * indistintamente según cómo se pronuncie, y perder ese emparejamiento es peor
 * que el riesgo remoto de confundir a un «Peña» con un «Pena».
 */
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Partes con contenido de un nombre normalizado. */
function partes(s: string): string[] {
  return normalizar(s).split(" ").filter(Boolean);
}

/**
 * ¿Son la misma persona?
 *
 * Se acepta cuando uno de los nombres está contenido en el otro parte por
 * parte: «Marta Ospina» empareja con «Marta Lucía Ospina Rojas». Se exige al
 * menos DOS partes en común —nombre y apellido— porque emparejar por el solo
 * nombre de pila mete a la persona equivocada en el registro de una jornada, y
 * eso es peor que dejarla sin vincular.
 */
export function mismoNombre(a: string, b: string): boolean {
  const pa = partes(a);
  const pb = partes(b);
  if (pa.length === 0 || pb.length === 0) return false;
  if (normalizar(a) === normalizar(b)) return true;

  const [corto, largo] = pa.length <= pb.length ? [pa, pb] : [pb, pa];
  if (corto.length < 2) return false;

  const enLargo = new Set(largo);
  return corto.every((p) => enLargo.has(p));
}

/**
 * Busca a quién se refiere un nombre dicho. Devuelve null si no hay una única
 * coincidencia clara: ante dos «Juan Quintero» distintos, mejor no adivinar.
 */
export function buscarPersona(
  nombre: string,
  conocidas: PersonaConocida[],
): PersonaConocida | null {
  const candidatas = conocidas.filter((p) => mismoNombre(nombre, p.nombre));
  if (candidatas.length === 1) return candidatas[0]!;
  if (candidatas.length === 0) return null;

  // Con varias, gana la exacta si hay exactamente una.
  const exactas = candidatas.filter((p) => normalizar(p.nombre) === normalizar(nombre));
  return exactas.length === 1 ? exactas[0]! : null;
}

/**
 * Resuelve la lista dicha contra las conocidas, sin repetir personas.
 *
 * El vínculo que propuso la IA se corrige con la realidad: si el nombre
 * empareja con un usuario de la plataforma, es del equipo, dijera lo que
 * dijera el modelo.
 */
export function resolverPersonas(
  dichas: PersonaDicha[],
  conocidas: PersonaConocida[],
): PersonaResuelta[] {
  const out: PersonaResuelta[] = [];
  const vistos = new Set<string>();

  for (const d of dichas) {
    const nombre = d.nombre.trim();
    if (!nombre) continue;

    const clave = normalizar(nombre);
    if (!clave || vistos.has(clave)) continue;
    vistos.add(clave);

    const match = buscarPersona(nombre, conocidas);
    out.push({
      ...d,
      nombre,
      match,
      vinculo: match?.tipo === "usuario" ? "equipo" : d.vinculo,
    });
  }

  return out;
}
