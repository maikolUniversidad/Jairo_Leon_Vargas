import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** ISO → formato UTC compacto YYYYMMDDTHHMMSSZ */
function toUtc(iso: string): string {
  const d = new Date(iso);
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

/** ¿La fecha viene como solo-día (sin hora)? */
function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toDateValue(value: string): string {
  const d = new Date(value);
  return d.getUTCFullYear().toString() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate());
}

function esc(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) return new Response("Not found", { status: 404 });

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return new Response("Server not configured", { status: 500 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("calendar_token", token)
    .maybeSingle();
  if (!profile) return new Response("Not found", { status: 404 });

  const userId = profile.id as string;

  // Eventos: públicos, o donde el usuario es responsable/creador
  const { data: events } = await admin
    .from("events")
    .select("id, titulo, descripcion, lugar, fecha_inicio, fecha_fin, visibilidad, link_reunion")
    .is("deleted_at", null)
    .or(`visibilidad.eq.publica,responsable_id.eq.${userId},created_by.eq.${userId}`)
    .limit(1000);

  // Tareas del usuario (responsable/creador o asignado) con fecha límite
  const { data: assignedRows } = await admin
    .from("task_assignees")
    .select("task_id")
    .eq("user_id", userId);
  const assignedIds = (assignedRows ?? []).map((r) => r.task_id);

  const orParts = [`responsable_id.eq.${userId}`, `creador_id.eq.${userId}`];
  if (assignedIds.length > 0) orParts.push(`id.in.(${assignedIds.join(",")})`);

  const { data: tasks } = await admin
    .from("tasks")
    .select("id, titulo, descripcion, fecha_limite, estado")
    .is("deleted_at", null)
    .not("fecha_limite", "is", null)
    .or(orParts.join(","))
    .limit(1000);

  const stamp = toUtc(new Date().toISOString());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//UTL 360//Agenda//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:UTL 360",
    "X-WR-TIMEZONE:America/Bogota",
  ];

  for (const e of events ?? []) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:event-${e.id}@utl360`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART:${toUtc(e.fecha_inicio)}`);
    lines.push(`DTEND:${toUtc(e.fecha_fin ?? e.fecha_inicio)}`);
    lines.push(`SUMMARY:${esc(e.titulo)}${e.visibilidad === "publica" ? "" : " (interno)"}`);
    const desc = [e.descripcion, e.link_reunion ? `Enlace: ${e.link_reunion}` : null]
      .filter(Boolean)
      .join("\n");
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
    if (e.lugar) lines.push(`LOCATION:${esc(e.lugar)}`);
    lines.push("END:VEVENT");
  }

  for (const t of tasks ?? []) {
    const fl = t.fecha_limite as string;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:task-${t.id}@utl360`);
    lines.push(`DTSTAMP:${stamp}`);
    if (isDateOnly(fl)) {
      lines.push(`DTSTART;VALUE=DATE:${toDateValue(fl)}`);
    } else {
      lines.push(`DTSTART:${toUtc(fl)}`);
      lines.push(`DTEND:${toUtc(fl)}`);
    }
    lines.push(`SUMMARY:📌 ${esc(t.titulo)}`);
    if (t.descripcion) lines.push(`DESCRIPTION:${esc(t.descripcion)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  const body = lines.join("\r\n");

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="utl360.ics"',
      "Cache-Control": "public, max-age=300",
    },
  });
}
