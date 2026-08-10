"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  TIPOS_EQUIPO,
  type EquipoCobertura,
  type EquipoConIntegrantes,
  type IntegranteEquipo,
  type UsuarioPlataforma,
} from "@/lib/equipos-shared";
import { zodToFieldErrors, type ActionResult } from "./types";

/** Fila cruda de `equipo_integrantes`. El nombre se resuelve aparte. */
interface FilaIntegrante {
  id: string;
  equipo_id: string;
  user_id: string;
  rol: string | null;
}

/** El embebido de PostgREST llega como arreglo aunque la relación sea a uno. */
interface FilaMiEquipo {
  equipo_id: string;
  equipos_cobertura: { nombre: string | null; activo: boolean }[] | null;
}

/**
 * Catálogo de equipos de grabación y fotografía. Es la atribución del material
 * de una cobertura: a quién acreditarle —o reclamarle— lo que se subió.
 *
 * La RLS de `equipos_cobertura` ya restringe la escritura a
 * `can_manage_comunicaciones()`; la comprobación de aquí es para devolver un
 * mensaje entendible en vez de un error de base de datos.
 */

// Los tipos y catálogos viven en @/lib/equipos-shared: este archivo es
// "use server" y solo puede exportar funciones async.

const equipoSchema = z.object({
  nombre: z.string().trim().min(2, "Escribe el nombre del equipo").max(120),
  tipo: z.enum(TIPOS_EQUIPO).default("mixto"),
  activo: z.boolean().default(true),
});

/** Código de violación de índice único en Postgres. */
const DUPLICADO = "23505";

async function puedeGestionar(): Promise<boolean> {
  const u = await getSessionUser();
  if (!u) return false;
  return (
    u.isAdmin ||
    u.roles.some((r) =>
      ["direccion_general", "coordinador_utl", "comunicaciones"].includes(r),
    )
  );
}

/** Equipos para los selectores. Cualquier staff puede leerlos. */
export async function listEquipos(soloActivos = true): Promise<EquipoCobertura[]> {
  const supabase = await createClient();
  let q = supabase
    .from("equipos_cobertura")
    .select("id, nombre, tipo, activo")
    .order("nombre");
  if (soloActivos) q = q.eq("activo", true);
  const { data } = await q;
  return (data as EquipoCobertura[]) ?? [];
}

export async function createEquipo(input: unknown): Promise<ActionResult> {
  if (!(await puedeGestionar())) return { ok: false, message: "No autorizado." };

  const parsed = equipoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los campos.",
      fieldErrors: zodToFieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("equipos_cobertura").insert(parsed.data);
  if (error) {
    if (error.code === DUPLICADO) {
      return {
        ok: false,
        message: "Ya existe un equipo con ese nombre.",
        fieldErrors: { nombre: "Ya existe un equipo con ese nombre." },
      };
    }
    return { ok: false, message: "No se pudo crear el equipo." };
  }

  revalidatePath("/dashboard/configuracion");
  return { ok: true, message: "Equipo creado." };
}

export async function updateEquipo(id: string, input: unknown): Promise<ActionResult> {
  if (!(await puedeGestionar())) return { ok: false, message: "No autorizado." };

  const parsed = equipoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los campos.",
      fieldErrors: zodToFieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("equipos_cobertura")
    .update(parsed.data)
    .eq("id", id);
  if (error) {
    if (error.code === DUPLICADO) {
      return {
        ok: false,
        message: "Ya existe un equipo con ese nombre.",
        fieldErrors: { nombre: "Ya existe un equipo con ese nombre." },
      };
    }
    return { ok: false, message: "No se pudo actualizar el equipo." };
  }

  revalidatePath("/dashboard/configuracion");
  return { ok: true, message: "Equipo actualizado." };
}

/**
 * Los equipos no se borran: se desactivan. Un equipo borrado dejaría sin
 * atribución al material que ya grabó (`on delete set null`), y ese registro
 * histórico es justamente el punto de la función.
 */
export async function toggleEquipo(id: string, activo: boolean): Promise<ActionResult> {
  if (!(await puedeGestionar())) return { ok: false, message: "No autorizado." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("equipos_cobertura")
    .update({ activo })
    .eq("id", id);
  if (error) return { ok: false, message: "No se pudo cambiar el estado del equipo." };

  revalidatePath("/dashboard/configuracion");
  return { ok: true, message: activo ? "Equipo activado." : "Equipo desactivado." };
}

/* ─────────────────────────────── Integrantes ─────────────────────────────── */

/** Equipos con su gente. Es la vista que usa la pantalla de gestión. */
export async function listEquiposConIntegrantes(): Promise<EquipoConIntegrantes[]> {
  const supabase = await createClient();
  const [{ data: equipos }, { data: filas }] = await Promise.all([
    supabase.from("equipos_cobertura").select("id, nombre, tipo, activo").order("nombre"),
    supabase.from("equipo_integrantes").select("id, equipo_id, user_id, rol").order("created_at"),
  ]);

  // `equipo_integrantes.user_id` apunta a auth.users, no a profiles, así que
  // PostgREST no puede incrustar el perfil: se resuelven los nombres aparte.
  const integrantes = (filas ?? []) as FilaIntegrante[];
  const nombres = new Map<string, string>();
  if (integrantes.length > 0) {
    const { data: perfiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", [...new Set(integrantes.map((f) => f.user_id))]);
    for (const p of (perfiles ?? []) as { id: string; full_name: string | null }[]) {
      nombres.set(p.id, p.full_name?.trim() || "Sin nombre");
    }
  }

  const porEquipo = new Map<string, IntegranteEquipo[]>();
  for (const f of integrantes) {
    const lista = porEquipo.get(f.equipo_id) ?? [];
    lista.push({
      id: f.id,
      equipo_id: f.equipo_id,
      user_id: f.user_id,
      nombre: nombres.get(f.user_id) ?? "Sin nombre",
      rol: f.rol,
    });
    porEquipo.set(f.equipo_id, lista);
  }

  return ((equipos ?? []) as EquipoCobertura[]).map((e) => ({
    ...e,
    integrantes: porEquipo.get(e.id) ?? [],
  }));
}

/** Perfiles activos, para el selector de integrantes. */
export async function listUsuariosPlataforma(): Promise<UsuarioPlataforma[]> {
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

export async function addIntegrante(
  equipoId: string,
  userId: string,
  rol?: string | null,
): Promise<ActionResult> {
  if (!(await puedeGestionar())) return { ok: false, message: "No autorizado." };
  if (!equipoId || !userId) return { ok: false, message: "Falta el equipo o la persona." };

  const u = await getSessionUser();
  const supabase = await createClient();
  const { error } = await supabase.from("equipo_integrantes").insert({
    equipo_id: equipoId,
    user_id: userId,
    rol: rol?.trim() || null,
    created_by: u?.id ?? null,
  });
  if (error) {
    if (error.code === DUPLICADO) return { ok: false, message: "Esa persona ya está en el equipo." };
    return { ok: false, message: "No se pudo agregar a la persona." };
  }

  revalidatePath("/dashboard/comunicaciones/equipos");
  revalidatePath("/dashboard/configuracion");
  return { ok: true, message: "Persona agregada al equipo." };
}

export async function removeIntegrante(id: string): Promise<ActionResult> {
  if (!(await puedeGestionar())) return { ok: false, message: "No autorizado." };
  const supabase = await createClient();
  const { error } = await supabase.from("equipo_integrantes").delete().eq("id", id);
  if (error) return { ok: false, message: "No se pudo quitar a la persona." };

  revalidatePath("/dashboard/comunicaciones/equipos");
  revalidatePath("/dashboard/configuracion");
  return { ok: true, message: "Persona quitada del equipo." };
}

/**
 * Equipo activo al que pertenece quien entró, para preseleccionarlo al subir.
 * Si está en varios, gana el primero por nombre: preseleccionar algo razonable
 * ahorra un clic, y el selector sigue estando para corregirlo.
 */
export async function miEquipo(): Promise<string | null> {
  const u = await getSessionUser();
  if (!u) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("equipo_integrantes")
    .select("equipo_id, equipos_cobertura(nombre, activo)")
    .eq("user_id", u.id);

  const candidatos = ((data ?? []) as FilaMiEquipo[])
    .map((f) => ({ equipo_id: f.equipo_id, equipo: f.equipos_cobertura?.[0] ?? null }))
    .filter((f) => f.equipo?.activo)
    .sort((a, b) => (a.equipo?.nombre ?? "").localeCompare(b.equipo?.nombre ?? "", "es"));
  return candidatos[0]?.equipo_id ?? null;
}
