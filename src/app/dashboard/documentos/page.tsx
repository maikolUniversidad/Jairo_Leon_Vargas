import { PageHeader, ModuleScaffold } from "@/components/dashboard/shared";

export default function DocumentosPage() {
  return (
    <>
      <PageHeader
        title="Documentos"
        description="Actas, informes, derechos de petición, respuestas y soportes."
      />
      <ModuleScaffold
        title="Documentos"
        pending={[
          "Carga de archivos a Supabase Storage (bucket privado 'documentos')",
          "CRUD con versión, estado, confidencialidad y tags",
          "Control de acceso por confidencialidad (público/interno/reservado) ya reflejado en RLS",
          "Asociación a solicitudes, zonas y expedientes",
          "Previsualización y descarga con URL firmada",
        ]}
      />
    </>
  );
}
