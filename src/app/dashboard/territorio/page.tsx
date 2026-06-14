import { MapPinned } from "lucide-react";

import { PageHeader, EmptyState } from "@/components/dashboard/shared";
import { Card, CardContent } from "@/components/ui/card";
import { PriorityBadge } from "@/lib/status";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import type { Zone } from "@/types/database";

async function getZones(): Promise<Zone[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("zones")
      .select("*")
      .is("deleted_at", null)
      .order("prioridad", { ascending: false })
      .limit(100);
    return (data as Zone[]) ?? [];
  } catch {
    return [];
  }
}

export default async function TerritorioDashboardPage() {
  const zones = await getZones();

  return (
    <>
      <PageHeader
        title="Territorio / zonas"
        description="Organización por localidad, UPZ, barrio o municipio."
      />
      {zones.length === 0 ? (
        <EmptyState icon={MapPinned} title="Sin zonas" description="Crea zonas territoriales para organizar el trabajo de campo." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {zones.map((z) => (
            <Card key={z.id}>
              <CardContent className="p-5">
                <div className="mb-2 flex items-center justify-between">
                  <Badge variant="muted">{z.tipo_zona}</Badge>
                  <PriorityBadge priority={z.prioridad} />
                </div>
                <h3 className="font-semibold">{z.nombre_zona}</h3>
                {z.descripcion && <p className="mt-1 text-sm text-muted-foreground">{z.descripcion}</p>}
                {z.problematicas && z.problematicas.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {z.problematicas.slice(0, 4).map((p) => (
                      <Badge key={p} variant="outline">{p}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
