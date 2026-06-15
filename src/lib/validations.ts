import { z } from "zod";

/** Validación reutilizable de consentimiento de tratamiento de datos (Ley 1581). */
const consentimiento = z.literal(true, {
  errorMap: () => ({
    message: "Debes autorizar el tratamiento de tus datos para continuar.",
  }),
});

const localidadesBogota = [
  "Usaquén",
  "Chapinero",
  "Santa Fe",
  "San Cristóbal",
  "Usme",
  "Tunjuelito",
  "Bosa",
  "Kennedy",
  "Fontibón",
  "Engativá",
  "Suba",
  "Barrios Unidos",
  "Teusaquillo",
  "Los Mártires",
  "Antonio Nariño",
  "Puente Aranda",
  "La Candelaria",
  "Rafael Uribe Uribe",
  "Ciudad Bolívar",
  "Sumapaz",
  "Otra",
] as const;

export const LOCALIDADES = localidadesBogota;

const telefono = z
  .string()
  .trim()
  .regex(/^[0-9+\s()-]{7,20}$/, "Teléfono inválido")
  .optional()
  .or(z.literal(""));

/* ──────────────── Formularios públicos (landing) ──────────────── */

export const citizenRegisterSchema = z.object({
  nombre: z.string().trim().min(2, "Ingresa tu nombre").max(120),
  apellido: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email("Correo inválido").optional().or(z.literal("")),
  telefono,
  whatsapp: telefono,
  localidad: z.enum(localidadesBogota).optional(),
  barrio: z.string().trim().max(120).optional().or(z.literal("")),
  intereses: z.array(z.string()).max(15).optional(),
  fuente_registro: z.string().max(60).optional(),
  consentimiento_datos: consentimiento,
});
export type CitizenRegisterInput = z.infer<typeof citizenRegisterSchema>;

export const citizenRequestSchema = z.object({
  nombre: z.string().trim().min(2, "Ingresa tu nombre").max(120),
  email: z.string().trim().email("Correo inválido").optional().or(z.literal("")),
  telefono,
  tipo_solicitud: z.enum([
    "servicio",
    "propuesta",
    "agenda",
    "prensa",
    "peticion_formal",
    "otro",
  ]),
  asunto: z.string().trim().min(4, "Describe brevemente el asunto").max(160),
  descripcion: z
    .string()
    .trim()
    .min(10, "Cuéntanos un poco más (mínimo 10 caracteres)")
    .max(4000),
  localidad: z.enum(localidadesBogota).optional(),
  barrio: z.string().trim().max(120).optional().or(z.literal("")),
  canal: z.string().max(40).optional(),
  consentimiento_datos: consentimiento,
});
export type CitizenRequestInput = z.infer<typeof citizenRequestSchema>;

export const territorialProposalSchema = z.object({
  nombre: z.string().trim().min(2, "Ingresa tu nombre").max(120),
  email: z.string().trim().email("Correo inválido").optional().or(z.literal("")),
  telefono,
  localidad: z.enum(localidadesBogota, {
    errorMap: () => ({ message: "Selecciona tu localidad" }),
  }),
  barrio: z.string().trim().max(120).optional().or(z.literal("")),
  tema: z.string().trim().min(3, "Indica el tema").max(120),
  propuesta: z.string().trim().min(10, "Describe tu propuesta").max(4000),
  impacto_esperado: z.string().trim().max(2000).optional().or(z.literal("")),
  consentimiento_datos: consentimiento,
});
export type TerritorialProposalInput = z.infer<typeof territorialProposalSchema>;

/* ──────────────── Solicitudes categorizadas (modelo BASE SOLICITUDES) ──────────────── */

export const REQUEST_CATEGORIES = [
  "salud",
  "entidad",
  "hoja_vida",
  "peticion_general",
  "apunte",
] as const;
export type RequestCategory = (typeof REQUEST_CATEGORIES)[number];

export const REQUEST_CATEGORY_LABELS: Record<RequestCategory, string> = {
  salud: "Caso de salud",
  entidad: "Solicitud a entidad",
  hoja_vida: "Hoja de vida / empleo",
  peticion_general: "Petición general",
  apunte: "Apunte / pendiente",
};

const optText = (max = 200) => z.string().trim().max(max).optional().or(z.literal(""));

/** Formulario público categorizado. Solo `descripcion` es obligatoria además de los datos básicos. */
export const publicSolicitudSchema = z.object({
  categoria: z.enum(REQUEST_CATEGORIES, {
    errorMap: () => ({ message: "Selecciona el tipo de solicitud" }),
  }),
  nombre: z.string().trim().min(2, "Ingresa el nombre").max(160),
  documento: optText(40),
  telefono,
  email: z.string().trim().email("Correo inválido").optional().or(z.literal("")),
  direccion: optText(200),
  localidad: z.enum(localidadesBogota).optional(),
  barrio: optText(120),
  // Específicos por categoría (todos opcionales; el formulario muestra los pertinentes)
  edad: z.coerce.number().int().min(0).max(120).optional().or(z.literal("")),
  eps: optText(120),
  diagnostico: optText(2000),
  entidad: optText(160),
  nivel_academico: optText(120),
  perfil: optText(200),
  organizacion: optText(160),
  asunto: optText(160),
  descripcion: z
    .string()
    .trim()
    .min(10, "Describe la solicitud (mínimo 10 caracteres)")
    .max(4000),
  consentimiento_datos: consentimiento,
});
export type PublicSolicitudInput = z.infer<typeof publicSolicitudSchema>;

/* ──────────────── Gestión de solicitudes (dashboard) ──────────────── */

export const requestManageSchema = z.object({
  id: z.string().uuid(),
  estado: z.enum([
    "recibida",
    "clasificada",
    "asignada",
    "en_gestion",
    "respondida",
    "cerrada",
    "archivada",
  ]),
  prioridad: z.enum(["baja", "media", "alta", "urgente"]),
  semaforo: z.enum(["verde", "amarillo", "rojo"]),
  seguimiento: z.coerce.boolean().optional(),
  responsable_id: z.string().uuid().optional().or(z.literal("")),
  persona_encargada: optText(160),
  persona_recibe: optText(160),
  entidad: optText(160),
  tramite: optText(2000),
  fecha_gestion: z.string().optional().or(z.literal("")),
  fecha_limite: z.string().optional().or(z.literal("")),
  observaciones: optText(4000),
  alerta: optText(200),
});
export type RequestManageInput = z.infer<typeof requestManageSchema>;

export const requestNoteSchema = z.object({
  request_id: z.string().uuid(),
  descripcion: z.string().trim().min(2, "Escribe una nota").max(2000),
});

/* ──────────────── Eventos (calendario) ──────────────── */

export const eventCreateSchema = z.object({
  titulo: z.string().trim().min(3, "Título requerido").max(200),
  descripcion: optText(2000),
  tipo: optText(60),
  fecha_inicio: z.string().min(1, "Indica la fecha"),
  fecha_fin: z.string().optional().or(z.literal("")),
  lugar: optText(200),
  modalidad: z.enum(["presencial", "virtual", "mixta"]).default("presencial"),
  visibilidad: z.enum(["publica", "interna"]).default("interna"),
  estado: z
    .enum(["borrador", "confirmado", "reprogramado", "realizado", "cancelado"])
    .default("confirmado"),
  link_reunion: optText(300),
  contexto_operativo: z
    .enum(["institucional", "campana", "comunitario", "interno", "comunicacional"])
    .default("comunitario"),
});
export type EventCreateInput = z.infer<typeof eventCreateSchema>;

export const eventSignupSchema = z.object({
  event_id: z.string().uuid("Evento inválido"),
  nombre: z.string().trim().min(2, "Ingresa tu nombre").max(120),
  telefono,
  email: z.string().trim().email("Correo inválido").optional().or(z.literal("")),
  barrio: z.string().trim().max(120).optional().or(z.literal("")),
  consentimiento_datos: consentimiento,
});
export type EventSignupInput = z.infer<typeof eventSignupSchema>;

export const pressContactSchema = z.object({
  nombre: z.string().trim().min(2, "Ingresa tu nombre").max(120),
  medio: z.string().trim().min(2, "Indica tu medio u organización").max(160),
  email: z.string().trim().email("Correo inválido"),
  telefono,
  motivo: z.string().trim().min(5, "Cuéntanos el motivo").max(2000),
  consentimiento_datos: consentimiento,
});
export type PressContactInput = z.infer<typeof pressContactSchema>;

/* ──────────────── Auth ──────────────── */

export const loginSchema = z.object({
  email: z.string().trim().email("Correo inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});
export type LoginInput = z.infer<typeof loginSchema>;

/* ──────────────── Dashboard (ejemplos CRUD) ──────────────── */

export const taskSchema = z.object({
  titulo: z.string().trim().min(3, "Título requerido").max(200),
  descripcion: z.string().trim().max(4000).optional().or(z.literal("")),
  prioridad: z.enum(["baja", "media", "alta", "urgente"]).default("media"),
  estado: z
    .enum([
      "pendiente",
      "en_proceso",
      "bloqueada",
      "en_revision",
      "aprobada",
      "finalizada",
      "cancelada",
    ])
    .default("pendiente"),
  responsable_id: z.string().uuid().optional().or(z.literal("")),
  workspace_id: z.string().uuid().optional().or(z.literal("")),
  contact_id: z.string().uuid().optional().or(z.literal("")),
  responsables: z.array(z.string().uuid()).optional().default([]),
  participantes: z.array(z.string().uuid()).optional().default([]),
  fecha_limite: z.string().optional().or(z.literal("")),
  contexto_operativo: z
    .enum(["institucional", "campana", "comunitario", "interno", "comunicacional"])
    .default("interno"),
});
export type TaskInput = z.infer<typeof taskSchema>;

export const contactSchema = z.object({
  nombre: z.string().trim().min(2, "Nombre requerido").max(160),
  apellido: z.string().trim().max(160).optional().or(z.literal("")),
  puesto: z.string().trim().max(160).optional().or(z.literal("")),
  organizacion: z.string().trim().max(160).optional().or(z.literal("")),
  tipo: z
    .enum(["lider", "funcionario", "aliado", "medio", "comunidad", "institucion", "otro"])
    .default("aliado"),
  telefono: z.string().trim().max(40).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email("Correo inválido").optional().or(z.literal("")),
  direccion: z.string().trim().max(200).optional().or(z.literal("")),
  localidad: z.string().trim().max(120).optional().or(z.literal("")),
  barrio: z.string().trim().max(120).optional().or(z.literal("")),
  zona_id: z.string().uuid().optional().or(z.literal("")),
  influencia: z.enum(["alta", "media", "baja"]).optional().or(z.literal("")),
  notas: z.string().trim().max(4000).optional().or(z.literal("")),
  foto_url: z.string().trim().optional().or(z.literal("")),
});
export type ContactInput = z.infer<typeof contactSchema>;

export const taskCommentSchema = z.object({
  task_id: z.string().uuid(),
  comentario: z.string().trim().min(2, "Escribe un comentario").max(2000),
});

export const checklistItemSchema = z.object({
  task_id: z.string().uuid(),
  texto: z.string().trim().min(1, "Escribe el ítem").max(300),
});

/* ──────────────── Perfil de usuario (autoedición) ──────────────── */

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Tu nombre es requerido").max(160),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  cargo: z.string().trim().max(120).optional().or(z.literal("")),
  documento: z.string().trim().max(40).optional().or(z.literal("")),
  direccion: z.string().trim().max(200).optional().or(z.literal("")),
  bio: z.string().trim().max(1000).optional().or(z.literal("")),
  area_id: z.string().uuid().optional().or(z.literal("")),
  fecha_ingreso: z.string().optional().or(z.literal("")),
  avatar_url: z.string().trim().optional().or(z.literal("")),
});
export type ProfileInput = z.infer<typeof profileSchema>;

/* ──────────────── Documentos ──────────────── */

const APP_ROLES = [
  "super_admin",
  "administrador",
  "direccion_general",
  "coordinador_utl",
  "juridico_legislativo",
  "comunicaciones",
  "coordinador_territorial",
  "gestor_territorial",
  "atencion_ciudadana",
  "analitica_reportes",
  "voluntario",
  "consulta",
] as const;

export const documentFolderSchema = z.object({
  nombre: z.string().trim().min(2, "Nombre de la carpeta requerido").max(160),
  descripcion: z.string().trim().max(2000).optional().or(z.literal("")),
  parent_id: z.string().uuid().optional().or(z.literal("")),
  // Vacío = visible a todo el staff.
  allowed_roles: z.array(z.enum(APP_ROLES)).optional().default([]),
});
export type DocumentFolderInput = z.infer<typeof documentFolderSchema>;

export const documentSchema = z.object({
  titulo: z.string().trim().min(2, "Título requerido").max(200),
  descripcion: z.string().trim().max(4000).optional().or(z.literal("")),
  tipo_documento: z.string().trim().max(80).optional().or(z.literal("")),
  folder_id: z.string().uuid().optional().or(z.literal("")),
  confidencialidad: z.enum(["publico", "interno", "reservado"]).default("interno"),
  estado: z
    .enum(["borrador", "aprobado", "archivado", "reservado", "eliminado"])
    .default("borrador"),
  contexto_operativo: z
    .enum(["institucional", "campana", "comunitario", "interno", "comunicacional"])
    .default("institucional"),
  tags: z.array(z.string().trim().max(40)).optional().default([]),
  // Archivo ya subido al bucket privado (o enlace externo).
  archivo_url: z.string().trim().optional().or(z.literal("")),
  storage_path: z.string().trim().optional().or(z.literal("")),
  original_name: z.string().trim().max(255).optional().or(z.literal("")),
  mime: z.string().trim().max(160).optional().or(z.literal("")),
  size: z.number().int().nonnegative().optional(),
});
export type DocumentInput = z.infer<typeof documentSchema>;
