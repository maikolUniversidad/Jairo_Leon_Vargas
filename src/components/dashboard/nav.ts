import {
  LayoutDashboard,
  Users,
  Contact,
  Inbox,
  ListChecks,
  CalendarDays,
  MapPinned,
  Megaphone,
  FileText,
  BarChart3,
  ShieldCheck,
  Sparkles,
  Bell,
  Radar,
  UserCircle,
  Settings,
  Clapperboard,
  Newspaper,
  Video,
  CalendarRange,
  HardDrive,
  Map,
  Flag,
  User,
  Bot,
  Link2,
  Database,
  type LucideIcon,
} from "lucide-react";

import type { DashboardModule } from "@/types/roles";

/** Submódulo: una funcionalidad dentro de un módulo. */
export interface SubNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
}

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  module: DashboardModule;
  /** Funcionalidades internas del módulo (opcional). */
  submodules?: SubNavItem[];
}

export const DASHBOARD_NAV: NavItem[] = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard, module: "panel" },
  { href: "/dashboard/ciudadanos", label: "Ciudadanos", icon: Users, module: "ciudadanos" },
  { href: "/dashboard/contactos", label: "Contactos", icon: Contact, module: "contactos" },
  { href: "/dashboard/solicitudes", label: "Solicitudes", icon: Inbox, module: "solicitudes" },
  { href: "/dashboard/tareas", label: "Tareas", icon: ListChecks, module: "tareas" },
  { href: "/dashboard/calendario", label: "Calendario", icon: CalendarDays, module: "calendario" },
  {
    href: "/dashboard/territorio",
    label: "Territorio",
    icon: MapPinned,
    module: "territorio",
    submodules: [
      { href: "/dashboard/territorio?capa=bogota_localidades", label: "Bogotá · Localidades", icon: MapPinned, description: "Mapa por localidades y sus tareas." },
      { href: "/dashboard/territorio?capa=bogota_barrios", label: "Bogotá · Barrios", icon: Map, description: "Detalle por barrios de la ciudad." },
      { href: "/dashboard/territorio?capa=colombia_departamentos", label: "Colombia · Departamentos", icon: Flag, description: "Mapa nacional por departamentos." },
    ],
  },
  {
    href: "/dashboard/comunicaciones",
    label: "Comunicaciones",
    icon: Megaphone,
    module: "comunicaciones",
    submodules: [
      { href: "/dashboard/comunicaciones/coberturas", label: "Coberturas", icon: Clapperboard, description: "Cada cobertura crea su carpeta en Drive con Contenido Crudo, Editado y Aprobado." },
      { href: "/dashboard/comunicaciones/produccion", label: "Producción de video (IA)", icon: Video, description: "Planea y produce videos con IA: investigación, guión, copy, portadas/clips con Higgsfield y análisis de viralidad." },
      { href: "/dashboard/comunicaciones/avatares", label: "Avatares", icon: Bot, description: "Personajes de marca con personalidad, imagen y voz. Genera contenido (Higgsfield + ElevenLabs) y úsalo en publicaciones, calendario y coberturas." },
      { href: "/dashboard/comunicaciones/publicaciones", label: "Publicaciones", icon: Newspaper, description: "Noticias, comunicados y piezas (idea → publicado). Las públicas salen en el sitio." },
      { href: "/dashboard/comunicaciones/calendario", label: "Calendario editorial", icon: CalendarRange, description: "Programa piezas por canal y fecha, con responsable y estado." },
      { href: "/dashboard/comunicaciones/monitoreo", label: "Monitoreo de personas", icon: Radar, description: "Recopila noticias, menciones y publicaciones sobre figuras públicas y etiquétalas (aliado, contraposición, senador…)." },
    ],
  },
  { href: "/dashboard/documentos", label: "Documentos", icon: FileText, module: "documentos" },
  {
    href: "/dashboard/reportes",
    label: "Reportes",
    icon: BarChart3,
    module: "reportes",
    submodules: [
      { href: "/dashboard/reportes?vista=general", label: "General", icon: BarChart3, description: "Indicadores de toda la operación. Exporta a CSV." },
      { href: "/dashboard/reportes?vista=persona", label: "Por persona", icon: User, description: "Reporte individual del trabajo de cada integrante." },
    ],
  },
  { href: "/dashboard/auditoria", label: "Auditoría", icon: ShieldCheck, module: "auditoria" },
  { href: "/dashboard/ia", label: "Asistente IA", icon: Sparkles, module: "ia" },
  { href: "/dashboard/ubicaciones", label: "Ubicaciones", icon: Radar, module: "ubicaciones" },
  {
    href: "/dashboard/configuracion",
    label: "Configuración",
    icon: Settings,
    module: "configuracion",
    submodules: [
      { href: "/dashboard/configuracion?tab=usuarios", label: "Usuarios", icon: Users, description: "Alta, roles y activación de usuarios del equipo." },
      { href: "/dashboard/configuracion?tab=roles", label: "Roles y permisos", icon: ShieldCheck, description: "Matriz de acceso por rol a cada módulo." },
      { href: "/dashboard/configuracion?tab=integraciones", label: "Integraciones", icon: HardDrive, description: "Conexión con Google Drive y otros servicios." },
      { href: "/dashboard/configuracion?tab=conocimiento", label: "Base de conocimiento", icon: Database, description: "Sube documentos (RAG): se vectorizan como base de conocimiento del Asistente IA y se visualizan en un grafo por conceptos." },
      { href: "/dashboard/configuracion?tab=misredes", label: "Página /misredes", icon: Link2, description: "Edita la página pública de enlaces (redes, WhatsApp, prensa, campaña)." },
      { href: "/dashboard/notificaciones", label: "Notificaciones", icon: Bell, description: "Bandeja completa de alertas y avisos del sistema (también en la campana del encabezado)." },
      { href: "/dashboard/perfil", label: "Mi perfil", icon: UserCircle, description: "Tus datos, avatar y preferencias de cuenta (también en el avatar del encabezado)." },
    ],
  },
];

/** Devuelve el módulo del nav por su href base. */
export function findModule(href: string): NavItem | undefined {
  return DASHBOARD_NAV.find((m) => m.href === href);
}

/**
 * Indica si un módulo está activo para la ruta actual. Además del prefijo de
 * su propia ruta, considera las rutas de sus submódulos (necesario para
 * submódulos que viven fuera de la ruta base del módulo, p. ej. Notificaciones
 * y Mi perfil dentro de Configuración).
 */
export function isModuleActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/dashboard") return pathname === "/dashboard";
  if (pathname.startsWith(item.href)) return true;
  return (item.submodules ?? []).some((s) => {
    const path = s.href.split("?")[0] ?? s.href;
    return pathname === path || pathname.startsWith(path + "/");
  });
}
