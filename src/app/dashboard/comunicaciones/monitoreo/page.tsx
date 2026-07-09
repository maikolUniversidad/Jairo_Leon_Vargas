import { PageHeader } from "@/components/dashboard/shared";
import { MonitoreoList } from "@/components/dashboard/monitoreo-list";
import { listPersons } from "@/actions/monitoreo";
import { getSessionUser } from "@/lib/auth";
import type { AppRole } from "@/types/roles";

const MANAGER_ROLES: AppRole[] = [
  "super_admin",
  "administrador",
  "direccion_general",
  "coordinador_utl",
  "comunicaciones",
];

export default async function MonitoreoPage() {
  const [user, persons] = await Promise.all([getSessionUser(), listPersons()]);
  const canManage = !!user && (user.isAdmin || user.roles.some((r) => MANAGER_ROLES.includes(r)));

  return (
    <>
      <PageHeader
        title="Monitoreo de personas"
        description="Recopila noticias, menciones y publicaciones sobre figuras públicas. Búscalas, etiquétalas y dispara la investigación."
      />
      <MonitoreoList persons={persons} canManage={canManage} />
    </>
  );
}
