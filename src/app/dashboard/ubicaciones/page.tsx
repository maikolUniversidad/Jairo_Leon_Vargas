import { PageHeader } from "@/components/dashboard/shared";
import { UbicacionesPanel } from "@/components/dashboard/ubicaciones-panel";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/roles";
import type { UserLocation, LocationDirective, Profile } from "@/types/database";

const COORDINATOR_ROLES: AppRole[] = [
  "super_admin",
  "administrador",
  "direccion_general",
  "coordinador_utl",
  "coordinador_territorial",
];

export default async function UbicacionesPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const canCoordinate =
    user.isAdmin || user.roles.some((r) => COORDINATOR_ROLES.includes(r));

  const [{ data: locations }, { data: directives }, { data: profiles }] = await Promise.all([
    supabase.from("user_locations").select("*"),
    supabase.from("location_directives").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
  ]);

  const mine = (locations as UserLocation[] | null)?.find((l) => l.user_id === user.id);

  return (
    <>
      <PageHeader
        title="Ubicaciones"
        description="Coordina al equipo en tiempo real: mira quién está dónde y deja indicaciones de a dónde deben ir."
      />
      <UbicacionesPanel
        canCoordinate={canCoordinate}
        currentUserId={user.id}
        mySharing={Boolean(mine?.is_sharing)}
        locations={(locations as UserLocation[]) ?? []}
        directives={(directives as LocationDirective[]) ?? []}
        profiles={(profiles as Pick<Profile, "id" | "full_name" | "email">[]) ?? []}
      />
    </>
  );
}
