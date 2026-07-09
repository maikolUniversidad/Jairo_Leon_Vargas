import { PageHeader } from "@/components/dashboard/shared";
import { ModuleLanding } from "@/components/dashboard/module-landing";
import { createClient } from "@/lib/supabase/server";

async function getCounts(): Promise<Record<string, number>> {
  try {
    const supabase = await createClient();
    const [cob, prod, ava, pub, cal, mon] = await Promise.all([
      supabase.from("coberturas").select("*", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("video_projects").select("*", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("avatars").select("*", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("content_posts").select("*", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("content_calendar").select("*", { count: "exact", head: true }),
      supabase.from("monitor_persons").select("*", { count: "exact", head: true }).is("deleted_at", null),
    ]);
    return {
      "/dashboard/comunicaciones/coberturas": cob.count ?? 0,
      "/dashboard/comunicaciones/produccion": prod.count ?? 0,
      "/dashboard/comunicaciones/avatares": ava.count ?? 0,
      "/dashboard/comunicaciones/publicaciones": pub.count ?? 0,
      "/dashboard/comunicaciones/calendario": cal.count ?? 0,
      "/dashboard/comunicaciones/monitoreo": mon.count ?? 0,
    };
  } catch {
    return {};
  }
}

export default async function ComunicacionesPage() {
  const counts = await getCounts();

  return (
    <>
      <PageHeader
        title="Comunicaciones"
        description="Proyectos de comunicación: coberturas, publicaciones y calendario editorial."
      />
      <ModuleLanding moduleHref="/dashboard/comunicaciones" counts={counts} />
    </>
  );
}
