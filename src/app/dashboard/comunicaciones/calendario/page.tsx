import { PageHeader } from "@/components/dashboard/shared";
import { CalendarioEditorial } from "@/components/dashboard/calendario-editorial";
import { listCalendar } from "@/actions/contenido";
import { createClient } from "@/lib/supabase/server";

export default async function CalendarioEditorialPage() {
  const supabase = await createClient();
  const [items, { data: posts }, { data: profiles }] = await Promise.all([
    listCalendar(),
    supabase.from("content_posts").select("id, titulo").is("deleted_at", null).order("created_at", { ascending: false }).limit(200),
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true),
  ]);

  return (
    <>
      <PageHeader
        title="Calendario editorial"
        description="Programa las piezas por canal y fecha, con su responsable y estado."
      />
      <CalendarioEditorial
        items={items}
        posts={(posts as { id: string; titulo: string }[]) ?? []}
        profiles={(profiles as { id: string; full_name: string | null; email: string | null }[]) ?? []}
      />
    </>
  );
}
