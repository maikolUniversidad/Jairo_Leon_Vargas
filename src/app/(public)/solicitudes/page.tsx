import type { Metadata } from "next";

import { ParticipaForms } from "@/components/forms/participa-forms";
import { PageIntro } from "@/components/landing/page-intro";

export const metadata: Metadata = {
  title: "Radicar solicitud",
  description: "Radica una solicitud ciudadana y recibe tu código de seguimiento.",
};

export default function SolicitudesPage() {
  return (
    <div className="container max-w-4xl py-12 md:py-16">
      <PageIntro
        eyebrow="Con seguimiento"
        title="Radica una solicitud"
        description="Recibirás un código de radicado (formato JLV-AÑO-000000) para hacer seguimiento."
      />
      <ParticipaForms />
    </div>
  );
}
