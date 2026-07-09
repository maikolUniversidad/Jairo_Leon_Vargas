import { Suspense } from "react";

import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsuariosManager } from "@/components/dashboard/usuarios-manager";
import { RolesManager } from "@/components/dashboard/roles-manager";
import { GoogleDriveCard } from "@/components/dashboard/google-drive-card";
import { ConexionesManager } from "@/components/dashboard/conexiones-manager";
import { MisredesManager } from "@/components/dashboard/misredes-manager";
import { listUsers } from "@/actions/usuarios";
import { listRoles, listPermissions } from "@/actions/roles";
import { getDriveStatus } from "@/actions/google";
import { listConnections } from "@/actions/conexiones";
import { getMisredesConfig } from "@/actions/misredes";

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  // Solo admins (defensa adicional a RLS).
  await requireRole(["super_admin", "administrador"]);

  const [{ tab }, users, roles, permissions, driveStatus, connections, misredes] = await Promise.all([
    searchParams,
    listUsers(),
    listRoles(),
    listPermissions(),
    getDriveStatus(),
    listConnections(),
    getMisredesConfig(),
  ]);

  const activeTab = ["usuarios", "roles", "integraciones", "misredes"].includes(tab ?? "")
    ? (tab as string)
    : "usuarios";

  return (
    <>
      <PageHeader
        title="Configuración"
        description="Gestiona usuarios, roles y permisos del sistema."
      />

      <Tabs defaultValue={activeTab}>
        <TabsList>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="roles">Roles y permisos</TabsTrigger>
          <TabsTrigger value="integraciones">Integraciones</TabsTrigger>
          <TabsTrigger value="misredes">Página /misredes</TabsTrigger>
        </TabsList>
        <TabsContent value="usuarios">
          <UsuariosManager users={users} roles={roles} />
        </TabsContent>
        <TabsContent value="roles">
          <RolesManager roles={roles} permissions={permissions} />
        </TabsContent>
        <TabsContent value="integraciones" className="space-y-6">
          <Suspense fallback={null}>
            <GoogleDriveCard status={driveStatus} />
          </Suspense>
          <ConexionesManager connections={connections} />
        </TabsContent>
        <TabsContent value="misredes">
          <MisredesManager initial={misredes} />
        </TabsContent>
      </Tabs>
    </>
  );
}
