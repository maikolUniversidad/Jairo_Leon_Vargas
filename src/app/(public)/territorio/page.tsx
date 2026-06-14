import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LOCALIDADES } from "@/lib/validations";

export const metadata: Metadata = {
  title: "Territorio",
  description: "Trabajo por localidades de Bogotá: problemáticas, eventos y solicitudes.",
};

export default function TerritorioPage() {
  const localidades = LOCALIDADES.filter((l) => l !== "Otra");

  return (
    <div className="container py-12 md:py-16">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-bold md:text-4xl">Territorio</h1>
        <p className="mt-2 text-muted-foreground">
          Bogotá se construye localidad por localidad. Elige tu zona y cuéntanos
          las problemáticas y propuestas de tu barrio.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {localidades.map((loc) => (
          <Card key={loc} className="transition-colors hover:border-primary/40">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MapPin className="size-5" />
              </span>
              <div>
                <p className="font-medium leading-tight">{loc}</p>
                <Link
                  href={`/participa#propuesta`}
                  className="text-xs text-primary hover:underline"
                >
                  Proponer aquí
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
