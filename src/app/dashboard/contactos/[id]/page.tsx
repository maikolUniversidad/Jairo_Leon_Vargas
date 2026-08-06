import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/shared";
import { ContactDetail } from "@/components/dashboard/contact-detail";
import { getContactDetail } from "@/actions/contactos";
import { createClient } from "@/lib/supabase/server";
import type { Contact } from "@/types/database";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: contact } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!contact) notFound();
  const c = contact as Contact;

  const [detail, { data: allContacts }, { data: citizens }, zoneRes, { data: zones }] =
    await Promise.all([
      getContactDetail(id),
      supabase.from("contacts").select("id, nombre, apellido, puesto").is("deleted_at", null).order("nombre").limit(1000),
      supabase.from("citizens").select("id, nombre, apellido, localidad").is("deleted_at", null).order("created_at", { ascending: false }).limit(500),
      c.zona_id
        ? supabase.from("zones").select("nombre_zona").eq("id", c.zona_id).maybeSingle()
        : Promise.resolve({ data: null }),
      // Necesarias para el combobox de zona del diálogo de edición.
      supabase.from("zones").select("id, nombre_zona, tipo_zona").order("nombre_zona").limit(1000),
    ]);

  return (
    <>
      <PageHeader title="Ficha de contacto" description="Datos, red de contactos, documentos, tareas y ciudadanos referidos." />
      <ContactDetail
        contact={c}
        zoneName={(zoneRes?.data as { nombre_zona: string } | null)?.nombre_zona ?? null}
        allContacts={(allContacts as { id: string; nombre: string; apellido: string | null; puesto: string | null }[]) ?? []}
        citizens={(citizens as { id: string; nombre: string; apellido: string | null; localidad: string | null }[]) ?? []}
        zones={(zones as { id: string; nombre_zona: string; tipo_zona: never }[]) ?? []}
        relations={detail.relations as { related_contact_id: string; tipo_relacion: string }[]}
        documents={detail.documents as { id: string; tipo: "archivo" | "link"; nombre: string; url: string; storage_path: string | null }[]}
        tasks={detail.tasks as { id: string; titulo: string; estado: string; prioridad: string; fecha_limite: string | null }[]}
        referidos={detail.referidos as { id: string; nombre: string; apellido: string | null; localidad: string | null }[]}
      />
    </>
  );
}
