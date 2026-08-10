import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/shared";
import { CoberturaDetail } from "@/components/dashboard/cobertura-detail";
import { getCoberturaDetail, listPersonasVinculables } from "@/actions/coberturas";
import { listEquipos } from "@/actions/equipos";

export default async function CoberturaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Los equipos se cargan aquí, no al abrir el diálogo: evita una ida y vuelta
  // justo cuando el usuario acaba de soltar los archivos.
  const [{ cobertura, files, asistentes }, personas, equipos] = await Promise.all([
    getCoberturaDetail(id),
    listPersonasVinculables(),
    listEquipos(),
  ]);
  if (!cobertura) notFound();

  return (
    <>
      <PageHeader
        title="Cobertura"
        description="Sube contenido por fase. Cada archivo se guarda en su subcarpeta de Drive."
      />
      <CoberturaDetail
        cobertura={cobertura}
        files={files}
        asistentes={asistentes}
        personas={personas}
        equipos={equipos}
      />
    </>
  );
}
