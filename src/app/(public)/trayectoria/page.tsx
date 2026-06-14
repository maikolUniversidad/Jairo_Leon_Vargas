import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Trayectoria",
  description: "Trayectoria pública verificable de Jairo León Vargas.",
};

const HITOS = [
  {
    periodo: "2012 – 2016",
    titulo: "Alcalde Local de San Cristóbal",
    desc: "Gestión territorial y social: participación comunitaria, espacio público, malla vial, gestión ambiental y rendición de cuentas local.",
    tag: "Gestión territorial",
  },
  {
    periodo: "2022 – 2023",
    titulo: "Prosperidad Social",
    desc: "Director de Oferta Social / Director de Gestión y Articulación de la Oferta Social. Innovación social, pago por resultados y articulación de ayudas humanitarias.",
    tag: "Articulación institucional",
  },
  {
    periodo: "2026 – 2030",
    titulo: "Candidato a Cámara por Bogotá D.C.",
    desc: "Aspiración en el entorno del Pacto Histórico · Renglón 106.",
    tag: "Participación",
  },
];

export default function TrayectoriaPage() {
  return (
    <div className="container max-w-3xl py-12 md:py-16">
      <header className="mb-10">
        <Badge variant="secondary" className="mb-3">Trayectoria verificada</Badge>
        <h1 className="text-3xl font-bold md:text-4xl">Trayectoria pública</h1>
        <p className="mt-2 text-muted-foreground">
          Información basada en hechos verificables. Los contenidos detallados se
          gestionan desde el panel y se publican con respaldo documental.
        </p>
      </header>

      <ol className="relative space-y-6 border-l-2 border-primary/20 pl-6">
        {HITOS.map((h) => (
          <li key={h.titulo} className="relative">
            <span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full border-2 border-primary bg-background">
              <span className="h-2 w-2 rounded-full bg-primary" />
            </span>
            <Card>
              <CardContent className="p-5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="muted">{h.tag}</Badge>
                  <span className="text-xs text-muted-foreground">{h.periodo}</span>
                </div>
                <h3 className="font-semibold">{h.titulo}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{h.desc}</p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      <p className="mt-8 rounded-lg bg-muted/60 p-4 text-xs text-muted-foreground">
        Nota: este sitio evita publicar datos biográficos no confirmados. Todo
        dato sin respaldo documental se mantiene como “pendiente de verificación”
        en el panel administrativo.
      </p>
    </div>
  );
}
