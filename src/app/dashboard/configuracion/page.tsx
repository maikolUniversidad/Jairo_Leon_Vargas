import { Suspense } from "react";

import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/shared";
import { TabsContent } from "@/components/ui/tabs";
import { ConfiguracionTabs } from "@/components/dashboard/configuracion-tabs";
import { UsuariosManager } from "@/components/dashboard/usuarios-manager";
import { RolesManager } from "@/components/dashboard/roles-manager";
import { GoogleDriveCard } from "@/components/dashboard/google-drive-card";
import { ConexionesManager } from "@/components/dashboard/conexiones-manager";
import { MisredesManager } from "@/components/dashboard/misredes-manager";
import { ManualDeMarca } from "@/components/dashboard/manual-de-marca";
import { ConocimientoManager } from "@/components/dashboard/kb/ConocimientoManager";
import { listUsers } from "@/actions/usuarios";
import { listRoles, listPermissions } from "@/actions/roles";
import { listEquiposConIntegrantes, listUsuariosPlataforma } from "@/actions/equipos";
import { EquiposManager } from "@/components/dashboard/equipos-manager";
import { listTodasPreguntas } from "@/actions/preguntas";
import { PreguntasManager } from "@/components/dashboard/preguntas-manager";
import { getDriveStatus } from "@/actions/google";
import { listConnections } from "@/actions/conexiones";
import { getMisredesConfig } from "@/actions/misredes";
import { listKbDocuments, listKbConcepts, getKbStats } from "@/actions/conocimiento";

export default async function ConfiguracionPage() {
  // Solo admins (defensa adicional a RLS).
  await requireRole(["super_admin", "administrador"]);

  const [
    users, roles, permissions, equipos, preguntas, usuariosEquipo,
    driveStatus, connections, misredes, kbDocs, kbConcepts, kbStats,
  ] =
    await Promise.all([
      listUsers(),
      listRoles(),
      listPermissions(),
      // Incluye los inactivos: aquí es donde se vuelven a activar.
      listEquiposConIntegrantes(),
      // También las inactivas, por lo mismo.
      listTodasPreguntas(),
      listUsuariosPlataforma(),
      getDriveStatus(),
      listConnections(),
      getMisredesConfig(),
      listKbDocuments(),
      listKbConcepts(),
      getKbStats(),
    ]);

  return (
    <>
      <PageHeader
        title="Configuración"
        description="Gestiona usuarios, roles y permisos del sistema."
      />

      <ConfiguracionTabs>
        <TabsContent value="usuarios">
          <UsuariosManager users={users} roles={roles} />
        </TabsContent>
        <TabsContent value="roles">
          <RolesManager roles={roles} permissions={permissions} />
        </TabsContent>
        <TabsContent value="equipos">
          <EquiposManager equipos={equipos} usuarios={usuariosEquipo} />
        </TabsContent>
        <TabsContent value="preguntas">
          <PreguntasManager preguntas={preguntas} />
        </TabsContent>
        <TabsContent value="integraciones" className="space-y-6">
          <Suspense fallback={null}>
            <GoogleDriveCard status={driveStatus} />
          </Suspense>
          <ConexionesManager connections={connections} />
        </TabsContent>
        <TabsContent value="conocimiento">
          <ConocimientoManager documents={kbDocs} concepts={kbConcepts} stats={kbStats} />
        </TabsContent>
        <TabsContent value="misredes">
          <MisredesManager initial={misredes} />
        </TabsContent>
        <TabsContent value="marca">
          <ManualDeMarca />
        </TabsContent>
      </ConfiguracionTabs>
    </>
  );
}
