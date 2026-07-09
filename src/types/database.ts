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

export type Semaforo = "verde" | "amarillo" | "rojo";

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  recibida: "Recibida",
  clasificada: "Clasificada",
  asignada: "Asignada",
  en_gestion: "En gestión",
  respondida: "Respondida",
  cerrada: "Cerrada",
  archivada: "Archivada",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  bloqueada: "Bloqueada",
  en_revision: "En revisión",
  aprobada: "Aprobada",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

export type Confidentiality = "publico" | "interno" | "reservado";

export type ZoneType = "localidad" | "barrio" | "upz" | "municipio" | "vereda" | "departamento";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  area_id: string | null;
  cargo: string | null;
  documento: string | null;
  bio: string | null;
  direccion: string | null;
  fecha_ingreso: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type MonitorRelacion = "propio" | "aliado" | "contraposicion" | "neutral" | "objetivo";

export const MONITOR_RELACION_LABELS: Record<MonitorRelacion, string> = {
  propio: "Propio",
  aliado: "Aliado",
  contraposicion: "Contraposición",
  neutral: "Neutral",
  objetivo: "Objetivo",
};

export interface MonitorPerson {
  id: string;
  nombre: string;
  alias: string[];
  relacion: MonitorRelacion;
  cargo: string | null;
  partido: string | null;
  foto_url: string | null;
  etiquetas: string[];
  handles: Record<string, string>;
  keywords: string[];
  notas: string | null;
  ultimo_analisis: string | null;
  analisis_at: string | null;
  ultima_recoleccion: string | null;
  auto_activo: boolean;
  auto_frecuencia: string;
  auto_hora: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface MonitorRun {
  id: string;
  person_id: string;
  fuentes: string[];
  total: number;
  resultado: Record<string, string>;
  tipo: string;
  created_at: string;
}

export interface MonitorItem {
  id: string;
  person_id: string;
  fuente: string;
  tipo: string;
  titulo: string | null;
  contenido: string | null;
  url: string | null;
  autor: string | null;
  autor_handle: string | null;
  sentimiento: string | null;
  relevancia: number;
  published_at: string | null;
  fetched_at: string;
  resumen: string | null;
  es_directo: boolean | null;
  etiquetas: string[];
  analisis: string | null;
  analizado_at: string | null;
}

export interface UserLocation {
  user_id: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  is_sharing: boolean;
  updated_at: string;
}

export type DirectiveStatus = "pendiente" | "en_camino" | "llego" | "cancelada";

export const DIRECTIVE_STATUS_LABELS: Record<DirectiveStatus, string> = {
  pendiente: "Pendiente",
  en_camino: "En camino",
  llego: "Llegó",
  cancelada: "Cancelada",
};

export interface LocationDirective {
  id: string;
  user_id: string;
  created_by: string | null;
  titulo: string;
  descripcion: string | null;
  destino_nombre: string | null;
  destino_lat: number | null;
  destino_lng: number | null;
  estado: DirectiveStatus;
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
  referido_por_contact_id: string | null;
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
  // Modelo BASE SOLICITUDES
  nombre_solicitante: string | null;
  documento: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  edad: number | null;
  eps: string | null;
  diagnostico: string | null;
  entidad: string | null;
  nivel_academico: string | null;
  perfil: string | null;
  organizacion: string | null;
  tramite: string | null;
  fecha_gestion: string | null;
  observaciones: string | null;
  persona_remite: string | null;
  persona_encargada: string | null;
  persona_recibe: string | null;
  semaforo: Semaforo;
  seguimiento: boolean;
  alerta: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RequestHistory {
  id: string;
  request_id: string;
  tipo: string;
  descripcion: string | null;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  author_id: string | null;
  created_at: string;
}

export interface TaskHistory {
  id: string;
  task_id: string;
  tipo: string;
  descripcion: string | null;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  author_id: string | null;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string | null;
  comentario: string;
  created_at: string;
}

export interface TaskChecklistItem {
  id: string;
  task_id: string;
  texto: string;
  completado: boolean;
  orden: number;
  created_at: string;
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
  workspace_id: string | null;
  etiquetas: string[] | null;
  orden: number;
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
  codigo_geo: string | null;
  estado: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  borrador: "Borrador",
  aprobado: "Aprobado",
  archivado: "Archivado",
  reservado: "Reservado",
  eliminado: "Eliminado",
};

export const CONFIDENCIALIDAD_LABELS: Record<Confidentiality, string> = {
  publico: "Público",
  interno: "Interno",
  reservado: "Reservado",
};

export interface DocumentFolder {
  id: string;
  nombre: string;
  descripcion: string | null;
  parent_id: string | null;
  /** Roles que pueden ver la carpeta. Vacío = visible a todo el staff. */
  allowed_roles: AppRole[];
  drive_folder_id: string | null;
  created_by: string | null;
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
  folder_id: string | null;
  descripcion: string | null;
  storage_path: string | null;
  drive_file_id: string | null;
  original_name: string | null;
  mime: string | null;
  size: number | null;
  creado_por: string | null;
  aprobado_por: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Contact {
  id: string;
  nombre: string;
  apellido: string | null;
  foto_url: string | null;
  puesto: string | null;
  organizacion: string | null;
  tipo: string;
  telefono: string | null;
  whatsapp: string | null;
  email: string | null;
  direccion: string | null;
  localidad: string | null;
  barrio: string | null;
  zona_id: string | null;
  influencia: string | null;
  notas: string | null;
  etiquetas: string[] | null;
  estado: string;
  contexto_operativo: ContextoOperativo;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export const CONTACT_TIPOS = [
  "lider",
  "funcionario",
  "aliado",
  "medio",
  "comunidad",
  "institucion",
  "otro",
] as const;

export const CONTACT_TIPO_LABELS: Record<string, string> = {
  lider: "Líder",
  funcionario: "Funcionario",
  aliado: "Aliado",
  medio: "Medio",
  comunidad: "Comunidad",
  institucion: "Institución",
  otro: "Otro",
};

export interface ContactRelation {
  id: string;
  contact_id: string;
  related_contact_id: string;
  tipo_relacion: string;
  nota: string | null;
  created_at: string;
}

export interface ContactDocument {
  id: string;
  contact_id: string;
  tipo: "archivo" | "link";
  nombre: string;
  url: string;
  storage_path: string | null;
  mime: string | null;
  size: number | null;
  created_at: string;
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

/* ──────────────── Comunicaciones · Avatares (personajes de marca) ──────────────── */

export type AvatarJobTipo = "imagen" | "video" | "voz" | "3d";
export type AvatarJobEstado = "pendiente" | "procesando" | "listo" | "error";

export const AVATAR_JOB_TIPO_LABELS: Record<AvatarJobTipo, string> = {
  imagen: "Imagen",
  video: "Video",
  voz: "Voz",
  "3d": "3D",
};

export const AVATAR_JOB_ESTADO_LABELS: Record<AvatarJobEstado, string> = {
  pendiente: "Pendiente",
  procesando: "Procesando",
  listo: "Listo",
  error: "Error",
};

export interface Avatar {
  id: string;
  nombre: string;
  slug: string | null;
  arquetipo: string | null;
  descripcion: string | null;
  personalidad: string | null;
  tono: string | null;
  valores: string[];
  estilo_visual: string | null;
  foto_refs: string[];
  avatar_url: string | null;
  voice_provider: string;
  voice_id: string | null;
  voice_name: string | null;
  voice_settings: Record<string, unknown>;
  modelo_imagen: string | null;
  modelo_video: string | null;
  activo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AvatarModel {
  clave: string;
  proveedor: string;
  tipo: AvatarJobTipo;
  label: string;
  descripcion: string | null;
  params_schema: Record<string, unknown>;
  activo: boolean;
  orden: number;
}

export interface AvatarJob {
  id: string;
  avatar_id: string;
  tipo: AvatarJobTipo;
  modelo: string | null;
  proveedor: string | null;
  titulo: string | null;
  prompt: string | null;
  params: Record<string, unknown>;
  input_refs: string[];
  estado: AvatarJobEstado;
  provider_job_id: string | null;
  output_url: string | null;
  output_meta: Record<string, unknown>;
  error_msg: string | null;
  post_id: string | null;
  cobertura_id: string | null;
  drive_file_id: string | null;
  person_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/* ──────────────── Comunicaciones · Producción de video (IA) ──────────────── */

export type VideoFase =
  | "idea"
  | "investigacion"
  | "guion"
  | "produccion"
  | "edicion"
  | "aprobado"
  | "publicado";

export const VIDEO_FASES: VideoFase[] = [
  "idea",
  "investigacion",
  "guion",
  "produccion",
  "edicion",
  "aprobado",
  "publicado",
];

export const VIDEO_FASE_LABELS: Record<VideoFase, string> = {
  idea: "Idea",
  investigacion: "Investigación",
  guion: "Guión",
  produccion: "Producción",
  edicion: "Edición",
  aprobado: "Aprobado",
  publicado: "Publicado",
};

export type GenerationKind = "imagen" | "video";
export type GenerationStatus = "pending" | "processing" | "completed" | "failed";

export interface VideoProject {
  id: string;
  titulo: string;
  descripcion: string | null;
  fase: VideoFase;
  objetivo: string | null;
  plataformas: string[];
  guion: string | null;
  copy_text: string | null;
  descripcion_video: string | null;
  titulos: string[];
  hashtags: string[];
  portada_url: string | null;
  post_id: string | null;
  cobertura_id: string | null;
  responsable_id: string | null;
  contexto_operativo: ContextoOperativo;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface VideoResearchNote {
  id: string;
  project_id: string;
  tema: string;
  contenido: string | null;
  fuentes: { title: string; url: string; snippet?: string }[];
  fuente_ia: string | null;
  created_by: string | null;
  created_at: string;
}

export interface VideoGeneration {
  id: string;
  project_id: string;
  kind: GenerationKind;
  prompt: string;
  status: GenerationStatus;
  provider: string;
  external_id: string | null;
  result_url: string | null;
  error: string | null;
  params: Record<string, unknown>;
  is_portada: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VideoViralityAnalysis {
  id: string;
  project_id: string;
  target: string;
  input_ref: string | null;
  score: number | null;
  veredicto: string | null;
  fortalezas: string[];
  riesgos: string[];
  recomendaciones: string[];
  raw: Record<string, unknown>;
  fuente: string | null;
  created_by: string | null;
  created_at: string;
}
