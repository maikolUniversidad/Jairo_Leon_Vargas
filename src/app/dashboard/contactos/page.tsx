import { PageHeader } from "@/components/dashboard/shared";
import { ContactosList } from "@/components/dashboard/contactos-list";
import { createClient } from "@/lib/supabase/server";
import type { Contact } from "@/types/database";

export default async function ContactosPage() {
  const supabase = await createClient();
  const [{ data: contacts }, { data: zones }] = await Promise.all([
    supabase.from("contacts").select("*").is("deleted_at", null).order("nombre").limit(1000),
    supabase.from("zones").select("id, nombre_zona").is("deleted_at", null).order("nombre_zona"),
  ]);

  return (
    <>
      <PageHeader
        title="Contactos"
        description="Red de contactos del territorio: líderes, aliados, medios e instituciones, con tareas y documentos."
      />
      <ContactosList
        contacts={(contacts as Contact[]) ?? []}
        zones={(zones as { id: string; nombre_zona: string }[]) ?? []}
      />
    </>
  );
}
