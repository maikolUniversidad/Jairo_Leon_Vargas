import "server-only";

import { createClient } from "@/lib/supabase/server";

export type PersonaTipo = "ciudadano" | "contacto";

/**
 * Construye un bloque de contexto (texto) sobre una persona (ciudadano o
 * contacto) para inyectarlo al sistema del asistente. Respeta RLS: usa el
 * cliente autenticado del usuario. Devuelve null si no encuentra la persona.
 */
export async function buildPersonaContext(id: string, tipo: PersonaTipo): Promise<string | null> {
  const supabase = await createClient();

  if (tipo === "ciudadano") {
    const { data: c } = await supabase
      .from("citizens")
      .select("nombre, apellido, documento, telefono, email, localidad, barrio, estado, intereses, observaciones")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!c) return null;

    const { data: reqs } = await supabase
      .from("requests")
      .select("radicado, asunto, tipo_solicitud, estado, prioridad, fecha_recepcion")
      .eq("citizen_id", id)
      .is("deleted_at", null)
      .order("fecha_recepcion", { ascending: false })
      .limit(10);

    const lineas: string[] = [];
    lineas.push(`CIUDADANO: ${c.nombre} ${c.apellido ?? ""}`.trim());
    if (c.documento) lineas.push(`Documento: ${c.documento}`);
    const ubic = [c.localidad, c.barrio].filter(Boolean).join(" · ");
    if (ubic) lineas.push(`Ubicación: ${ubic}`);
    if (c.telefono) lineas.push(`Teléfono: ${c.telefono}`);
    if (c.email) lineas.push(`Email: ${c.email}`);
    if (c.estado) lineas.push(`Estado: ${c.estado}`);
    if (Array.isArray(c.intereses) && c.intereses.length) lineas.push(`Intereses: ${c.intereses.join(", ")}`);
    if (c.observaciones) lineas.push(`Observaciones: ${c.observaciones}`);

    if (reqs && reqs.length) {
      lineas.push(`\nSolicitudes (${reqs.length}):`);
      for (const r of reqs) {
        lineas.push(
          `- [${r.radicado ?? "s/rad"}] ${r.asunto ?? "(sin asunto)"} · ${r.tipo_solicitud ?? "?"} · estado: ${r.estado} · prioridad: ${r.prioridad} · ${String(r.fecha_recepcion ?? "").slice(0, 10)}`,
        );
      }
    } else {
      lineas.push("\nSin solicitudes registradas.");
    }
    return lineas.join("\n");
  }

  // Contacto
  const { data: c } = await supabase
    .from("contacts")
    .select("nombre, apellido, puesto, organizacion, tipo, influencia, telefono, email, localidad, barrio, etiquetas, notas, estado")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!c) return null;

  const lineas: string[] = [];
  lineas.push(`CONTACTO: ${c.nombre} ${c.apellido ?? ""}`.trim());
  const rol = [c.puesto, c.organizacion].filter(Boolean).join(" · ");
  if (rol) lineas.push(`Rol: ${rol}`);
  if (c.tipo) lineas.push(`Tipo: ${c.tipo}`);
  if (c.influencia) lineas.push(`Influencia: ${c.influencia}`);
  const ubic = [c.localidad, c.barrio].filter(Boolean).join(" · ");
  if (ubic) lineas.push(`Ubicación: ${ubic}`);
  if (c.telefono) lineas.push(`Teléfono: ${c.telefono}`);
  if (c.email) lineas.push(`Email: ${c.email}`);
  if (Array.isArray(c.etiquetas) && c.etiquetas.length) lineas.push(`Etiquetas: ${c.etiquetas.join(", ")}`);
  if (c.notas) lineas.push(`Notas: ${c.notas}`);
  return lineas.join("\n");
}
