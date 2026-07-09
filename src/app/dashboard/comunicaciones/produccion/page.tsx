import { PageHeader } from "@/components/dashboard/shared";
import { ProduccionBoard } from "@/components/dashboard/produccion-board";
import { listProjects, getStudioStatus } from "@/actions/produccion";

export default async function ProduccionPage() {
  const [projects, status] = await Promise.all([listProjects(), getStudioStatus()]);

  return (
    <>
      <PageHeader
        title="Producción de video (IA)"
        description="Planea y produce videos con IA: investigación, guión, copy, portadas/clips con Higgsfield y análisis de viralidad. Todo queda consolidado en cada proyecto."
      />
      <ProduccionBoard projects={projects} status={status} />
    </>
  );
}
