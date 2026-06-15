"use server";

import { createClient } from "@/lib/supabase/server";

type Counts = Record<string, number>;

function tally(rows: { [k: string]: unknown }[], key: string): Counts {
  const out: Counts = {};
  for (const r of rows) {
    const v = (r[key] as string) || "(sin dato)";
    out[v] = (out[v] ?? 0) + 1;
  }
  return out;
}

export interface GeneralReport {
  solicitudes: { total: number; porEstado: Counts; porLocalidad: Counts; porSemaforo: Counts; porTipo: Counts };
  tareas: { total: number; porEstado: Counts; porPrioridad: Counts };
  ciudadanos: { total: number; porLocalidad: Counts };
  eventos: { total: number; proximos: number };
  contactos: { total: number; porTipo: Counts };
  documentos: { total: number };
}

export async function getGeneralReport(): Promise<GeneralReport> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [sol, tar, ciu, evTotal, evProx, con, docTotal] = await Promise.all([
    supabase.from("requests").select("estado, localidad, semaforo, tipo_solicitud").is("deleted_at", null).limit(5000),
    supabase.from("tasks").select("estado, prioridad").is("deleted_at", null).limit(5000),
    supabase.from("citizens").select("localidad").is("deleted_at", null).limit(5000),
    supabase.from("events").select("*", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("events").select("*", { count: "exact", head: true }).is("deleted_at", null).gte("fecha_inicio", nowIso),
    supabase.from("contacts").select("tipo").is("deleted_at", null).limit(5000),
    supabase.from("documents").select("*", { count: "exact", head: true }).is("deleted_at", null),
  ]);

  const solRows = sol.data ?? [];
  const tarRows = tar.data ?? [];
  const ciuRows = ciu.data ?? [];
  const conRows = con.data ?? [];

  return {
    solicitudes: {
      total: solRows.length,
      porEstado: tally(solRows, "estado"),
      porLocalidad: tally(solRows, "localidad"),
      porSemaforo: tally(solRows, "semaforo"),
      porTipo: tally(solRows, "tipo_solicitud"),
    },
    tareas: { total: tarRows.length, porEstado: tally(tarRows, "estado"), porPrioridad: tally(tarRows, "prioridad") },
    ciudadanos: { total: ciuRows.length, porLocalidad: tally(ciuRows, "localidad") },
    eventos: { total: evTotal.count ?? 0, proximos: evProx.count ?? 0 },
    contactos: { total: conRows.length, porTipo: tally(conRows, "tipo") },
    documentos: { total: docTotal.count ?? 0 },
  };
}

export interface PersonOption { id: string; full_name: string | null; email: string | null }

export async function listReportUsers(): Promise<PersonOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .order("full_name");
  return (data as PersonOption[]) ?? [];
}

export interface PersonActivityItem {
  fuente: "mutacion" | "actividad";
  accion: string;
  entidad: string | null;
  detalle: string | null;
  created_at: string;
}

export interface PersonReport {
  resumen: Counts; // métricas clave
  porEntidad: Counts; // mutaciones por entidad
  porActividad: Counts; // login/subida/descarga...
  timeline: PersonActivityItem[];
}

export async function getPersonReport(userId: string): Promise<PersonReport> {
  const supabase = await createClient();

  const [audit, activity, tareasCreadas, tareasResp, solResp, docsCreados, contCreados] = await Promise.all([
    supabase.from("audit_logs").select("accion, entidad, entidad_id, created_at").eq("actor_id", userId).order("created_at", { ascending: false }).limit(500),
    supabase.from("activity_log").select("accion, entidad, detalle, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
    supabase.from("tasks").select("*", { count: "exact", head: true }).eq("creador_id", userId).is("deleted_at", null),
    supabase.from("tasks").select("*", { count: "exact", head: true }).eq("responsable_id", userId).is("deleted_at", null),
    supabase.from("requests").select("*", { count: "exact", head: true }).eq("responsable_id", userId).is("deleted_at", null),
    supabase.from("documents").select("*", { count: "exact", head: true }).eq("creado_por", userId).is("deleted_at", null),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("created_by", userId).is("deleted_at", null),
  ]);

  const auditRows = audit.data ?? [];
  const actRows = activity.data ?? [];

  const porActividad = tally(actRows, "accion");
  const resumen: Counts = {
    "Tareas creadas": tareasCreadas.count ?? 0,
    "Tareas asignadas": tareasResp.count ?? 0,
    "Solicitudes a cargo": solResp.count ?? 0,
    "Documentos creados": docsCreados.count ?? 0,
    "Contactos creados": contCreados.count ?? 0,
    "Subidas": porActividad["subida"] ?? 0,
    "Descargas": porActividad["descarga"] ?? 0,
    "Inicios de sesión": porActividad["login"] ?? 0,
    "Cambios registrados": auditRows.length,
  };

  const timeline: PersonActivityItem[] = [
    ...auditRows.map((r) => ({
      fuente: "mutacion" as const,
      accion: r.accion as string,
      entidad: (r.entidad as string) ?? null,
      detalle: (r.entidad_id as string) ?? null,
      created_at: r.created_at as string,
    })),
    ...actRows.map((r) => ({
      fuente: "actividad" as const,
      accion: r.accion as string,
      entidad: (r.entidad as string) ?? null,
      detalle: (r.detalle as string) ?? null,
      created_at: r.created_at as string,
    })),
  ]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 100);

  return { resumen, porEntidad: tally(auditRows, "entidad"), porActividad, timeline };
}
