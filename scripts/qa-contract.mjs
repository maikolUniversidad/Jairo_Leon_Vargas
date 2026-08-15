// ============================================================================
// UTL 360 · Contrato entre la aplicación y la base de datos.
//
// Esto es lo que el QA de base de datos (scripts/db-qa.mjs) espera encontrar en
// Postgres. Vive aparte para que las pruebas unitarias
// (tests/contract/qa-contract.test.ts) puedan comprobar que sigue coincidiendo
// con src/types/roles.ts. Si cambias el código y olvidas esto —o al revés—, la
// prueba falla antes de que llegue a producción.
// ============================================================================

/** Enum `app_role` — debe coincidir con ROLES en src/types/roles.ts */
export const ROLES_ESPERADOS = [
  "super_admin", "administrador", "direccion_general", "coordinador_utl",
  "juridico_legislativo", "comunicaciones", "coordinador_territorial",
  "gestor_territorial", "atencion_ciudadana", "analitica_reportes",
  "voluntario", "consulta",
];

/**
 * Módulos que deben existir en `role_permissions`.
 * `perfil` y `ubicaciones` se omiten a propósito: src/lib/auth.ts los concede
 * siempre a cualquier usuario autenticado, sin pasar por la matriz de permisos.
 */
export const MODULOS_SIEMPRE_VISIBLES = ["perfil", "ubicaciones"];

export const MODULOS_ESPERADOS = [
  "panel", "ciudadanos", "contactos", "solicitudes", "tareas", "calendario",
  "territorio", "comunicaciones", "inventario", "documentos", "reportes", "auditoria",
  "ia", "notificaciones", "configuracion",
];

/** Buckets de Storage y su visibilidad esperada. */
export const BUCKETS_ESPERADOS = {
  avatars: { publico: true },
  coberturas: { publico: true },
  conocimiento: { publico: false },
  "contact-files": { publico: true },
  contenido: { publico: true },
  documentos: { publico: false },
  inventario: { publico: true },
  "task-files": { publico: true },
  "workspace-covers": { publico: true },
};

/**
 * Tablas con RLS activa pero SIN políticas: acceso exclusivo del service role.
 * Cualquier otra tabla sin políticas es un aviso.
 */
export const TABLAS_SOLO_SERVICE_ROLE = [
  "app_secrets",    // credenciales de integraciones
  "task_due_pings", // tabla de control del cron de vencimientos
];

/** Tablas que deben existir sí o sí para que la app arranque. */
export const TABLAS_NUCLEO = [
  "profiles", "user_roles", "roles_catalog", "role_permissions", "areas",
  "citizens", "contacts", "requests", "tasks", "events", "zones",
  "documents", "content_posts", "notifications", "audit_logs", "settings",
  // Sin equipos no se puede subir material a una cobertura: la revisión previa
  // los exige y el servidor los revalida.
  "equipos_cobertura",
];

/** Triggers críticos: [tabla, nombre, esquema]. */
export const TRIGGERS_CRITICOS = [
  ["users", "on_auth_user_created", "auth"],
  ["requests", "trg_requests_radicado", "public"],
  ["tasks", "trg_tasks_history", "public"],
  ["requests", "trg_requests_history", "public"],
  ["user_locations", "trg_user_locations_history", "public"],
];

/** Funciones SECURITY DEFINER que sí pueden quedar expuestas a anon. */
export const DEFINER_PUBLICAS_OK = [];
