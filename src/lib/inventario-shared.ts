// Tipos y catálogos del módulo de Inventario de equipos.
// Módulo neutral (no "use server"): un archivo de server actions solo puede
// exportar funciones async, así que las constantes y tipos viven aquí.

/* ─────────────────────────────── Categorías ─────────────────────────────── */

export const CATEGORIAS_EQUIPO = [
  "camara", "lente", "microfono", "audio", "tripode", "estabilizador",
  "iluminacion", "dron", "almacenamiento", "computo", "energia", "accesorio", "otro",
] as const;
export type CategoriaEquipo = (typeof CATEGORIAS_EQUIPO)[number];

export const CATEGORIA_LABEL: Record<CategoriaEquipo, string> = {
  camara: "Cámara",
  lente: "Lente / óptica",
  microfono: "Micrófono",
  audio: "Audio",
  tripode: "Trípode / soporte",
  estabilizador: "Estabilizador / gimbal",
  iluminacion: "Iluminación",
  dron: "Dron",
  almacenamiento: "Almacenamiento",
  computo: "Cómputo",
  energia: "Energía / baterías",
  accesorio: "Accesorio",
  otro: "Otro",
};

/* ─────────────────────────────── Estados ─────────────────────────────── */

export const ESTADOS_EQUIPO = ["disponible", "prestado", "mantenimiento", "danado", "baja"] as const;
export type EstadoEquipo = (typeof ESTADOS_EQUIPO)[number];

export const ESTADO_EQUIPO_LABEL: Record<EstadoEquipo, string> = {
  disponible: "Disponible",
  prestado: "Prestado",
  mantenimiento: "En mantenimiento",
  danado: "Dañado",
  baja: "Dado de baja",
};

/** Tono visual (badge) por estado. */
export const ESTADO_EQUIPO_TONO: Record<EstadoEquipo, "success" | "warning" | "danger" | "muted"> = {
  disponible: "success",
  prestado: "warning",
  mantenimiento: "warning",
  danado: "danger",
  baja: "muted",
};

/* ─────────────────────────────── Condición ─────────────────────────────── */

export const CONDICIONES = ["nuevo", "bueno", "regular", "malo"] as const;
export type Condicion = (typeof CONDICIONES)[number];

export const CONDICION_LABEL: Record<Condicion, string> = {
  nuevo: "Nuevo",
  bueno: "Bueno",
  regular: "Regular",
  malo: "Malo",
};

/* ─────────────────────────────── Partes ─────────────────────────────── */

export const ESTADOS_PARTE = ["ok", "faltante", "danado"] as const;
export type EstadoParte = (typeof ESTADOS_PARTE)[number];

export const ESTADO_PARTE_LABEL: Record<EstadoParte, string> = {
  ok: "Completa",
  faltante: "Faltante",
  danado: "Dañada",
};

/** Sugerencias de partes frecuentes de un kit (el campo admite cualquier texto). */
export const PARTES_SUGERIDAS = [
  "Batería", "Cargador", "Tapa de lente", "Parasol", "Memoria SD", "Cable USB",
  "Cable HDMI", "Correa", "Estuche", "Adaptador", "Control remoto", "Manual",
] as const;

/* ─────────────────────────────── Préstamos ─────────────────────────────── */

export const ESTADOS_PRESTAMO = ["solicitado", "activo", "devuelto", "vencido", "rechazado"] as const;
export type EstadoPrestamo = (typeof ESTADOS_PRESTAMO)[number];

export const ESTADO_PRESTAMO_LABEL: Record<EstadoPrestamo, string> = {
  solicitado: "Solicitado",
  activo: "En préstamo",
  devuelto: "Devuelto",
  vencido: "Vencido",
  rechazado: "Rechazado",
};

/* ─────────────────────────────── Novedades ─────────────────────────────── */

export const TIPOS_NOVEDAD = ["accidente", "dano", "mantenimiento", "perdida", "reparacion", "nota"] as const;
export type TipoNovedad = (typeof TIPOS_NOVEDAD)[number];

export const TIPO_NOVEDAD_LABEL: Record<TipoNovedad, string> = {
  accidente: "Accidente",
  dano: "Daño",
  mantenimiento: "Mantenimiento",
  perdida: "Pérdida",
  reparacion: "Reparación",
  nota: "Nota",
};

export const SEVERIDADES = ["baja", "media", "alta", "critica"] as const;
export type Severidad = (typeof SEVERIDADES)[number];

export const SEVERIDAD_LABEL: Record<Severidad, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  critica: "Crítica",
};

/* ─────────────────────────────── Evidencias ─────────────────────────────── */

export const MOMENTOS_EVIDENCIA = ["entrega", "recepcion", "accidente", "general"] as const;
export type MomentoEvidencia = (typeof MOMENTOS_EVIDENCIA)[number];

export const MOMENTO_EVIDENCIA_LABEL: Record<MomentoEvidencia, string> = {
  entrega: "Entrega",
  recepcion: "Recepción",
  accidente: "Accidente",
  general: "General",
};

/* ─────────────────────────────── Interfaces ─────────────────────────────── */

export interface EquipoInventario {
  id: string;
  codigo: string | null;
  nombre: string;
  categoria: CategoriaEquipo;
  marca: string | null;
  modelo: string | null;
  serial: string | null;
  estado: EstadoEquipo;
  condicion: Condicion;
  ubicacion: string | null;
  valor: number | null;
  fecha_compra: string | null;
  notas: string | null;
  foto_url: string | null;
  activo: boolean;
}

/** Equipo con datos derivados para el listado (partes, préstamo vigente). */
export interface EquipoConResumen extends EquipoInventario {
  partes_total: number;
  partes_incompletas: number;
  novedades_abiertas: number;
  /** Préstamo activo (si lo hay): a quién y desde cuándo. */
  prestamo_activo: {
    id: string;
    responsable_nombre: string;
    fecha_salida: string | null;
    fecha_prevista: string | null;
    vencido: boolean;
  } | null;
}

export interface ParteEquipo {
  id: string;
  equipo_id: string;
  nombre: string;
  cantidad: number;
  esencial: boolean;
  estado: EstadoParte;
  notas: string | null;
}

/** Ítem del checklist de partes en la entrega/devolución de un préstamo. */
export interface ChecklistItem {
  parte_id: string;
  nombre: string;
  incluida: boolean;
}

export interface PrestamoInventario {
  id: string;
  equipo_id: string;
  equipo_nombre: string;
  responsable_id: string | null;
  responsable_nombre: string;
  entregado_por_nombre: string | null;
  recibido_por_nombre: string | null;
  estado: EstadoPrestamo;
  proposito: string | null;
  fecha_salida: string | null;
  fecha_prevista: string | null;
  fecha_devolucion: string | null;
  condicion_salida: Condicion | null;
  condicion_devolucion: Condicion | null;
  checklist_salida: ChecklistItem[] | null;
  checklist_devolucion: ChecklistItem[] | null;
  notas_salida: string | null;
  notas_devolucion: string | null;
  created_at: string;
  /** Derivado: activo y ya pasó la fecha prevista. */
  vencido: boolean;
}

export interface NovedadInventario {
  id: string;
  equipo_id: string;
  equipo_nombre: string;
  prestamo_id: string | null;
  tipo: TipoNovedad;
  severidad: Severidad;
  descripcion: string;
  costo: number | null;
  resuelto: boolean;
  reportado_por_nombre: string | null;
  created_at: string;
}

export interface EvidenciaInventario {
  id: string;
  equipo_id: string;
  prestamo_id: string | null;
  novedad_id: string | null;
  momento: MomentoEvidencia;
  tipo_media: "video" | "foto";
  storage_path: string;
  url: string | null;
  mime: string | null;
  descripcion: string | null;
  created_at: string;
}

/** Detalle completo de un equipo para su ficha. */
export interface EquipoDetalle {
  equipo: EquipoInventario;
  partes: ParteEquipo[];
  prestamos: PrestamoInventario[];
  novedades: NovedadInventario[];
  evidencias: EvidenciaInventario[];
}

/** Persona de la plataforma que puede recibir un préstamo. */
export interface UsuarioInventario {
  id: string;
  nombre: string;
}

/** Estadísticas para las tarjetas del encabezado. */
export interface InventarioStats {
  total: number;
  disponibles: number;
  prestados: number;
  mantenimiento: number;
  novedades_abiertas: number;
  vencidos: number;
}

/** ¿La fecha prevista ya pasó? Centraliza el cálculo de "vencido". */
export function esVencido(estado: EstadoPrestamo, fechaPrevista: string | null): boolean {
  if (estado !== "activo" || !fechaPrevista) return false;
  return new Date(fechaPrevista).getTime() < Date.now();
}
