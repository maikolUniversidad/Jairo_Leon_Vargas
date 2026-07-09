import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/shared";
import { ProduccionProject } from "@/components/dashboard/produccion-project";
import { getProjectDetail, getStudioStatus } from "@/actions/produccion";

export default async function ProduccionProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ project, research, generations, virality }, status] = await Promise.all([
    getProjectDetail(id),
    getStudioStatus(),
  ]);
  if (!project) notFound();

  return (
    <>
      <PageHeader title={project.titulo} description="Proyecto de video — investigación, guión, visual y viralidad en un solo lugar." />
      <ProduccionProject
        project={project}
        research={research}
        generations={generations}
        virality={virality}
        status={status}
      />
    </>
  );
}
