"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { postSchema, calendarSchema } from "@/lib/validations";
import { type ActionResult, zodToFieldErrors } from "./types";
import type { ContentPost } from "@/types/database";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/* ───────────────── Publicaciones ───────────────── */

export async function listPosts(): Promise<ContentPost[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("content_posts")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);
  return (data as ContentPost[]) ?? [];
}

export async function createPost(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos.", fieldErrors: zodToFieldErrors(parsed.error) };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const slug = `${slugify(v.titulo)}-${Date.now().toString(36).slice(-4)}`;
  const fechaPub =
    v.estado === "publicado" ? v.fecha_publicacion || new Date().toISOString() : v.fecha_publicacion || null;

  const { data, error } = await supabase
    .from("content_posts")
    .insert({
      titulo: v.titulo,
      slug,
      tipo: v.tipo,
      categoria: v.categoria || null,
      resumen: v.resumen || null,
      cuerpo: v.cuerpo || null,
      imagen_url: v.imagen_url || null,
      estado: v.estado,
      visibilidad: v.visibilidad,
      contexto_operativo: v.contexto_operativo,
      fecha_publicacion: fechaPub,
      autor_id: user?.id ?? null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: "No se pudo crear la publicación (¿permisos?)." };

  revalidatePath("/dashboard/comunicaciones/publicaciones");
  revalidatePath("/noticias");
  return { ok: true, message: "Publicación creada.", data: { id: data.id } };
}

export async function updatePost(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = postSchema.partial().safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Datos inválidos." };
  const v = parsed.data;
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) {
    if (val === undefined) continue;
    patch[k] = val === "" ? null : val;
  }
  if (v.estado === "publicado" && !v.fecha_publicacion) patch.fecha_publicacion = new Date().toISOString();
  const { error } = await supabase.from("content_posts").update(patch).eq("id", id);
  if (error) return { ok: false, message: "No se pudo actualizar." };
  revalidatePath("/dashboard/comunicaciones/publicaciones");
  revalidatePath("/noticias");
  return { ok: true, message: "Publicación actualizada." };
}

export async function setPostEstado(id: string, estado: string): Promise<ActionResult> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { estado };
  if (estado === "publicado") patch.fecha_publicacion = new Date().toISOString();
  const { error } = await supabase.from("content_posts").update(patch).eq("id", id);
  if (error) return { ok: false, message: "No se pudo cambiar el estado." };
  revalidatePath("/dashboard/comunicaciones/publicaciones");
  revalidatePath("/noticias");
  return { ok: true, message: `Estado: ${estado}.` };
}

export async function deletePost(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: "No se pudo eliminar." };
  revalidatePath("/dashboard/comunicaciones/publicaciones");
  revalidatePath("/noticias");
  return { ok: true, message: "Publicación eliminada." };
}

/* ───────────────── Calendario editorial ───────────────── */

export interface CalendarItem {
  id: string;
  titulo: string;
  canal: string | null;
  fecha_programada: string | null;
  estado: string;
  post_id: string | null;
  responsable_id: string | null;
}

export async function listCalendar(): Promise<CalendarItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("content_calendar")
    .select("id, titulo, canal, fecha_programada, estado, post_id, responsable_id")
    .order("fecha_programada", { ascending: true })
    .limit(500);
  return (data as CalendarItem[]) ?? [];
}

export async function createCalendarItem(raw: unknown): Promise<ActionResult> {
  const parsed = calendarSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos.", fieldErrors: zodToFieldErrors(parsed.error) };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("content_calendar").insert({
    titulo: v.titulo,
    canal: v.canal,
    fecha_programada: v.fecha_programada,
    estado: v.estado,
    post_id: v.post_id || null,
    responsable_id: v.responsable_id || user?.id || null,
  });
  if (error) return { ok: false, message: "No se pudo programar (¿permisos?)." };
  revalidatePath("/dashboard/comunicaciones/calendario");
  return { ok: true, message: "Pieza programada." };
}

export async function setCalendarEstado(id: string, estado: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("content_calendar").update({ estado }).eq("id", id);
  if (error) return { ok: false, message: "No se pudo actualizar." };
  revalidatePath("/dashboard/comunicaciones/calendario");
  return { ok: true, message: "Estado actualizado." };
}

export async function deleteCalendarItem(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("content_calendar").delete().eq("id", id);
  if (error) return { ok: false, message: "No se pudo eliminar." };
  revalidatePath("/dashboard/comunicaciones/calendario");
  return { ok: true, message: "Eliminado del calendario." };
}
