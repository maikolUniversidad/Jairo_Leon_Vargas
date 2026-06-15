import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/shared";
import { AuditoriaView } from "@/components/dashboard/auditoria-view";
import { getAuditTrail } from "@/actions/auditoria";

export default async function AuditoriaPage() {
  await requireRole([
    "super_admin",
    "administrador",
    "direccion_general",
    "analitica_reportes",
    "coordinador_utl",
  ]);

  const trail = await getAuditTrail();

  return (
    <>
      <PageHeader
        title="Auditoría"
        description="Bitácora detallada de todo lo que se mueve en la plataforma: cambios de datos, accesos, subidas y descargas."
      />
      <AuditoriaView trail={trail} />
    </>
  );
}
