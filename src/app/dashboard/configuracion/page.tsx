import { Suspense } from "react";

import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsuariosManager } from "@/components/dashboard/usuarios-manager";
import { RolesManager } from "@/components/dashboard/roles-manager";
import { GoogleDriveCard } from "@/components/dashboard/google-drive-card";
import { listUsers } from "@/actions/usuarios";
import { listRoles, listPermissions } from "@/actions/roles";
import { getDriveStatus } from "@/actions/google";

export default async function ConfiguracionPage() {
  // Solo admins (defensa adicional a RLS).
  await requireRole(["super_admin", "administrador"]);

  const [users, roles, permissions, driveStatus] = await Promise.all([
    listUsers(),
    listRoles(),
    listPermissions(),
    getDriveStatus(),
  ]);

  return (
    <>
      <PageHeader
        title="Configuración"
        description="Gestiona usuarios, roles y permisos del sistema."
      />

      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="roles">Roles y permisos</TabsTrigger>
          <TabsTrigger value="integraciones">Integraciones</TabsTrigger>
        </TabsList>
        <TabsContent value="usuarios">
          <UsuariosManager users={users} roles={roles} />
        </TabsContent>
        <TabsContent value="roles">
          <RolesManager roles={roles} permissions={permissions} />
        </TabsContent>
        <TabsContent value="integraciones">
          <Suspense fallback={null}>
            <GoogleDriveCard status={driveStatus} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </>
  );
}
