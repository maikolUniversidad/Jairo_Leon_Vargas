import { PageHeader } from "@/components/dashboard/shared";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/types/roles";
import type { Profile } from "@/types/database";

export default async function PerfilPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: profile }, { data: areas }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("areas").select("id, nombre").order("nombre"),
  ]);

  const roleLabels = user.roles.map((r) => ROLE_LABELS[r]);

  return (
    <>
      <PageHeader
        title="Mi perfil"
        description="Actualiza tus datos y tu foto. Esta información identifica tu actividad en la plataforma."
      />
      <ProfileForm
        profile={(profile as Profile) ?? null}
        email={user.email}
        roleLabels={roleLabels}
        areas={(areas as { id: string; nombre: string }[]) ?? []}
      />
    </>
  );
}
