import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/shared";
import { ReportesView } from "@/components/dashboard/reportes-view";
import { getGeneralReport, listReportUsers } from "@/actions/reportes";

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  await requireRole([
    "super_admin",
    "administrador",
    "direccion_general",
    "coordinador_utl",
    "analitica_reportes",
  ]);

  const [{ vista }, general, users] = await Promise.all([
    searchParams,
    getGeneralReport(),
    listReportUsers(),
  ]);
  const initialTab = vista === "persona" ? "persona" : "general";

  return (
    <>
      <PageHeader
        title="Reportes"
        description="Indicadores de la operación y reportes individuales por persona. Exporta a CSV."
      />
      <ReportesView general={general} users={users} initialTab={initialTab} />
    </>
  );
}
