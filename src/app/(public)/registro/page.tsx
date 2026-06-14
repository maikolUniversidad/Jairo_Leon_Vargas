import type { Metadata } from "next";

import { ParticipaForms } from "@/components/forms/participa-forms";

export const metadata: Metadata = {
  title: "Únete a la comunidad",
  description: "Regístrate para recibir novedades y participar en el territorio.",
};

export default function RegistroPage() {
  return (
    <div className="container max-w-4xl py-12 md:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-bold md:text-4xl">Únete a la comunidad</h1>
        <p className="mt-2 text-muted-foreground">
          Recibe novedades y entérate de las actividades en tu localidad.
        </p>
      </header>
      <ParticipaForms />
    </div>
  );
}
