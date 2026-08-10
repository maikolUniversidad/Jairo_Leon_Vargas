// Tipos y catálogos de los equipos de grabación/fotografía.
// En un módulo neutral (no "use server") porque un archivo de server actions
// solo puede exportar funciones async: cualquier constante que se exporte desde
// ahí rompe el build con "A 'use server' file can only export async functions".

export const TIPOS_EQUIPO = ["grabacion", "fotos", "mixto"] as const;
export type TipoEquipo = (typeof TIPOS_EQUIPO)[number];

export const TIPO_EQUIPO_LABEL: Record<TipoEquipo, string> = {
  grabacion: "Grabación",
  fotos: "Fotografía",
  mixto: "Mixto",
};

export interface EquipoCobertura {
  id: string;
  nombre: string;
  tipo: TipoEquipo;
  activo: boolean;
}

/** Roles sugeridos dentro de un equipo. El campo admite cualquier texto. */
export const ROLES_INTEGRANTE = [
  "Camarógrafo",
  "Fotógrafo",
  "Editor",
  "Periodista",
  "Community manager",
] as const;

export interface IntegranteEquipo {
  id: string;
  equipo_id: string;
  user_id: string;
  /** Nombre resuelto del perfil, para no consultarlo en cada pantalla. */
  nombre: string;
  rol: string | null;
}

export interface EquipoConIntegrantes extends EquipoCobertura {
  integrantes: IntegranteEquipo[];
}

/** Persona de la plataforma que se puede sumar a un equipo. */
export interface UsuarioPlataforma {
  id: string;
  nombre: string;
}
