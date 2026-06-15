/**
 * Roles del sistema UTL 360.
 * Debe mantenerse sincronizado con el enum `app_role` de la base de datos
 * (ver supabase/migrations/0001_schema.sql).
 */
export const ROLES = [
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

export type AppRole = (typeof ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Administrador",
  administrador: "Administrador",
  direccion_general: "Dirección General",
  coordinador_utl: "Coordinador UTL",
  juridico_legislativo: "Jurídico / Legislativo",
  comunicaciones: "Comunicaciones",
  coordinador_territorial: "Coordinador Territorial",
  gestor_territorial: "Gestor Territorial",
  atencion_ciudadana: "Atención Ciudadana",
  analitica_reportes: "Analítica / Reportes",
  voluntario: "Voluntario",
  consulta: "Consulta",
};

/** Roles con privilegios administrativos de alto nivel. */
export const ADMIN_ROLES: AppRole[] = ["super_admin", "administrador"];

/**
 * Matriz de acceso por módulo del dashboard (control de navegación en el front).
 * La autorización REAL vive en las políticas RLS de Postgres; esto solo
 * decide qué mostrar en la UI.
 */
export type DashboardModule =
  | "panel"
  | "ciudadanos"
  | "contactos"
  | "solicitudes"
  | "tareas"
  | "calendario"
  | "territorio"
  | "comunicaciones"
  | "documentos"
  | "reportes"
  | "auditoria"
  | "ia"
  | "notificaciones"
  | "ubicaciones"
  | "perfil"
  | "configuracion";

export const MODULE_ACCESS: Record<DashboardModule, AppRole[] | "*"> = {
  panel: "*",
  ciudadanos: [
    "super_admin",
    "administrador",
    "direccion_general",
    "coordinador_utl",
    "atencion_ciudadana",
    "coordinador_territorial",
    "gestor_territorial",
    "analitica_reportes",
  ],
  contactos: [
    "super_admin",
    "administrador",
    "direccion_general",
    "coordinador_utl",
    "atencion_ciudadana",
    "coordinador_territorial",
    "gestor_territorial",
    "analitica_reportes",
  ],
  solicitudes: [
    "super_admin",
    "administrador",
    "direccion_general",
    "coordinador_utl",
    "juridico_legislativo",
    "atencion_ciudadana",
    "coordinador_territorial",
    "gestor_territorial",
    "analitica_reportes",
  ],
  tareas: "*",
  calendario: "*",
  territorio: [
    "super_admin",
    "administrador",
    "direccion_general",
    "coordinador_utl",
    "coordinador_territorial",
    "gestor_territorial",
    "analitica_reportes",
  ],
  comunicaciones: [
    "super_admin",
    "administrador",
    "direccion_general",
    "coordinador_utl",
    "comunicaciones",
  ],
  documentos: [
    "super_admin",
    "administrador",
    "direccion_general",
    "coordinador_utl",
    "juridico_legislativo",
    "comunicaciones",
  ],
  reportes: [
    "super_admin",
    "administrador",
    "direccion_general",
    "coordinador_utl",
    "analitica_reportes",
  ],
  auditoria: [
    "super_admin",
    "administrador",
    "direccion_general",
    "analitica_reportes",
    "coordinador_utl",
  ],
  ia: [
    "super_admin",
    "administrador",
    "direccion_general",
    "coordinador_utl",
    "comunicaciones",
    "juridico_legislativo",
  ],
  notificaciones: [
    "super_admin",
    "administrador",
    "direccion_general",
    "coordinador_utl",
    "comunicaciones",
  ],
  ubicaciones: "*",
  perfil: "*",
  configuracion: ["super_admin", "administrador"],
};

export function canAccessModule(
  role: AppRole | null | undefined,
  module: DashboardModule,
): boolean {
  if (!role) return false;
  const allowed = MODULE_ACCESS[module];
  return allowed === "*" || allowed.includes(role);
}

export const ALL_MODULES = Object.keys(MODULE_ACCESS) as DashboardModule[];

export const MODULE_LABELS: Record<DashboardModule, string> = {
  panel: "Panel",
  ciudadanos: "Ciudadanos",
  contactos: "Contactos",
  solicitudes: "Solicitudes",
  tareas: "Tareas",
  calendario: "Calendario",
  territorio: "Territorio",
  comunicaciones: "Comunicaciones",
  documentos: "Documentos",
  reportes: "Reportes",
  auditoria: "Auditoría",
  ia: "Asistente IA",
  notificaciones: "Notificaciones",
  ubicaciones: "Ubicaciones",
  perfil: "Mi perfil",
  configuracion: "Configuración",
};
