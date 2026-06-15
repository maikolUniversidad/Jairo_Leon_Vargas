"use server";

import { createClient } from "@/lib/supabase/server";

export interface AuditEntry {
  id: string;
  fuente: "mutacion" | "actividad";
  actor_id: string | null;
  actor_nombre: string;
  accion: string;
  entidad: string | null;
  entidad_id: string | null;
  detalle: string | null;
  created_at: string;
}

export interface AuditTrail {
  entries: AuditEntry[];
  entidades: string[];
  acciones: string[];
}

/** Devuelve el rastro unificado (mutaciones + actividad), con nombres de actor. */
export async function getAuditTrail(limit = 400): Promise<AuditTrail> {
  const supabase = await createClient();

  const [audit, activity] = await Promise.all([
    supabase
      .from("audit_logs")
      .select("id, actor_id, accion, entidad, entidad_id, created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("activity_log")
      .select("id, user_id, accion, entidad, entidad_id, detalle, created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  const auditRows = audit.data ?? [];
  const actRows = activity.data ?? [];

  // Nombres de actor
  const ids = Array.from(
    new Set([
      ...auditRows.map((r) => r.actor_id as string | null),
      ...actRows.map((r) => r.user_id as string | null),
    ].filter((x): x is string => Boolean(x))),
  );
  const nameById = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
    for (const p of profiles ?? []) nameById.set(p.id, p.full_name ?? p.email ?? "—");
  }

  const entries: AuditEntry[] = [
    ...auditRows.map((r) => ({
      id: `a-${r.id}`,
      fuente: "mutacion" as const,
      actor_id: (r.actor_id as string) ?? null,
      actor_nombre: r.actor_id ? nameById.get(r.actor_id as string) ?? "—" : "Sistema",
      accion: r.accion as string,
      entidad: (r.entidad as string) ?? null,
      entidad_id: (r.entidad_id as string) ?? null,
      detalle: null,
      created_at: r.created_at as string,
    })),
    ...actRows.map((r) => ({
      id: `v-${r.id}`,
      fuente: "actividad" as const,
      actor_id: (r.user_id as string) ?? null,
      actor_nombre: r.user_id ? nameById.get(r.user_id as string) ?? "—" : "Sistema",
      accion: r.accion as string,
      entidad: (r.entidad as string) ?? null,
      entidad_id: (r.entidad_id as string) ?? null,
      detalle: (r.detalle as string) ?? null,
      created_at: r.created_at as string,
    })),
  ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const entidades = Array.from(new Set(entries.map((e) => e.entidad).filter((x): x is string => Boolean(x)))).sort();
  const acciones = Array.from(new Set(entries.map((e) => e.accion))).sort();

  return { entries: entries.slice(0, limit), entidades, acciones };
}
