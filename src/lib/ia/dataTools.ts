import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createTask } from "@/actions/tareas";
import type { ToolDef } from "@/lib/ia/provider";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Herramientas de datos del asistente (function calling).
 *
 * - Consultas de SOLO LECTURA y una acción de escritura reversible (crear tarea).
 * - Todas usan el cliente autenticado → respetan RLS (la IA nunca ve más de lo
 *   que vería el usuario en la plataforma).
 * - Además se filtran por los módulos visibles del usuario (defensa en capas).
 * - Devuelven objetos compactos (conteos/agrupaciones) para no volcar PII masiva.
 */

/** Módulo requerido por herramienta (gating por permisos). */
const TOOL_MODULE: Record<string, string | string[]> = {
  resumen_plataforma: "panel",
  consultar_solicitudes: "solicitudes",
  consultar_tareas: "tareas",
  consultar_ciudadanos: "ciudadanos",
  consultar_contactos: "contactos",
  consultar_agenda: "calendario",
  consultar_territorio: "territorio",
  buscar_persona: ["ciudadanos", "contactos"],
  crear_tarea: "tareas",
};

const MAX_ROWS = 5000; // tope defensivo para agregaciones en memoria

function canUse(tool: string, viewableModules: string[]): boolean {
  const req = TOOL_MODULE[tool];
  if (!req) return false;
  return Array.isArray(req)
    ? req.some((m) => viewableModules.includes(m))
    : viewableModules.includes(req);
}

function groupCount<T>(rows: T[], key: (r: T) => string | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = (key(r) ?? "").toString().trim() || "(sin dato)";
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ─────────────────────────── Definiciones (schema) ─────────────────────────── */

const DEFS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "resumen_plataforma",
      description:
        "Panorama general de la plataforma: total de ciudadanos, solicitudes por estado, tareas abiertas, próximos eventos y contactos. Úsalo para preguntas amplias tipo '¿cómo vamos?'.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_solicitudes",
      description:
        "Consulta solicitudes ciudadanas (radicados). Filtra y/o agrupa para obtener conteos reales. Devuelve totales y, si se pide, una lista breve.",
      parameters: {
        type: "object",
        properties: {
          estado: { type: "string", enum: ["recibida", "clasificada", "asignada", "en_gestion", "respondida", "cerrada", "archivada"] },
          prioridad: { type: "string", enum: ["baja", "media", "alta", "urgente"] },
          tipo_solicitud: { type: "string", description: "Categoría/tipo de la solicitud, si se conoce." },
          localidad: { type: "string" },
          desde: { type: "string", description: "Fecha ISO (YYYY-MM-DD) mínima de recepción." },
          hasta: { type: "string", description: "Fecha ISO (YYYY-MM-DD) máxima de recepción." },
          agrupar_por: { type: "string", enum: ["estado", "prioridad", "localidad", "tipo_solicitud"] },
          incluir_lista: { type: "boolean", description: "Si true, incluye hasta 15 solicitudes (campos mínimos)." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_tareas",
      description:
        "Consulta tareas del equipo (Kanban). Permite filtrar por estado/prioridad/responsable y detectar tareas vencidas.",
      parameters: {
        type: "object",
        properties: {
          estado: { type: "string", enum: ["pendiente", "en_proceso", "bloqueada", "en_revision", "aprobada", "finalizada", "cancelada"] },
          prioridad: { type: "string", enum: ["baja", "media", "alta", "urgente"] },
          responsable_id: { type: "string" },
          vencidas: { type: "boolean", description: "Si true, solo tareas con fecha límite pasada y no finalizadas/canceladas." },
          agrupar_por: { type: "string", enum: ["estado", "prioridad"] },
          incluir_lista: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_ciudadanos",
      description:
        "Consulta la base de ciudadanos. Ideal para conteos por localidad, estado o interés. No devuelve datos personales masivos.",
      parameters: {
        type: "object",
        properties: {
          localidad: { type: "string" },
          estado: { type: "string" },
          interes: { type: "string", description: "Filtra por un interés declarado." },
          agrupar_por: { type: "string", enum: ["localidad", "estado", "interes"] },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_contactos",
      description:
        "Consulta la agenda de contactos (líderes, funcionarios, aliados, medios). Filtra o agrupa por tipo, influencia o localidad.",
      parameters: {
        type: "object",
        properties: {
          tipo: { type: "string" },
          influencia: { type: "string" },
          localidad: { type: "string" },
          agrupar_por: { type: "string", enum: ["tipo", "influencia", "localidad"] },
          incluir_lista: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_agenda",
      description:
        "Consulta eventos de la agenda (recorridos, reuniones). Por defecto los próximos. Filtra por rango de fechas y visibilidad.",
      parameters: {
        type: "object",
        properties: {
          desde: { type: "string", description: "Fecha ISO mínima; por defecto hoy." },
          hasta: { type: "string" },
          visibilidad: { type: "string", enum: ["publica", "interna"] },
          limite: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_territorio",
      description:
        "Zonas del territorio con su prioridad y cantidad de tareas abiertas. Útil para saber dónde se concentra el trabajo.",
      parameters: {
        type: "object",
        properties: { localidad: { type: "string" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_persona",
      description:
        "Busca un ciudadano o contacto por nombre o documento. Devuelve coincidencias con su id (para consultas de seguimiento).",
      parameters: {
        type: "object",
        properties: {
          texto: { type: "string", description: "Nombre o documento a buscar." },
          tipo: { type: "string", enum: ["ciudadano", "contacto"] },
        },
        required: ["texto"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crear_tarea",
      description:
        "Crea una tarea en el Kanban del equipo (acción reversible). Úsala solo cuando el usuario pida explícitamente crear/registrar una tarea. Confirma el título antes de llamarla.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Título claro y accionable (mín. 3 caracteres)." },
          descripcion: { type: "string" },
          prioridad: { type: "string", enum: ["baja", "media", "alta", "urgente"] },
          fecha_limite: { type: "string", description: "Fecha ISO YYYY-MM-DD (opcional)." },
          responsable_id: { type: "string", description: "UUID del responsable (opcional)." },
        },
        required: ["titulo"],
        additionalProperties: false,
      },
    },
  },
];

/** Devuelve las definiciones de herramientas visibles para el usuario. */
export function getToolDefs(viewableModules: string[]): ToolDef[] {
  return DEFS.filter((d) => canUse(d.function.name, viewableModules));
}

/* ─────────────────────────── Ejecución ─────────────────────────── */

/**
 * Ejecuta una herramienta por nombre. `argsJson` es la cadena JSON que envía el
 * modelo. Devuelve un objeto serializable (o un objeto con `error`).
 */
export async function runTool(
  name: string,
  argsJson: string,
  viewableModules: string[],
): Promise<unknown> {
  if (!canUse(name, viewableModules)) {
    return { error: "sin_acceso", detalle: "No tienes permiso para este dato." };
  }

  let args: any = {};
  try {
    args = argsJson ? JSON.parse(argsJson) : {};
  } catch {
    return { error: "argumentos_invalidos" };
  }

  const supabase = await createClient();

  try {
    switch (name) {
      case "resumen_plataforma": {
        const [ciudadanos, solRecibida, solEnGestion, tareasAbiertas, eventosProx, contactos] = await Promise.all([
          countRows(supabase, "citizens"),
          countRows(supabase, "requests", (q) => q.eq("estado", "recibida")),
          countRows(supabase, "requests", (q) => q.eq("estado", "en_gestion")),
          countRows(supabase, "tasks", (q) => q.not("estado", "in", "(finalizada,cancelada)")),
          countRows(supabase, "events", (q) => q.gte("fecha_inicio", new Date().toISOString())),
          countRows(supabase, "contacts"),
        ]);
        return {
          ciudadanos_total: ciudadanos,
          solicitudes_recibidas: solRecibida,
          solicitudes_en_gestion: solEnGestion,
          tareas_abiertas: tareasAbiertas,
          eventos_proximos: eventosProx,
          contactos_total: contactos,
        };
      }

      case "consultar_solicitudes": {
        let q = supabase.from("requests").select("estado, prioridad, localidad, tipo_solicitud, radicado, asunto, fecha_recepcion").is("deleted_at", null);
        if (args.estado) q = q.eq("estado", args.estado);
        if (args.prioridad) q = q.eq("prioridad", args.prioridad);
        if (args.tipo_solicitud) q = q.eq("tipo_solicitud", args.tipo_solicitud);
        if (args.localidad) q = q.ilike("localidad", `%${args.localidad}%`);
        if (args.desde) q = q.gte("fecha_recepcion", args.desde);
        if (args.hasta) q = q.lte("fecha_recepcion", args.hasta);
        const { data, error } = await q.limit(MAX_ROWS);
        if (error) return { error: "consulta_fallida", detalle: error.message };
        const rows = data ?? [];
        const res: any = { total: rows.length };
        if (args.agrupar_por) res.por_grupo = groupCount(rows, (r: any) => r[args.agrupar_por]);
        if (args.incluir_lista) {
          res.lista = rows.slice(0, 15).map((r: any) => ({
            radicado: r.radicado, asunto: r.asunto, estado: r.estado,
            prioridad: r.prioridad, localidad: r.localidad, fecha: String(r.fecha_recepcion ?? "").slice(0, 10),
          }));
        }
        return res;
      }

      case "consultar_tareas": {
        let q = supabase.from("tasks").select("estado, prioridad, responsable_id, fecha_limite, titulo").is("deleted_at", null);
        if (args.estado) q = q.eq("estado", args.estado);
        if (args.prioridad) q = q.eq("prioridad", args.prioridad);
        if (args.responsable_id) q = q.eq("responsable_id", args.responsable_id);
        if (args.vencidas) {
          q = q.lt("fecha_limite", todayISO()).not("estado", "in", "(finalizada,cancelada)");
        }
        const { data, error } = await q.limit(MAX_ROWS);
        if (error) return { error: "consulta_fallida", detalle: error.message };
        const rows = data ?? [];
        const res: any = { total: rows.length };
        if (args.agrupar_por) res.por_grupo = groupCount(rows, (r: any) => r[args.agrupar_por]);
        if (args.incluir_lista) {
          res.lista = rows.slice(0, 15).map((r: any) => ({
            titulo: r.titulo, estado: r.estado, prioridad: r.prioridad,
            fecha_limite: r.fecha_limite ? String(r.fecha_limite).slice(0, 10) : null,
          }));
        }
        return res;
      }

      case "consultar_ciudadanos": {
        let q = supabase.from("citizens").select("localidad, estado, intereses").is("deleted_at", null);
        if (args.localidad) q = q.ilike("localidad", `%${args.localidad}%`);
        if (args.estado) q = q.eq("estado", args.estado);
        if (args.interes) q = q.contains("intereses", [args.interes]);
        const { data, error } = await q.limit(MAX_ROWS);
        if (error) return { error: "consulta_fallida", detalle: error.message };
        const rows = data ?? [];
        const res: any = { total: rows.length };
        if (args.agrupar_por === "interes") {
          const out: Record<string, number> = {};
          for (const r of rows as any[]) for (const it of r.intereses ?? []) out[it] = (out[it] ?? 0) + 1;
          res.por_grupo = out;
        } else if (args.agrupar_por) {
          res.por_grupo = groupCount(rows, (r: any) => r[args.agrupar_por]);
        }
        return res;
      }

      case "consultar_contactos": {
        let q = supabase.from("contacts").select("tipo, influencia, localidad, organizacion, nombre, apellido").is("deleted_at", null);
        if (args.tipo) q = q.eq("tipo", args.tipo);
        if (args.influencia) q = q.eq("influencia", args.influencia);
        if (args.localidad) q = q.ilike("localidad", `%${args.localidad}%`);
        const { data, error } = await q.limit(MAX_ROWS);
        if (error) return { error: "consulta_fallida", detalle: error.message };
        const rows = data ?? [];
        const res: any = { total: rows.length };
        if (args.agrupar_por) res.por_grupo = groupCount(rows, (r: any) => r[args.agrupar_por]);
        if (args.incluir_lista) {
          res.lista = rows.slice(0, 15).map((r: any) => ({
            nombre: `${r.nombre} ${r.apellido ?? ""}`.trim(), tipo: r.tipo,
            organizacion: r.organizacion, influencia: r.influencia, localidad: r.localidad,
          }));
        }
        return res;
      }

      case "consultar_agenda": {
        const desde = args.desde || todayISO();
        let q = supabase.from("events").select("titulo, tipo, fecha_inicio, lugar, visibilidad, estado").is("deleted_at", null).gte("fecha_inicio", desde).order("fecha_inicio", { ascending: true });
        if (args.hasta) q = q.lte("fecha_inicio", args.hasta);
        if (args.visibilidad) q = q.eq("visibilidad", args.visibilidad);
        const { data, error } = await q.limit(Math.min(args.limite || 20, 50));
        if (error) return { error: "consulta_fallida", detalle: error.message };
        return {
          total: (data ?? []).length,
          eventos: (data ?? []).map((e: any) => ({
            titulo: e.titulo, tipo: e.tipo, cuando: String(e.fecha_inicio).slice(0, 16).replace("T", " "),
            lugar: e.lugar, visibilidad: e.visibilidad, estado: e.estado,
          })),
        };
      }

      case "consultar_territorio": {
        let zq = supabase.from("zones").select("id, nombre_zona, tipo_zona, prioridad").is("deleted_at", null);
        if (args.localidad) zq = zq.ilike("nombre_zona", `%${args.localidad}%`);
        const { data: zones, error } = await zq.limit(200);
        if (error) return { error: "consulta_fallida", detalle: error.message };
        const { data: tasks } = await supabase
          .from("tasks").select("zona_id, estado").is("deleted_at", null).not("zona_id", "is", null);
        const abiertasPorZona: Record<string, number> = {};
        for (const t of (tasks as any[]) ?? []) {
          if (t.estado === "finalizada" || t.estado === "cancelada") continue;
          abiertasPorZona[t.zona_id] = (abiertasPorZona[t.zona_id] ?? 0) + 1;
        }
        return {
          zonas: (zones as any[] ?? []).map((z) => ({
            nombre: z.nombre_zona, tipo: z.tipo_zona, prioridad: z.prioridad,
            tareas_abiertas: abiertasPorZona[z.id] ?? 0,
          })),
        };
      }

      case "buscar_persona": {
        const texto = String(args.texto ?? "").trim();
        if (texto.length < 2) return { error: "texto_muy_corto" };
        const like = `%${texto}%`;
        const out: any = {};
        if (args.tipo !== "contacto" && viewableModules.includes("ciudadanos")) {
          const { data } = await supabase
            .from("citizens").select("id, nombre, apellido, documento, localidad").is("deleted_at", null)
            .or(`nombre.ilike.${like},apellido.ilike.${like},documento.ilike.${like}`).limit(8);
          out.ciudadanos = (data as any[] ?? []).map((c) => ({
            id: c.id, nombre: `${c.nombre} ${c.apellido ?? ""}`.trim(), documento: c.documento, localidad: c.localidad,
          }));
        }
        if (args.tipo !== "ciudadano" && viewableModules.includes("contactos")) {
          const { data } = await supabase
            .from("contacts").select("id, nombre, apellido, organizacion, tipo").is("deleted_at", null)
            .or(`nombre.ilike.${like},apellido.ilike.${like}`).limit(8);
          out.contactos = (data as any[] ?? []).map((c) => ({
            id: c.id, nombre: `${c.nombre} ${c.apellido ?? ""}`.trim(), organizacion: c.organizacion, tipo: c.tipo,
          }));
        }
        return out;
      }

      case "crear_tarea": {
        const res = await createTask({
          titulo: args.titulo,
          descripcion: args.descripcion || "",
          prioridad: args.prioridad || "media",
          fecha_limite: args.fecha_limite || "",
          responsable_id: args.responsable_id || "",
        });
        return { ok: res.ok, message: res.message };
      }

      default:
        return { error: "herramienta_desconocida" };
    }
  } catch (e) {
    return { error: "excepcion", detalle: e instanceof Error ? e.message : "desconocido" };
  }
}

/** Cuenta filas (respetando RLS) con filtros opcionales; excluye borradas. */
async function countRows(
  supabase: any,
  table: string,
  filter?: (q: any) => any,
): Promise<number> {
  let q = supabase.from(table).select("id", { count: "exact", head: true }).is("deleted_at", null);
  if (filter) q = filter(q);
  const { count } = await q;
  return count ?? 0;
}
