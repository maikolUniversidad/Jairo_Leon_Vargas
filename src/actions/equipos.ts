"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TIPOS_EQUIPO, type EquipoCobertura } from "@/lib/equipos-shared";
import { zodToFieldErrors, type ActionResult } from "./types";

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
