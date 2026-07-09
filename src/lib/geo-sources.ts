// Fuentes de datos geográficos (GeoJSON) para el mapa de territorio.
//
// Estrategia "local primero": el mapa intenta cargar el archivo local en
// /public/geo (datos precisos que tú controlas) y, si no existe, usa una URL
// pública de respaldo. Para máximo detalle y disponibilidad, descarga los
// GeoJSON oficiales y colócalos en `public/geo/` con estos nombres.

export interface GeoLayerSource {
  key: string;
  label: string;
  tipo: "localidad" | "barrio" | "departamento";
  /** URLs candidatas en orden de preferencia (local → remoto). */
  urls: string[];
  /** Posibles nombres de propiedad que contienen el nombre del polígono. */
  nameKeys: string[];
  /** Posibles nombres de propiedad con un código único del polígono. */
  codeKeys: string[];
}

export const GEO_SOURCES = {
  bogota_localidades: {
    key: "bogota_localidades",
    label: "Bogotá · Localidades",
    tipo: "localidad",
    urls: [
      "/geo/bogota-localidades.geojson",
      "https://services5.arcgis.com/l23kE3b7uPnZIuaB/arcgis/rest/services/Localidades_Bogota/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson",
    ],
    nameKeys: ["LocNombre", "NOMBRE", "nombre", "Nombre", "localidad", "NOMBRE_LOC", "LOCNOMBRE"],
    codeKeys: ["LocCodigo", "CODIGO_LOC", "codigo", "LOCCODIGO", "id"],
  },
  bogota_barrios: {
    key: "bogota_barrios",
    label: "Bogotá · Barrios",
    tipo: "barrio",
    urls: [
      "/geo/bogota-barrios.geojson",
      "https://raw.githubusercontent.com/lab-tecnosocial/geometrias-colombia/main/bogota_barrios.geojson",
    ],
    nameKeys: ["SCANOMBRE", "barrio", "NOMBRE", "nombre", "Nombre", "barriocomu", "NOM_BARRIO"],
    codeKeys: ["SCACODIGO", "codigo", "CODIGO", "id", "barriocod"],
  },
  colombia_departamentos: {
    key: "colombia_departamentos",
    label: "Colombia · Departamentos",
    tipo: "departamento",
    urls: [
      "/geo/colombia-departamentos.geojson",
      "https://gist.githubusercontent.com/john-guerra/43c7656821069d00dcbc/raw/be6a6e239cd5b5b803c6e7c2ec405b793a9064dd/Colombia.geo.json",
    ],
    nameKeys: ["NOMBRE_DPT", "DPTO_CNMBR", "NOMBRE", "nombre", "departamento", "name", "dpt"],
    codeKeys: ["DPTO", "DPTO_CCDGO", "codigo", "id"],
  },
} satisfies Record<string, GeoLayerSource>;

/** Normaliza un nombre para comparar (minúsculas, sin tildes). */
const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
export function normalizeName(s: string): string {
  return s.normalize("NFD").replace(DIACRITICS, "").toLowerCase().trim();
}

/** Extrae el nombre del polígono probando varias propiedades conocidas. */
export function featureName(props: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = props?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  // último recurso: primer string razonable
  for (const v of Object.values(props ?? {})) {
    if (typeof v === "string" && v.trim().length > 1) return v.trim();
  }
  return "Área sin nombre";
}

export function featureCode(props: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = props?.[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
}
