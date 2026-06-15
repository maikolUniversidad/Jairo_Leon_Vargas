import Link from "next/link";
import { Clapperboard, Newspaper, CalendarRange, ArrowRight } from "lucide-react";

import { PageHeader } from "@/components/dashboard/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

async function getCounts() {
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from("coberturas")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null);
    return { coberturas: count ?? 0 };
  } catch {
    return { coberturas: 0 };
  }
}

export default async function ComunicacionesPage() {
  const { coberturas } = await getCounts();

  return (
    <>
      <PageHeader
        title="Comunicaciones"
        description="Proyectos de comunicación: coberturas, contenidos y calendario editorial."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/dashboard/comunicaciones/coberturas">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardContent className="flex h-full flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Clapperboard className="size-5" />
                </span>
                <Badge variant="muted">{coberturas}</Badge>
              </div>
              <div className="flex-1">
                <p className="font-semibold">Coberturas</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cada cobertura crea su carpeta en Drive con Contenido Crudo, Editado y Aprobado.
                </p>
              </div>
              <span className="flex items-center gap-1 text-sm font-medium text-primary">
                Gestionar <ArrowRight className="size-4" />
              </span>
            </CardContent>
          </Card>
        </Link>

        <Card className="h-full border-dashed">
          <CardContent className="flex h-full flex-col gap-3 p-5 text-muted-foreground">
            <span className="flex size-11 items-center justify-center rounded-xl bg-muted">
              <Newspaper className="size-5" />
            </span>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Publicaciones</p>
              <p className="mt-1 text-sm">Noticias y comunicados (flujo idea → publicado). Próximamente.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full border-dashed">
          <CardContent className="flex h-full flex-col gap-3 p-5 text-muted-foreground">
            <span className="flex size-11 items-center justify-center rounded-xl bg-muted">
              <CalendarRange className="size-5" />
            </span>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Calendario editorial</p>
              <p className="mt-1 text-sm">Programación de piezas por canal. Próximamente.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
