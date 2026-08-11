"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CAMPOS_PREGUNTA, MOMENTOS, type Pregunta } from "@/lib/cuestionario-shared";
import { zodToFieldErrors, type ActionResult } from "./types";

/**
 * Catálogo de preguntas del cuestionario por voz.
 *
 * Cada pregunta apunta al campo de la ficha que llena, y declara si tiene
 * sentido antes del evento o solo después. Editarlas cambia el guion que ve
 * quien graba, no lo que se puede guardar.
 */

const preguntaSchema = z.object({
  pregunta: z.string().trim().min(5, "Escribe la pregunta").max(200),
  ayuda: z.string().trim().max(300).optional().or(z.literal("")),
  campo: z.enum(CAMPOS_PREGUNTA, {
    errorMap: () => ({ message: "Elige a qué campo va la respuesta" }),
  }),
  momento: z.enum(MOMENTOS).default("posterior"),
  orden: z.coerce.number().int().min(-99).max(99).default(0),
  activa: z.boolean().default(true),
});

async function puedeGestionar(): Promise<boolean> {
  const u = await getSessionUser();
  if (!u) return false;
  return (
    u.isAdmin ||
    u.roles.some((r) => ["direccion_general", "coordinador_utl", "comunicaciones"].includes(r))
  );
}

/** Todas las preguntas, activas e inactivas: es la pantalla de administración. */
export async function listTodasPreguntas(): Promise<Pregunta[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cobertura_preguntas")
    .select("id, pregunta, ayuda, campo, orden, activa, momento")
    .order("orden");
  return (data as Pregunta[]) ?? [];
}

export async function createPregunta(input: unknown): Promise<ActionResult> {
  if (!(await puedeGestionar())) return { ok: false, message: "No autorizado." };

  const parsed = preguntaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos.", fieldErrors: zodToFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("cobertura_preguntas").insert({
    ...parsed.data,
    ayuda: parsed.data.ayuda || null,
  });
  if (error) return { ok: false, message: "No se pudo crear la pregunta." };

  revalidatePath("/dashboard/configuracion");
  return { ok: true, message: "Pregunta creada." };
}

export async function updatePregunta(id: string, input: unknown): Promise<ActionResult> {
  if (!(await puedeGestionar())) return { ok: false, message: "No autorizado." };

  const parsed = preguntaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos.", fieldErrors: zodToFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("cobertura_preguntas")
    .update({ ...parsed.data, ayuda: parsed.data.ayuda || null })
    .eq("id", id);
  if (error) return { ok: false, message: "No se pudo actualizar la pregunta." };

  revalidatePath("/dashboard/configuracion");
  return { ok: true, message: "Pregunta actualizada." };
}

/**
 * Las preguntas no se borran: se desactivan.
 *
 * Borrar una arrastraría por cascada las respuestas ya grabadas en cada
 * cobertura, y eso es el registro de lo que el equipo contó ese día.
 */
export async function togglePregunta(id: string, activa: boolean): Promise<ActionResult> {
  if (!(await puedeGestionar())) return { ok: false, message: "No autorizado." };

  const supabase = await createClient();
  const { error } = await supabase.from("cobertura_preguntas").update({ activa }).eq("id", id);
  if (error) return { ok: false, message: "No se pudo cambiar el estado." };

  revalidatePath("/dashboard/configuracion");
  return { ok: true, message: activa ? "Pregunta activada." : "Pregunta desactivada." };
}

/** Sube o baja una pregunta en el guion, intercambiando el orden con su vecina. */
export async function moverPregunta(id: string, direccion: -1 | 1): Promise<ActionResult> {
  if (!(await puedeGestionar())) return { ok: false, message: "No autorizado." };

  const supabase = await createClient();
  const { data } = await supabase
    .from("cobertura_preguntas")
    .select("id, orden")
    .order("orden");
  const lista = (data as { id: string; orden: number }[]) ?? [];

  const i = lista.findIndex((p) => p.id === id);
  const j = i + direccion;
  if (i === -1 || j < 0 || j >= lista.length) {
    return { ok: false, message: "Ya está en el extremo." };
  }

  // Se intercambian los valores de orden. Si empataban —pasa con las sembradas—
  // se fuerza una diferencia para que el intercambio sea visible.
  const a = lista[i]!;
  const b = lista[j]!;
  const ordenA = a.orden === b.orden ? b.orden + direccion : b.orden;

  await Promise.all([
    supabase.from("cobertura_preguntas").update({ orden: ordenA }).eq("id", a.id),
    supabase.from("cobertura_preguntas").update({ orden: a.orden }).eq("id", b.id),
  ]);

  revalidatePath("/dashboard/configuracion");
  return { ok: true, message: "Orden actualizado." };
}
