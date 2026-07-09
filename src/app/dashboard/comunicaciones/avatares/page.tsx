import { PageHeader } from "@/components/dashboard/shared";
import { AvataresList } from "@/components/dashboard/avatares-list";
import { listAvatars } from "@/actions/avatares";
import { getSessionUser } from "@/lib/auth";
import type { AppRole } from "@/types/roles";

const MANAGER_ROLES: AppRole[] = [
  "super_admin",
  "administrador",
  "direccion_general",
  "coordinador_utl",
  "comunicaciones",
];

export default async function AvataresPage() {
  const [user, avatars] = await Promise.all([getSessionUser(), listAvatars()]);
  const canManage = !!user && (user.isAdmin || user.roles.some((r) => MANAGER_ROLES.includes(r)));

  return (
    <>
      <PageHeader
        title="Avatares"
        description="Personajes de marca con personalidad, imagen y voz. Genera contenido con IA (imagen y video con Higgsfield, voz con ElevenLabs) y úsalo en publicaciones, calendario y coberturas."
      />
      <AvataresList avatars={avatars} canManage={canManage} />
    </>
  );
}
