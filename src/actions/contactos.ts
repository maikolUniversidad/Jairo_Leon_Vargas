"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { contactSchema } from "@/lib/validations";
import { type ActionResult, zodToFieldErrors } from "./types";
import type { Contact } from "@/types/database";

export async function createContact(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos.", fieldErrors: zodToFieldErrors(parsed.error) };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      nombre: v.nombre,
      apellido: v.apellido || null,
      puesto: v.puesto || null,
      organizacion: v.organizacion || null,
      tipo: v.tipo,
      telefono: v.telefono || null,
      whatsapp: v.whatsapp || null,
      email: v.email || null,
      direccion: v.direccion || null,
      localidad: v.localidad || null,
      barrio: v.barrio || null,
      zona_id: v.zona_id || null,
      influencia: v.influencia || null,
      notas: v.notas || null,
      foto_url: v.foto_url || null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, message: "No se pudo crear el contacto (¿permisos?)." };
  revalidatePath("/dashboard/contactos");
  return { ok: true, message: "Contacto creado.", data: { id: data.id } };
}

export async function updateContact(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = contactSchema.partial().safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Datos inválidos." };
  const v = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const patch: Record<string, unknown> = { updated_by: user?.id ?? null };
  for (const [k, val] of Object.entries(v)) patch[k] = val === "" ? null : val;
  const { error } = await supabase.from("contacts").update(patch).eq("id", id);
  if (error) return { ok: false, message: "No se pudo actualizar." };
  revalidatePath("/dashboard/contactos");
  return { ok: true, message: "Contacto actualizado." };
}

export async function softDeleteContact(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: "No se pudo eliminar." };
  revalidatePath("/dashboard/contactos");
  return { ok: true, message: "Contacto eliminado." };
}

/** Detalle completo: red, documentos, tareas y ciudadanos referidos. */
export async function getContactDetail(id: string) {
  const supabase = await createClient();
  const [{ data: relations }, { data: documents }, { data: tasks }, { data: referidos }] =
    await Promise.all([
      supabase.from("contact_relations").select("*").eq("contact_id", id),
      supabase.from("contact_documents").select("*").eq("contact_id", id).order("created_at", { ascending: false }),
      supabase.from("tasks").select("id, titulo, estado, prioridad, fecha_limite").eq("contact_id", id).is("deleted_at", null),
      supabase.from("citizens").select("id, nombre, apellido, localidad").eq("referido_por_contact_id", id).is("deleted_at", null),
    ]);
  return {
    relations: relations ?? [],
    documents: documents ?? [],
    tasks: tasks ?? [],
    referidos: referidos ?? [],
  };
}

/* Red de contactos */
export async function addRelation(
  contactId: string,
  relatedContactId: string,
  tipo: string,
): Promise<ActionResult> {
  if (contactId === relatedContactId) return { ok: false, message: "No puede relacionarse consigo mismo." };
  const supabase = await createClient();
  // relación bidireccional
  const { error } = await supabase.from("contact_relations").upsert(
    [
      { contact_id: contactId, related_contact_id: relatedContactId, tipo_relacion: tipo },
      { contact_id: relatedContactId, related_contact_id: contactId, tipo_relacion: tipo },
    ],
    { onConflict: "contact_id,related_contact_id" },
  );
  if (error) return { ok: false, message: "No se pudo crear la relación." };
  revalidatePath("/dashboard/contactos");
  return { ok: true, message: "Relación agregada." };
}

export async function removeRelation(contactId: string, relatedContactId: string): Promise<ActionResult> {
  const supabase = await createClient();
  await supabase.from("contact_relations").delete()
    .or(`and(contact_id.eq.${contactId},related_contact_id.eq.${relatedContactId}),and(contact_id.eq.${relatedContactId},related_contact_id.eq.${contactId})`);
  revalidatePath("/dashboard/contactos");
  return { ok: true, message: "Relación eliminada." };
}

/* Documentos */
export async function addContactDocument(input: {
  contact_id: string;
  tipo: "archivo" | "link";
  nombre: string;
  url: string;
  storage_path?: string;
  mime?: string;
  size?: number;
}): Promise<ActionResult> {
  if (!input.url?.trim() || !input.nombre?.trim()) return { ok: false, message: "Faltan datos." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("contact_documents").insert({
    contact_id: input.contact_id,
    tipo: input.tipo,
    nombre: input.nombre.trim(),
    url: input.url.trim(),
    storage_path: input.storage_path ?? null,
    mime: input.mime ?? null,
    size: input.size ?? null,
    created_by: user?.id ?? null,
  });
  if (error) return { ok: false, message: "No se pudo guardar el documento." };
  revalidatePath("/dashboard/contactos");
  return { ok: true, message: "Documento agregado." };
}

export async function removeContactDocument(id: string, storagePath?: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  if (storagePath) await supabase.storage.from("contact-files").remove([storagePath]);
  const { error } = await supabase.from("contact_documents").delete().eq("id", id);
  if (error) return { ok: false, message: "No se pudo eliminar." };
  revalidatePath("/dashboard/contactos");
  return { ok: true, message: "Documento eliminado." };
}

/* Ciudadanos referidos */
export async function linkReferredCitizen(citizenId: string, contactId: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("citizens")
    .update({ referido_por_contact_id: contactId })
    .eq("id", citizenId);
  if (error) return { ok: false, message: "No se pudo vincular (¿permisos?)." };
  revalidatePath("/dashboard/contactos");
  revalidatePath("/dashboard/ciudadanos");
  return { ok: true, message: contactId ? "Ciudadano vinculado." : "Vínculo removido." };
}

/** Búsqueda simple de contactos para selects. */
export async function searchContacts(q: string): Promise<Contact[]> {
  const supabase = await createClient();
  let query = supabase.from("contacts").select("*").is("deleted_at", null).limit(20);
  if (q.trim()) query = query.ilike("nombre", `%${q.trim()}%`);
  const { data } = await query.order("nombre");
  return (data as Contact[]) ?? [];
}
