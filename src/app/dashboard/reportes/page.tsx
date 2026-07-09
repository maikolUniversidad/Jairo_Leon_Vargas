import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/shared";
import { ReportesView } from "@/components/dashboard/reportes-view";
import { getGeneralReport, listReportUsers } from "@/actions/reportes";

export default async function ReportesPage() {
  await requireRole([
    "super_admin",
    "administrador",
    "direccion_general",
    "coordinador_utl",
    "analitica_reportes",
  ]);

  const [general, users] = await Promise.all([
    getGeneralReport(),
    listReportUsers(),
  ]);

  return (
    <>
      <PageHeader
        title="Reportes"
        description="Indicadores de la operación y reportes individuales por persona. Exporta a CSV."
      />
      <ReportesView general={general} users={users} />
    </>
  );
}
