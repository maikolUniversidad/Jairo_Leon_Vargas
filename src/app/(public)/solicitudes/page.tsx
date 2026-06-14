import type { Metadata } from "next";

import { ParticipaForms } from "@/components/forms/participa-forms";

export const metadata: Metadata = {
  title: "Radicar solicitud",
  description: "Radica una solicitud ciudadana y recibe tu código de seguimiento.",
};

export default function SolicitudesPage() {
  return (
    <div className="container max-w-4xl py-12 md:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-bold md:text-4xl">Radica una solicitud</h1>
        <p className="mt-2 text-muted-foreground">
          Recibirás un código de radicado (formato JLV-AÑO-000000) para hacer
          seguimiento.
        </p>
      </header>
      <ParticipaForms />
    </div>
  );
}
