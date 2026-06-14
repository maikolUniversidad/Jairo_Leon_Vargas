import type { Metadata } from "next";

import { ParticipaForms } from "@/components/forms/participa-forms";

export const metadata: Metadata = {
  title: "Participa",
  description:
    "Cuéntanos tu necesidad, radica una solicitud o propón una idea para tu barrio.",
};

export default function ParticipaPage() {
  return (
    <div className="container max-w-4xl py-12 md:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-bold md:text-4xl">Participa</h1>
        <p className="mt-2 text-muted-foreground">
          Escuchar, organizar y responder con hechos. Tu mensaje queda
          registrado y con seguimiento.
        </p>
      </header>
      <ParticipaForms />
    </div>
  );
}
