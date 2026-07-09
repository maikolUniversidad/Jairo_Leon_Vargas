import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TerritorioMapa } from "@/components/landing/territorio-mapa";
import { PageIntro } from "@/components/landing/page-intro";

export const metadata: Metadata = {
  title: "Territorio",
  description: "Trabajo por localidades de Bogotá: problemáticas, eventos y solicitudes.",
};

export default function TerritorioPage() {
  return (
    <div className="container py-12 md:py-16">
      <PageIntro
        eyebrow="Localidad por localidad"
        title="Territorio"
        description="Bogotá se construye localidad por localidad. Explora el mapa, elige tu zona y cuéntanos las problemáticas y propuestas de tu barrio."
      />

      <TerritorioMapa />

      <Card className="mt-10 border-0 bg-marca-gradient text-white">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center md:flex-row md:justify-between md:text-left">
          <div>
            <h2 className="text-xl font-bold">¿Una problemática en tu zona?</h2>
            <p className="text-white/90">Repórtala y haremos seguimiento con radicado.</p>
          </div>
          <Button asChild variant="accent" size="lg">
            <Link href="/solicitudes">Reportar problemática</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
