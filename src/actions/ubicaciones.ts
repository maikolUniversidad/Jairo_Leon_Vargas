"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { directiveSchema } from "@/lib/validations";
import { type ActionResult, zodToFieldErrors } from "./types";

/* ───────────────────── Mi ubicación ───────────────────── */

export interface LocationPayload {
  lat: number;
  lng: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

/** Upsert de la posición del usuario en sesión (solo si está compartiendo). */
export async function updateMyLocation(p: LocationPayload): Promise<ActionResult> {
  if (typeof p?.lat !== "number" || typeof p?.lng !== "number") {
    return { ok: false, message: "Coordenadas inválidas." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión no válida." };

  const { error } = await supabase.from("user_locations").upsert(
    {
      user_id: user.id,
      lat: p.lat,
      lng: p.lng,
      accuracy: p.accuracy ?? null,
      heading: p.heading ?? null,
      speed: p.speed ?? null,
      is_sharing: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, message: "No se pudo guardar la ubicación." };
  return { ok: true, message: "ok" };
}

/** Activa o desactiva el compartir ubicación. */
export async function setLocationSharing(active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión no válida." };

  const { error } = await supabase.from("user_locations").upsert(
    { user_id: user.id, is_sharing: active, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, message: "No se pudo actualizar el estado." };
  revalidatePath("/dashboard/ubicaciones");
  return { ok: true, message: active ? "Compartiendo ubicación." : "Dejaste de compartir." };
}

/** Estado actual de compartir del usuario. */
export async function getMySharing(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("user_locations")
    .select("is_sharing")
    .eq("user_id", user.id)
    .maybeSingle();
  return Boolean((data as { is_sharing: boolean } | null)?.is_sharing);
}

/* ───────────────────── Indicaciones ───────────────────── */

export async function createDirective(raw: unknown): Promise<ActionResult> {
  const parsed = directiveSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa la indicación.",
      fieldErrors: zodToFieldErrors(parsed.error),
    };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión no válida." };

  const { error } = await supabase.from("location_directives").insert({
    user_id: v.user_id,
    created_by: user.id,
    titulo: v.titulo,
    descripcion: v.descripcion || null,
    destino_nombre: v.destino_nombre || null,
    destino_lat: v.destino_lat ?? null,
    destino_lng: v.destino_lng ?? null,
  });
  if (error) return { ok: false, message: "No se pudo crear la indicación (¿permisos?)." };

  // La notificación al destinatario la dispara el trigger trg_directive_notify.
  revalidatePath("/dashboard/ubicaciones");
  return { ok: true, message: "Indicación enviada." };
}

export async function updateDirectiveStatus(
  id: string,
  estado: "pendiente" | "en_camino" | "llego" | "cancelada",
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("location_directives")
    .update({ estado })
    .eq("id", id);
  if (error) return { ok: false, message: "No se pudo actualizar." };
  revalidatePath("/dashboard/ubicaciones");
  return { ok: true, message: "Indicación actualizada." };
}

/** Recorrido reciente de una persona (puntos en orden cronológico). */
export async function getUserTrail(
  userId: string,
  limit = 100,
): Promise<{ lat: number; lng: number; recorded_at: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("location_history")
    .select("lat, lng, recorded_at")
    .eq("user_id", userId)
    .order("recorded_at", { ascending: false })
    .limit(limit);
  // Devuelve en orden ascendente para dibujar la línea del recorrido.
  return ((data as { lat: number; lng: number; recorded_at: string }[]) ?? []).reverse();
}

export async function deleteDirective(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("location_directives").delete().eq("id", id);
  if (error) return { ok: false, message: "No se pudo eliminar." };
  revalidatePath("/dashboard/ubicaciones");
  return { ok: true, message: "Indicación eliminada." };
}
