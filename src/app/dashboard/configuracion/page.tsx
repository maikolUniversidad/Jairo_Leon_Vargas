import { requireRole } from "@/lib/auth";
import { PageHeader, ModuleScaffold } from "@/components/dashboard/shared";

export default async function ConfiguracionPage() {
  // Solo admins (defensa adicional a RLS).
  await requireRole(["super_admin", "administrador"]);

  return (
    <>
      <PageHeader
        title="Configuración"
        description="Perfil público, usuarios, roles y parámetros del sistema."
      />
      <ModuleScaffold
        title="Configuración"
        pending={[
          "Editor del perfil público (settings.perfil_publico): nombre, lema, foto, redes",
          "Gestión de usuarios y asignación de roles (user_roles)",
          "Datos de contacto y políticas legales",
          "Parámetros de contexto operativo por defecto",
          "Bitácora de auditoría (audit_logs) con filtros",
        ]}
      />
    </>
  );
}
