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
