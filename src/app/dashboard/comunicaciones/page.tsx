import { PageHeader, ModuleScaffold } from "@/components/dashboard/shared";

export default function ComunicacionesPage() {
  return (
    <>
      <PageHeader
        title="Comunicaciones"
        description="Publicaciones, comunicados, piezas, boletines y calendario editorial."
      />
      <ModuleScaffold
        title="Comunicaciones"
        pending={[
          "CRUD de publicaciones (content_posts) con estados: idea → borrador → revisión → aprobado → programado → publicado",
          "Editor de cuerpo (markdown/rich text) y carga de imagen a Supabase Storage",
          "Calendario editorial (content_calendar) con asignación y fechas",
          "Flujo de aprobación por rol Comunicaciones / Coordinación",
          "Advertencia de contexto campaña vs. institucional al publicar",
        ]}
      />
    </>
  );
}
