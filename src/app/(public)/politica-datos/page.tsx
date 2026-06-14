import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de tratamiento de datos" };

export default function PoliticaDatosPage() {
  return (
    <div className="container max-w-3xl py-12 md:py-16">
      <h1 className="text-3xl font-bold">Política de tratamiento de datos personales</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          En cumplimiento de la Ley 1581 de 2012 y sus normas reglamentarias, los
          datos personales recolectados a través de este sitio se tratan con
          finalidades de atención ciudadana, comunicación y participación. [Texto
          legal pendiente de revisión jurídica.]
        </p>
        <p>
          <strong>Finalidad:</strong> registrar y dar seguimiento a solicitudes,
          propuestas, inscripciones y comunicaciones.
        </p>
        <p>
          <strong>Derechos del titular:</strong> conocer, actualizar, rectificar y
          solicitar la supresión de sus datos, así como revocar la autorización.
        </p>
        <p>
          <strong>Canal de ejercicio de derechos:</strong> [correo/contacto
          pendiente]. Atenderemos su solicitud en los términos de ley.
        </p>
        <p className="text-xs">
          Este documento es un borrador editable y debe ser validado por el área
          jurídica antes de su publicación oficial.
        </p>
      </div>
    </div>
  );
}
