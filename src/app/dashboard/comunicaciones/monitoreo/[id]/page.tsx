import { notFound } from "next/navigation";

import { MonitoreoDossier } from "@/components/dashboard/monitoreo-dossier";
import { getPersonDossier } from "@/actions/monitoreo";
import { getSessionUser } from "@/lib/auth";
import type { AppRole } from "@/types/roles";

const MANAGER_ROLES: AppRole[] = [
  "super_admin",
  "administrador",
  "direccion_general",
  "coordinador_utl",
  "comunicaciones",
];

export default async function MonitoreoPersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, dossier] = await Promise.all([getSessionUser(), getPersonDossier(id)]);
  if (!dossier.person) notFound();

  const canManage = !!user && (user.isAdmin || user.roles.some((r) => MANAGER_ROLES.includes(r)));

  return (
    <MonitoreoDossier
      person={dossier.person}
      items={dossier.items}
      runs={dossier.runs}
      sources={dossier.sources}
      canManage={canManage}
    />
  );
}
