import { notFound } from "next/navigation";

import { AvatarStudio } from "@/components/dashboard/avatar-studio";
import { getAvatarStudio, listCoberturasLite } from "@/actions/avatares";
import { getSessionUser } from "@/lib/auth";
import type { AppRole } from "@/types/roles";

const MANAGER_ROLES: AppRole[] = [
  "super_admin",
  "administrador",
  "direccion_general",
  "coordinador_utl",
  "comunicaciones",
];

export default async function AvatarStudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, data, coberturas] = await Promise.all([
    getSessionUser(),
    getAvatarStudio(id),
    listCoberturasLite(),
  ]);
  if (!data.avatar) notFound();

  const canManage = !!user && (user.isAdmin || user.roles.some((r) => MANAGER_ROLES.includes(r)));

  return <AvatarStudio data={data} coberturas={coberturas} canManage={canManage} />;
}
