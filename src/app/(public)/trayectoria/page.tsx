import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageIntro } from "@/components/landing/page-intro";

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
    titulo: "Representante a la Cámara por Bogotá D.C.",
    desc: "Aspiración en el entorno del Pacto Histórico · Renglón 106.",
    tag: "Participación",
  },
];

export default function TrayectoriaPage() {
  return (
    <div className="container max-w-3xl py-12 md:py-16">
      <PageIntro
        eyebrow="Trayectoria verificada"
        title="Trayectoria pública"
        description="Información basada en hechos verificables. Los contenidos detallados se gestionan desde el panel y se publican con respaldo documental."
      />

      <ol className="relative space-y-5 border-l-2 border-primary/20 pl-8">
        {HITOS.map((h, i) => (
          <li key={h.titulo} className="relative">
            <span className="absolute -left-[41px] flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground shadow-sm">
              {i + 1}
            </span>
            <Card className="shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="muted">{h.tag}</Badge>
                  <span className="text-xs font-medium text-muted-foreground">{h.periodo}</span>
                </div>
                <h3 className="font-bold">{h.titulo}</h3>
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
