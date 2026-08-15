"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  CATEGORIAS_EQUIPO,
  CONDICIONES,
  ESTADOS_EQUIPO,
  ESTADOS_PARTE,
  MOMENTOS_EVIDENCIA,
  SEVERIDADES,
  TIPOS_NOVEDAD,
  esVencido,
  type ChecklistItem,
  type EquipoConResumen,
  type EquipoDetalle,
  type EquipoInventario,
  type EstadoEquipo,
  type EvidenciaInventario,
  type InventarioStats,
  type NovedadInventario,
  type ParteEquipo,
  type PrestamoInventario,
  type UsuarioInventario,
} from "@/lib/inventario-shared";
import { zodToFieldErrors, type ActionResult } from "./types";

const RUTA = "/dashboard/inventario";
const DUPLICADO = "23505";

/** Solo admins/dirección/coordinación/comunicaciones gestionan el inventario. */
async function puedeGestionar(): Promise<boolean> {
  const u = await getSessionUser();
  if (!u) return false;
  return (
    u.isAdmin ||
    u.roles.some((r) => ["direccion_general", "coordinador_utl", "comunicaciones"].includes(r))
  );
}

/** Resuelve id de usuario → nombre desde `profiles` (los FK apuntan a auth.users). */
async function resolverNombres(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  const nombres = new Map<string, string>();
  if (unicos.length === 0) return nombres;
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", unicos);
  for (const p of (data ?? []) as { id: string; full_name: string | null }[]) {
    nombres.set(p.id, p.full_name?.trim() || "Sin nombre");
  }
  return nombres;
}

/* ═══════════════════════════════ Lecturas ═══════════════════════════════ */

interface FilaEquipo extends EquipoInventario {
  created_at?: string;
}

/** Catálogo de equipos con datos derivados (partes, préstamo vigente, novedades). */
export async function listEquiposResumen(): Promise<EquipoConResumen[]> {
  const supabase = await createClient();

  const [{ data: equipos }, { data: partes }, { data: prestamos }, { data: novedades }] =
    await Promise.all([
      supabase.from("inventario_equipos").select("*").order("nombre"),
      supabase.from("inventario_partes").select("equipo_id, estado"),
      supabase
        .from("inventario_prestamos")
        .select("id, equipo_id, responsable_id, estado, fecha_salida, fecha_prevista")
        .eq("estado", "activo"),
      supabase.from("inventario_novedades").select("equipo_id, resuelto").eq("resuelto", false),
    ]);

  const filas = (equipos ?? []) as FilaEquipo[];

  const partesTotal = new Map<string, number>();
  const partesIncompletas = new Map<string, number>();
  for (const p of (partes ?? []) as { equipo_id: string; estado: string }[]) {
    partesTotal.set(p.equipo_id, (partesTotal.get(p.equipo_id) ?? 0) + 1);
    if (p.estado !== "ok")
      partesIncompletas.set(p.equipo_id, (partesIncompletas.get(p.equipo_id) ?? 0) + 1);
  }

  const novedadesAbiertas = new Map<string, number>();
  for (const n of (novedades ?? []) as { equipo_id: string }[]) {
    novedadesAbiertas.set(n.equipo_id, (novedadesAbiertas.get(n.equipo_id) ?? 0) + 1);
  }

  const activos = (prestamos ?? []) as {
    id: string;
    equipo_id: string;
    responsable_id: string | null;
    estado: string;
    fecha_salida: string | null;
    fecha_prevista: string | null;
  }[];
  const nombres = await resolverNombres(supabase, activos.map((p) => p.responsable_id));
  const prestamoPorEquipo = new Map<string, (typeof activos)[number]>();
  for (const p of activos) prestamoPorEquipo.set(p.equipo_id, p);

  return filas.map((e) => {
    const pa = prestamoPorEquipo.get(e.id);
    return {
      id: e.id,
      codigo: e.codigo,
      nombre: e.nombre,
      categoria: e.categoria,
      marca: e.marca,
      modelo: e.modelo,
      serial: e.serial,
      estado: e.estado,
      condicion: e.condicion,
      ubicacion: e.ubicacion,
      valor: e.valor,
      fecha_compra: e.fecha_compra,
      notas: e.notas,
      foto_url: e.foto_url,
      activo: e.activo,
      partes_total: partesTotal.get(e.id) ?? 0,
      partes_incompletas: partesIncompletas.get(e.id) ?? 0,
      novedades_abiertas: novedadesAbiertas.get(e.id) ?? 0,
      prestamo_activo: pa
        ? {
            id: pa.id,
            responsable_nombre: pa.responsable_id
              ? nombres.get(pa.responsable_id) ?? "Sin nombre"
              : "Sin responsable",
            fecha_salida: pa.fecha_salida,
            fecha_prevista: pa.fecha_prevista,
            vencido: esVencido("activo", pa.fecha_prevista),
          }
        : null,
    };
  });
}

export async function getInventarioStats(): Promise<InventarioStats> {
  const equipos = await listEquiposResumen();
  const activos = equipos.filter((e) => e.activo);
  return {
    total: activos.length,
    disponibles: activos.filter((e) => e.estado === "disponible").length,
    prestados: activos.filter((e) => e.estado === "prestado").length,
    mantenimiento: activos.filter((e) => e.estado === "mantenimiento" || e.estado === "danado").length,
    novedades_abiertas: activos.reduce((s, e) => s + e.novedades_abiertas, 0),
    vencidos: activos.filter((e) => e.prestamo_activo?.vencido).length,
  };
}

interface FilaPrestamo {
  id: string;
  equipo_id: string;
  responsable_id: string | null;
  entregado_por: string | null;
  recibido_por: string | null;
  estado: PrestamoInventario["estado"];
  proposito: string | null;
  fecha_salida: string | null;
  fecha_prevista: string | null;
  fecha_devolucion: string | null;
  condicion_salida: PrestamoInventario["condicion_salida"];
  condicion_devolucion: PrestamoInventario["condicion_devolucion"];
  checklist_salida: ChecklistItem[] | null;
  checklist_devolucion: ChecklistItem[] | null;
  notas_salida: string | null;
  notas_devolucion: string | null;
  created_at: string;
}

async function mapPrestamos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filas: FilaPrestamo[],
): Promise<PrestamoInventario[]> {
  const equipoIds = [...new Set(filas.map((f) => f.equipo_id))];
  const { data: eqs } = equipoIds.length
    ? await supabase.from("inventario_equipos").select("id, nombre").in("id", equipoIds)
    : { data: [] };
  const eqNombre = new Map<string, string>();
  for (const e of (eqs ?? []) as { id: string; nombre: string }[]) eqNombre.set(e.id, e.nombre);

  const nombres = await resolverNombres(
    supabase,
    filas.flatMap((f) => [f.responsable_id, f.entregado_por, f.recibido_por]),
  );

  return filas.map((f) => ({
    id: f.id,
    equipo_id: f.equipo_id,
    equipo_nombre: eqNombre.get(f.equipo_id) ?? "Equipo",
    responsable_id: f.responsable_id,
    responsable_nombre: f.responsable_id ? nombres.get(f.responsable_id) ?? "Sin nombre" : "Sin responsable",
    entregado_por_nombre: f.entregado_por ? nombres.get(f.entregado_por) ?? null : null,
    recibido_por_nombre: f.recibido_por ? nombres.get(f.recibido_por) ?? null : null,
    estado: f.estado,
    proposito: f.proposito,
    fecha_salida: f.fecha_salida,
    fecha_prevista: f.fecha_prevista,
    fecha_devolucion: f.fecha_devolucion,
    condicion_salida: f.condicion_salida,
    condicion_devolucion: f.condicion_devolucion,
    checklist_salida: f.checklist_salida,
    checklist_devolucion: f.checklist_devolucion,
    notas_salida: f.notas_salida,
    notas_devolucion: f.notas_devolucion,
    created_at: f.created_at,
    vencido: esVencido(f.estado, f.fecha_prevista),
  }));
}

export async function listPrestamos(): Promise<PrestamoInventario[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventario_prestamos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  return mapPrestamos(supabase, (data ?? []) as FilaPrestamo[]);
}

interface FilaNovedad {
  id: string;
  equipo_id: string;
  prestamo_id: string | null;
  tipo: NovedadInventario["tipo"];
  severidad: NovedadInventario["severidad"];
  descripcion: string;
  costo: number | null;
  resuelto: boolean;
  reportado_por: string | null;
  created_at: string;
}

async function mapNovedades(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filas: FilaNovedad[],
): Promise<NovedadInventario[]> {
  const equipoIds = [...new Set(filas.map((f) => f.equipo_id))];
  const { data: eqs } = equipoIds.length
    ? await supabase.from("inventario_equipos").select("id, nombre").in("id", equipoIds)
    : { data: [] };
  const eqNombre = new Map<string, string>();
  for (const e of (eqs ?? []) as { id: string; nombre: string }[]) eqNombre.set(e.id, e.nombre);
  const nombres = await resolverNombres(supabase, filas.map((f) => f.reportado_por));

  return filas.map((f) => ({
    id: f.id,
    equipo_id: f.equipo_id,
    equipo_nombre: eqNombre.get(f.equipo_id) ?? "Equipo",
    prestamo_id: f.prestamo_id,
    tipo: f.tipo,
    severidad: f.severidad,
    descripcion: f.descripcion,
    costo: f.costo,
    resuelto: f.resuelto,
    reportado_por_nombre: f.reportado_por ? nombres.get(f.reportado_por) ?? null : null,
    created_at: f.created_at,
  }));
}

export async function listNovedades(): Promise<NovedadInventario[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventario_novedades")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  return mapNovedades(supabase, (data ?? []) as FilaNovedad[]);
}

/** Ficha completa de un equipo: partes, historial de préstamos, novedades y evidencias. */
export async function getEquipoDetalle(id: string): Promise<EquipoDetalle | null> {
  const supabase = await createClient();
  const { data: equipo } = await supabase.from("inventario_equipos").select("*").eq("id", id).maybeSingle();
  if (!equipo) return null;

  const [{ data: partes }, { data: prestamos }, { data: novedades }, { data: evidencias }] =
    await Promise.all([
      supabase.from("inventario_partes").select("*").eq("equipo_id", id).order("created_at"),
      supabase.from("inventario_prestamos").select("*").eq("equipo_id", id).order("created_at", { ascending: false }),
      supabase.from("inventario_novedades").select("*").eq("equipo_id", id).order("created_at", { ascending: false }),
      supabase.from("inventario_evidencias").select("*").eq("equipo_id", id).order("created_at", { ascending: false }),
    ]);

  return {
    equipo: equipo as EquipoInventario,
    partes: (partes ?? []) as ParteEquipo[],
    prestamos: await mapPrestamos(supabase, (prestamos ?? []) as FilaPrestamo[]),
    novedades: await mapNovedades(supabase, (novedades ?? []) as FilaNovedad[]),
    evidencias: (evidencias ?? []) as EvidenciaInventario[],
  };
}

/** Perfiles activos para el selector de responsable de un préstamo. */
export async function listUsuariosInventario(): Promise<UsuarioInventario[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .order("full_name", { ascending: true })
    .limit(500);
  return ((data ?? []) as { id: string; full_name: string | null }[]).map((p) => ({
    id: p.id,
    nombre: p.full_name?.trim() || "Sin nombre",
  }));
}

/* ═══════════════════════════════ Equipos ═══════════════════════════════ */

const equipoSchema = z.object({
  nombre: z.string().trim().min(2, "Escribe el nombre del equipo").max(160),
  codigo: z.string().trim().max(60).optional().nullable(),
  categoria: z.enum(CATEGORIAS_EQUIPO).default("otro"),
  marca: z.string().trim().max(120).optional().nullable(),
  modelo: z.string().trim().max(120).optional().nullable(),
  serial: z.string().trim().max(120).optional().nullable(),
  condicion: z.enum(CONDICIONES).default("bueno"),
  ubicacion: z.string().trim().max(160).optional().nullable(),
  valor: z.coerce.number().min(0).max(1e12).optional().nullable(),
  fecha_compra: z.string().trim().optional().nullable(),
  notas: z.string().trim().max(2000).optional().nullable(),
  foto_url: z.string().trim().url().max(1000).optional().nullable().or(z.literal("")),
});

function limpiar<T extends Record<string, unknown>>(data: T): T {
  const out: Record<string, unknown> = { ...data };
  for (const k of Object.keys(out)) {
    if (out[k] === "" || out[k] === undefined) out[k] = null;
  }
  return out as T;
}

export async function createEquipo(input: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await puedeGestionar())) return { ok: false, message: "No autorizado." };
  const parsed = equipoSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Revisa los campos.", fieldErrors: zodToFieldErrors(parsed.error) };

  const u = await getSessionUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventario_equipos")
    .insert({ ...limpiar(parsed.data), created_by: u?.id ?? null })
    .select("id")
    .single();
  if (error) {
    if (error.code === DUPLICADO)
      return { ok: false, message: "Ya existe un equipo con ese código.", fieldErrors: { codigo: "Código repetido." } };
    return { ok: false, message: "No se pudo crear el equipo." };
  }
  revalidatePath(RUTA);
  return { ok: true, message: "Equipo registrado.", data: { id: (data as { id: string }).id } };
}

export async function updateEquipo(id: string, input: unknown): Promise<ActionResult> {
  if (!(await puedeGestionar())) return { ok: false, message: "No autorizado." };
  const parsed = equipoSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Revisa los campos.", fieldErrors: zodToFieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("inventario_equipos").update(limpiar(parsed.data)).eq("id", id);
  if (error) {
    if (error.code === DUPLICADO)
      return { ok: false, message: "Ya existe un equipo con ese código.", fieldErrors: { codigo: "Código repetido." } };
    return { ok: false, message: "No se pudo actualizar el equipo." };
  }
  revalidatePath(RUTA);
  return { ok: true, message: "Equipo actualizado." };
}

/** Cambia el estado a mano (mantenimiento, baja, disponible…). No aplica a 'prestado'. */
export async function setEquipoEstado(id: string, estado: EstadoEquipo): Promise<ActionResult> {
  if (!(await puedeGestionar())) return { ok: false, message: "No autorizado." };
  if (!ESTADOS_EQUIPO.includes(estado)) return { ok: false, message: "Estado inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("inventario_equipos").update({ estado }).eq("id", id);
  if (error) return { ok: false, message: "No se pudo cambiar el estado." };
  revalidatePath(RUTA);
  return { ok: true, message: "Estado actualizado." };
}

export async function toggleEquipoActivo(id: string, activo: boolean): Promise<ActionResult> {
  if (!(await puedeGestionar())) return { ok: false, message: "No autorizado." };
  const supabase = await createClient();
  const { error } = await supabase.from("inventario_equipos").update({ activo }).eq("id", id);
  if (error) return { ok: false, message: "No se pudo cambiar el equipo." };
  revalidatePath(RUTA);
  return { ok: true, message: activo ? "Equipo reactivado." : "Equipo archivado." };
}

/* ═══════════════════════════════ Partes ═══════════════════════════════ */

const parteSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre de la parte").max(120),
  cantidad: z.coerce.number().int().min(0).max(9999).default(1),
  esencial: z.boolean().default(true),
  estado: z.enum(ESTADOS_PARTE).default("ok"),
  notas: z.string().trim().max(500).optional().nullable(),
});

export async function addParte(equipoId: string, input: unknown): Promise<ActionResult> {
  if (!(await puedeGestionar())) return { ok: false, message: "No autorizado." };
  const parsed = parteSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Revisa los campos.", fieldErrors: zodToFieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase
    .from("inventario_partes")
    .insert({ ...limpiar(parsed.data), equipo_id: equipoId });
  if (error) return { ok: false, message: "No se pudo agregar la parte." };
  revalidatePath(RUTA);
  return { ok: true, message: "Parte agregada." };
}

export async function updateParte(id: string, input: unknown): Promise<ActionResult> {
  if (!(await puedeGestionar())) return { ok: false, message: "No autorizado." };
  const parsed = parteSchema.partial().safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Revisa los campos.", fieldErrors: zodToFieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("inventario_partes").update(limpiar(parsed.data)).eq("id", id);
  if (error) return { ok: false, message: "No se pudo actualizar la parte." };
  revalidatePath(RUTA);
  return { ok: true, message: "Parte actualizada." };
}

export async function removeParte(id: string): Promise<ActionResult> {
  if (!(await puedeGestionar())) return { ok: false, message: "No autorizado." };
  const supabase = await createClient();
  const { error } = await supabase.from("inventario_partes").delete().eq("id", id);
  if (error) return { ok: false, message: "No se pudo quitar la parte." };
  revalidatePath(RUTA);
  return { ok: true, message: "Parte eliminada." };
}

/* ═══════════════════════════════ Préstamos ═══════════════════════════════ */

const checklistSchema = z
  .array(z.object({ parte_id: z.string(), nombre: z.string(), incluida: z.boolean() }))
  .optional()
  .nullable();

const entregaSchema = z.object({
  equipo_id: z.string().uuid("Elige un equipo"),
  responsable_id: z.string().uuid("Elige a quién se le entrega"),
  proposito: z.string().trim().max(500).optional().nullable(),
  fecha_prevista: z.string().trim().optional().nullable(),
  condicion_salida: z.enum(CONDICIONES).default("bueno"),
  checklist_salida: checklistSchema,
  notas_salida: z.string().trim().max(1000).optional().nullable(),
});

/** Un gestor entrega un equipo: crea el préstamo activo y marca el equipo 'prestado'. */
export async function registrarEntrega(input: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await puedeGestionar())) return { ok: false, message: "No autorizado." };
  const parsed = entregaSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Revisa los campos.", fieldErrors: zodToFieldErrors(parsed.error) };

  const u = await getSessionUser();
  const supabase = await createClient();

  // No se puede entregar algo que no está disponible.
  const { data: eq } = await supabase
    .from("inventario_equipos")
    .select("estado, activo")
    .eq("id", parsed.data.equipo_id)
    .maybeSingle();
  if (!eq) return { ok: false, message: "El equipo no existe." };
  if (!(eq as { activo: boolean }).activo) return { ok: false, message: "El equipo está archivado." };
  if ((eq as { estado: string }).estado === "prestado")
    return { ok: false, message: "El equipo ya está prestado." };
  if ((eq as { estado: string }).estado === "baja")
    return { ok: false, message: "El equipo está dado de baja." };

  const { data, error } = await supabase
    .from("inventario_prestamos")
    .insert({
      ...limpiar(parsed.data),
      estado: "activo",
      fecha_salida: new Date().toISOString(),
      entregado_por: u?.id ?? null,
      created_by: u?.id ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: "No se pudo registrar la entrega." };

  await supabase.from("inventario_equipos").update({ estado: "prestado" }).eq("id", parsed.data.equipo_id);
  revalidatePath(RUTA);
  return { ok: true, message: "Entrega registrada.", data: { id: (data as { id: string }).id } };
}

const devolucionSchema = z.object({
  condicion_devolucion: z.enum(CONDICIONES).default("bueno"),
  checklist_devolucion: checklistSchema,
  notas_devolucion: z.string().trim().max(1000).optional().nullable(),
  /** Estado en que queda el equipo tras revisar (default derivado de la condición). */
  estado_equipo: z.enum(ESTADOS_EQUIPO).optional().nullable(),
});

/** Registra la devolución: cierra el préstamo y devuelve el equipo al inventario. */
export async function registrarDevolucion(prestamoId: string, input: unknown): Promise<ActionResult> {
  if (!(await puedeGestionar())) return { ok: false, message: "No autorizado." };
  const parsed = devolucionSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Revisa los campos.", fieldErrors: zodToFieldErrors(parsed.error) };

  const u = await getSessionUser();
  const supabase = await createClient();

  const { data: prest } = await supabase
    .from("inventario_prestamos")
    .select("equipo_id, estado")
    .eq("id", prestamoId)
    .maybeSingle();
  if (!prest) return { ok: false, message: "El préstamo no existe." };
  if ((prest as { estado: string }).estado === "devuelto")
    return { ok: false, message: "Este préstamo ya fue devuelto." };

  const { error } = await supabase
    .from("inventario_prestamos")
    .update({
      estado: "devuelto",
      fecha_devolucion: new Date().toISOString(),
      recibido_por: u?.id ?? null,
      condicion_devolucion: parsed.data.condicion_devolucion,
      checklist_devolucion: parsed.data.checklist_devolucion ?? null,
      notas_devolucion: parsed.data.notas_devolucion?.trim() || null,
    })
    .eq("id", prestamoId);
  if (error) return { ok: false, message: "No se pudo registrar la devolución." };

  // El equipo vuelve al inventario. Si llegó en mal estado, entra a mantenimiento.
  const estadoEquipo: EstadoEquipo =
    parsed.data.estado_equipo ??
    (parsed.data.condicion_devolucion === "malo" ? "danado" : "disponible");
  await supabase
    .from("inventario_equipos")
    .update({ estado: estadoEquipo, condicion: parsed.data.condicion_devolucion })
    .eq("id", (prest as { equipo_id: string }).equipo_id);

  revalidatePath(RUTA);
  return { ok: true, message: "Devolución registrada." };
}

const solicitudSchema = z.object({
  equipo_id: z.string().uuid("Elige un equipo"),
  proposito: z.string().trim().max(500).optional().nullable(),
  fecha_prevista: z.string().trim().optional().nullable(),
});

/** Cualquier miembro del staff puede solicitar un préstamo (queda 'solicitado'). */
export async function solicitarPrestamo(input: unknown): Promise<ActionResult> {
  const u = await getSessionUser();
  if (!u) return { ok: false, message: "Sesión no válida." };
  const parsed = solicitudSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Revisa los campos.", fieldErrors: zodToFieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("inventario_prestamos").insert({
    ...limpiar(parsed.data),
    responsable_id: u.id,
    estado: "solicitado",
    created_by: u.id,
  });
  if (error) return { ok: false, message: "No se pudo enviar la solicitud." };
  revalidatePath(RUTA);
  return { ok: true, message: "Solicitud enviada. Un gestor la revisará." };
}

/** Aprueba una solicitud: se vuelve entrega activa (con datos de salida). */
export async function aprobarSolicitud(prestamoId: string, input: unknown): Promise<ActionResult> {
  if (!(await puedeGestionar())) return { ok: false, message: "No autorizado." };
  const parsed = z
    .object({
      condicion_salida: z.enum(CONDICIONES).default("bueno"),
      checklist_salida: checklistSchema,
      notas_salida: z.string().trim().max(1000).optional().nullable(),
    })
    .safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Revisa los campos.", fieldErrors: zodToFieldErrors(parsed.error) };

  const u = await getSessionUser();
  const supabase = await createClient();
  const { data: prest } = await supabase
    .from("inventario_prestamos")
    .select("equipo_id, estado")
    .eq("id", prestamoId)
    .maybeSingle();
  if (!prest) return { ok: false, message: "La solicitud no existe." };

  const equipoId = (prest as { equipo_id: string }).equipo_id;
  const { data: eq } = await supabase.from("inventario_equipos").select("estado").eq("id", equipoId).maybeSingle();
  if ((eq as { estado: string } | null)?.estado === "prestado")
    return { ok: false, message: "El equipo ya está prestado." };

  const { error } = await supabase
    .from("inventario_prestamos")
    .update({
      estado: "activo",
      fecha_salida: new Date().toISOString(),
      entregado_por: u?.id ?? null,
      condicion_salida: parsed.data.condicion_salida,
      checklist_salida: parsed.data.checklist_salida ?? null,
      notas_salida: parsed.data.notas_salida?.trim() || null,
    })
    .eq("id", prestamoId);
  if (error) return { ok: false, message: "No se pudo aprobar la solicitud." };

  await supabase.from("inventario_equipos").update({ estado: "prestado" }).eq("id", equipoId);
  revalidatePath(RUTA);
  return { ok: true, message: "Solicitud aprobada y equipo entregado." };
}

export async function rechazarSolicitud(prestamoId: string): Promise<ActionResult> {
  if (!(await puedeGestionar())) return { ok: false, message: "No autorizado." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("inventario_prestamos")
    .update({ estado: "rechazado" })
    .eq("id", prestamoId);
  if (error) return { ok: false, message: "No se pudo rechazar la solicitud." };
  revalidatePath(RUTA);
  return { ok: true, message: "Solicitud rechazada." };
}

/* ═══════════════════════════════ Novedades ═══════════════════════════════ */

const novedadSchema = z.object({
  equipo_id: z.string().uuid("Elige un equipo"),
  prestamo_id: z.string().uuid().optional().nullable(),
  tipo: z.enum(TIPOS_NOVEDAD).default("nota"),
  severidad: z.enum(SEVERIDADES).default("media"),
  descripcion: z.string().trim().min(3, "Describe la novedad").max(2000),
  costo: z.coerce.number().min(0).max(1e12).optional().nullable(),
  /** Opcional: dejar el equipo en este estado tras la novedad. */
  estado_equipo: z.enum(ESTADOS_EQUIPO).optional().nullable(),
});

/** Registra una novedad (accidente, daño, mantenimiento…). Cualquier staff puede. */
export async function addNovedad(input: unknown): Promise<ActionResult<{ id: string }>> {
  const u = await getSessionUser();
  if (!u) return { ok: false, message: "Sesión no válida." };
  const parsed = novedadSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Revisa los campos.", fieldErrors: zodToFieldErrors(parsed.error) };

  const { estado_equipo, ...fila } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventario_novedades")
    .insert({ ...limpiar(fila), reportado_por: u.id })
    .select("id")
    .single();
  if (error) return { ok: false, message: "No se pudo registrar la novedad." };

  // Cambiar el estado del equipo solo lo puede un gestor.
  if (estado_equipo && (await puedeGestionar())) {
    await supabase.from("inventario_equipos").update({ estado: estado_equipo }).eq("id", parsed.data.equipo_id);
  }

  revalidatePath(RUTA);
  return { ok: true, message: "Novedad registrada.", data: { id: (data as { id: string }).id } };
}

export async function toggleNovedadResuelta(id: string, resuelto: boolean): Promise<ActionResult> {
  if (!(await puedeGestionar())) return { ok: false, message: "No autorizado." };
  const supabase = await createClient();
  const { error } = await supabase.from("inventario_novedades").update({ resuelto }).eq("id", id);
  if (error) return { ok: false, message: "No se pudo actualizar la novedad." };
  revalidatePath(RUTA);
  return { ok: true, message: resuelto ? "Novedad marcada como resuelta." : "Novedad reabierta." };
}

/* ═══════════════════════════════ Evidencias ═══════════════════════════════ */

const evidenciaSchema = z.object({
  equipo_id: z.string().uuid(),
  prestamo_id: z.string().uuid().optional().nullable(),
  novedad_id: z.string().uuid().optional().nullable(),
  momento: z.enum(MOMENTOS_EVIDENCIA).default("general"),
  tipo_media: z.enum(["video", "foto"]).default("video"),
  storage_path: z.string().trim().min(1),
  url: z.string().trim().max(1000).optional().nullable(),
  mime: z.string().trim().max(120).optional().nullable(),
  descripcion: z.string().trim().max(500).optional().nullable(),
});

/** Guarda la referencia de una evidencia ya subida al bucket `inventario`. */
export async function addEvidencia(input: unknown): Promise<ActionResult> {
  const u = await getSessionUser();
  if (!u) return { ok: false, message: "Sesión no válida." };
  const parsed = evidenciaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Datos de la evidencia inválidos." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("inventario_evidencias")
    .insert({ ...limpiar(parsed.data), created_by: u.id });
  if (error) return { ok: false, message: "No se pudo guardar la evidencia." };
  revalidatePath(RUTA);
  return { ok: true, message: "Evidencia guardada." };
}

export async function removeEvidencia(id: string): Promise<ActionResult> {
  if (!(await puedeGestionar())) return { ok: false, message: "No autorizado." };
  const supabase = await createClient();
  const { error } = await supabase.from("inventario_evidencias").delete().eq("id", id);
  if (error) return { ok: false, message: "No se pudo eliminar la evidencia." };
  revalidatePath(RUTA);
  return { ok: true, message: "Evidencia eliminada." };
}
