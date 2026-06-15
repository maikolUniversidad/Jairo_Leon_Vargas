import Link from "next/link";
import { Clapperboard, Newspaper, CalendarRange, ArrowRight } from "lucide-react";

import { PageHeader } from "@/components/dashboard/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

async function getCounts() {
  try {
    const supabase = await createClient();
    const [cob, pub, cal] = await Promise.all([
      supabase.from("coberturas").select("*", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("content_posts").select("*", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("content_calendar").select("*", { count: "exact", head: true }),
    ]);
    return { coberturas: cob.count ?? 0, publicaciones: pub.count ?? 0, calendario: cal.count ?? 0 };
  } catch {
    return { coberturas: 0, publicaciones: 0, calendario: 0 };
  }
}

const CARDS = [
  {
    href: "/dashboard/comunicaciones/coberturas",
    icon: Clapperboard,
    title: "Coberturas",
    desc: "Cada cobertura crea su carpeta en Drive con Contenido Crudo, Editado y Aprobado.",
    key: "coberturas" as const,
  },
  {
    href: "/dashboard/comunicaciones/publicaciones",
    icon: Newspaper,
    title: "Publicaciones",
    desc: "Noticias, comunicados y piezas (idea → publicado). Las públicas salen en el sitio.",
    key: "publicaciones" as const,
  },
  {
    href: "/dashboard/comunicaciones/calendario",
    icon: CalendarRange,
    title: "Calendario editorial",
    desc: "Programa piezas por canal y fecha, con responsable y estado.",
    key: "calendario" as const,
  },
];

export default async function ComunicacionesPage() {
  const counts = await getCounts();

  return (
    <>
      <PageHeader
        title="Comunicaciones"
        description="Proyectos de comunicación: coberturas, publicaciones y calendario editorial."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <c.icon className="size-5" />
                  </span>
                  <Badge variant="muted">{counts[c.key]}</Badge>
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{c.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
                </div>
                <span className="flex items-center gap-1 text-sm font-medium text-primary">
                  Gestionar <ArrowRight className="size-4" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
