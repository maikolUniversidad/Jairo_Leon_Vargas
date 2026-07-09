import type { Metadata } from "next";

import { ParticipaForms } from "@/components/forms/participa-forms";
import { PageIntro } from "@/components/landing/page-intro";

export const metadata: Metadata = {
  title: "Únete a la comunidad",
  description: "Regístrate para recibir novedades y participar en el territorio.",
};

export default function RegistroPage() {
  return (
    <div className="container max-w-4xl py-12 md:py-16">
      <PageIntro
        eyebrow="Suma tu voz"
        title="Únete a la comunidad"
        description="Recibe novedades y entérate de las actividades en tu localidad."
      />
      <ParticipaForms />
    </div>
  );
}
