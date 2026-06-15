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
  Sparkles,
  Bell,
  Settings,
  type LucideIcon,
} from "lucide-react";

import type { DashboardModule } from "@/types/roles";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  module: DashboardModule;
}

export const DASHBOARD_NAV: NavItem[] = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard, module: "panel" },
  { href: "/dashboard/ciudadanos", label: "Ciudadanos", icon: Users, module: "ciudadanos" },
  { href: "/dashboard/contactos", label: "Contactos", icon: Contact, module: "contactos" },
  { href: "/dashboard/solicitudes", label: "Solicitudes", icon: Inbox, module: "solicitudes" },
  { href: "/dashboard/tareas", label: "Tareas", icon: ListChecks, module: "tareas" },
  { href: "/dashboard/calendario", label: "Calendario", icon: CalendarDays, module: "calendario" },
  { href: "/dashboard/territorio", label: "Territorio", icon: MapPinned, module: "territorio" },
  { href: "/dashboard/comunicaciones", label: "Comunicaciones", icon: Megaphone, module: "comunicaciones" },
  { href: "/dashboard/documentos", label: "Documentos", icon: FileText, module: "documentos" },
  { href: "/dashboard/reportes", label: "Reportes", icon: BarChart3, module: "reportes" },
  { href: "/dashboard/ia", label: "Asistente IA", icon: Sparkles, module: "ia" },
  { href: "/dashboard/notificaciones", label: "Notificaciones", icon: Bell, module: "notificaciones" },
  { href: "/dashboard/configuracion", label: "Configuración", icon: Settings, module: "configuracion" },
];
