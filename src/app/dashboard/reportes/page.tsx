import { PageHeader, ModuleScaffold } from "@/components/dashboard/shared";

export default function ReportesPage() {
  return (
    <>
      <PageHeader
        title="Reportes"
        description="Indicadores por fecha, localidad, área, responsable, tipo y estado."
      />
      <ModuleScaffold
        title="Reportes"
        pending={[
          "Filtros combinables (fecha, localidad, área, responsable, tipo, estado, prioridad, contexto)",
          "Gráficos de evolución de solicitudes y tareas",
          "Mapa de calor por localidad",
          "Exportación a CSV y PDF",
          "Tablero ejecutivo con SLA y conversiones de la landing (GA4)",
        ]}
      />
    </>
  );
}
