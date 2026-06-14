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
  fecha_limite: z.string().optional().or(z.literal("")),
  contexto_operativo: z
    .enum(["institucional", "campana", "comunitario", "interno", "comunicacional"])
    .default("interno"),
});
export type TaskInput = z.infer<typeof taskSchema>;
