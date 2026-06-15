import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/shared";
import { CoberturaDetail } from "@/components/dashboard/cobertura-detail";
import { getCoberturaDetail } from "@/actions/coberturas";

export default async function CoberturaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { cobertura, files } = await getCoberturaDetail(id);
  if (!cobertura) notFound();

  return (
    <>
      <PageHeader
        title="Cobertura"
        description="Sube contenido por fase. Cada archivo se guarda en su subcarpeta de Drive."
      />
      <CoberturaDetail cobertura={cobertura} files={files} />
    </>
  );
}
