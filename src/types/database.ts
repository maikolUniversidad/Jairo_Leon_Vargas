/**
 * Tipos de dominio de UTL 360.
 *
 * Para tipado 100% fiel al esquema, genera los tipos con la CLI de Supabase:
 *   npx supabase gen types typescript --project-id <id> > src/types/supabase.ts
 * y reemplaza/extiende este archivo. Mientras tanto, estos tipos cubren las
 * entidades y enums principales usados por la app.
 */
import type { AppRole } from "./roles";

export type { AppRole };

/** Clasificación institucional vs. campaña (mitiga el riesgo legal de mezcla). */
export type ContextoOperativo =
  | "institucional"
  | "campana"
  | "comunitario"
  | "interno"
  | "comunicacional";

export const CONTEXTO_LABELS: Record<ContextoOperativo, string> = {
  institucional: "Institucional",
  campana: "Campaña",
  comunitario: "Comunitario",
  interno: "Interno",
  comunicacional: "Comunicacional",
};

export type RequestStatus =
  | "recibida"
  | "clasificada"
  | "asignada"
  | "en_gestion"
  | "respondida"
  | "cerrada"
  | "archivada";

export type TaskStatus =
  | "pendiente"
  | "en_proceso"
  | "bloqueada"
  | "en_revision"
  | "aprobada"
  | "finalizada"
  | "cancelada";

export type EventStatus =
  | "borrador"
  | "confirmado"
  | "reprogramado"
  | "realizado"
  | "cancelado";

export type ContentStatus =
  | "idea"
  | "borrador"
  | "en_revision"
  | "aprobado"
  | "programado"
  | "publicado"
  | "archivado";

export type DocumentStatus =
  | "borrador"
  | "aprobado"
  | "archivado"
  | "reservado"
  | "eliminado";

export type Priority = "baja" | "media" | "alta" | "urgente";

export type Confidentiality = "publico" | "interno" | "reservado";

export type ZoneType = "localidad" | "barrio" | "upz" | "municipio" | "vereda";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  area_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Citizen {
  id: string;
  nombre: string;
  apellido: string | null;
  tipo_documento: string | null;
  documento: string | null;
  email: string | null;
  telefono: string | null;
  whatsapp: string | null;
  localidad: string | null;
  barrio: string | null;
  direccion: string | null;
  intereses: string[] | null;
  etiquetas: string[] | null;
  fuente_registro: string | null;
  consentimiento_datos: boolean;
  fecha_consentimiento: string | null;
  estado: string;
  contexto_operativo: ContextoOperativo;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  deleted_at: string | null;
}

export interface CitizenRequest {
  id: string;
  radicado: string;
  citizen_id: string | null;
  tipo_solicitud: string;
  asunto: string;
  descripcion: string;
  localidad: string | null;
  barrio: string | null;
  prioridad: Priority;
  estado: RequestStatus;
  responsable_id: string | null;
  fecha_recepcion: string;
  fecha_limite: string | null;
  canal: string | null;
  archivos: string[] | null;
  respuesta: string | null;
  fecha_cierre: string | null;
  contexto_operativo: ContextoOperativo;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Task {
  id: string;
  titulo: string;
  descripcion: string | null;
  area_id: string | null;
  responsable_id: string | null;
  creador_id: string | null;
  prioridad: Priority;
  estado: TaskStatus;
  fecha_inicio: string | null;
  fecha_limite: string | null;
  solicitud_id: string | null;
  evento_id: string | null;
  zona_id: string | null;
  etiquetas: string[] | null;
  contexto_operativo: ContextoOperativo;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CalendarEvent {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  lugar: string | null;
  modalidad: string | null;
  responsable_id: string | null;
  zona_id: string | null;
  visibilidad: "publica" | "interna";
  estado: EventStatus;
  link_reunion: string | null;
  contexto_operativo: ContextoOperativo;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Zone {
  id: string;
  nombre_zona: string;
  tipo_zona: ZoneType;
  descripcion: string | null;
  responsable_id: string | null;
  prioridad: Priority;
  problematicas: string[] | null;
  mapa_url: string | null;
  estado: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DocumentRecord {
  id: string;
  titulo: string;
  tipo_documento: string;
  archivo_url: string | null;
  version: number;
  estado: DocumentStatus;
  confidencialidad: Confidentiality;
  tags: string[] | null;
  contexto_operativo: ContextoOperativo;
  creado_por: string | null;
  aprobado_por: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ContentPost {
  id: string;
  titulo: string;
  slug: string | null;
  tipo: string;
  categoria: string | null;
  resumen: string | null;
  cuerpo: string | null;
  imagen_url: string | null;
  estado: ContentStatus;
  visibilidad: "publica" | "interna";
  contexto_operativo: ContextoOperativo;
  fecha_publicacion: string | null;
  autor_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
