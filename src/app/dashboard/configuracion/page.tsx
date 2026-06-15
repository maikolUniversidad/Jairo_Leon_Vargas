import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsuariosManager } from "@/components/dashboard/usuarios-manager";
import { RolesManager } from "@/components/dashboard/roles-manager";
import { listUsers } from "@/actions/usuarios";
import { listRoles, listPermissions } from "@/actions/roles";

export default async function ConfiguracionPage() {
  // Solo admins (defensa adicional a RLS).
  await requireRole(["super_admin", "administrador"]);

  const [users, roles, permissions] = await Promise.all([
    listUsers(),
    listRoles(),
    listPermissions(),
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
        </TabsList>
        <TabsContent value="usuarios">
          <UsuariosManager users={users} roles={roles} />
        </TabsContent>
        <TabsContent value="roles">
          <RolesManager roles={roles} permissions={permissions} />
        </TabsContent>
      </Tabs>
    </>
  );
}
