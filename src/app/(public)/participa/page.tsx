import type { Metadata } from "next";

import { ParticipaForms } from "@/components/forms/participa-forms";
import { PageIntro } from "@/components/landing/page-intro";

export const metadata: Metadata = {
  title: "Participa",
  description:
    "Cuéntanos tu necesidad, radica una solicitud o propón una idea para tu barrio.",
};

export default function ParticipaPage() {
  return (
    <div className="container max-w-4xl py-12 md:py-16">
      <PageIntro
        eyebrow="Tu voz cuenta"
        title="Participa"
        description="Escuchar, organizar y responder con hechos. Tu mensaje queda registrado y con seguimiento."
      />
      <ParticipaForms />
    </div>
  );
}
