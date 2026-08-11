import Link from "next/link";
import { Clapperboard, MapPin, CalendarDays, HardDrive } from "lucide-react";

import { PageHeader, EmptyState } from "@/components/dashboard/shared";
import { CoberturaCreateDialog } from "@/components/dashboard/cobertura-create-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listCoberturas, listPortadas } from "@/actions/coberturas";
import { CoberturaPortada } from "@/components/dashboard/cobertura-portada";
import { formatDate } from "@/lib/utils";

const ESTADO_TONE: Record<string, "muted" | "warning" | "secondary" | "success"> = {
  planeada: "muted",
  en_curso: "warning",
  en_edicion: "secondary",
  en_aprobacion: "secondary",
  publicada: "success",
  archivada: "muted",
};

export default async function CoberturasPage() {
  const coberturas = await listCoberturas();
  // Una sola consulta para todas las portadas: una por tarjeta convertiría el
  // listado en N+1 peticiones.
  const portadas = await listPortadas(coberturas.map((c) => c.id));

  return (
    <>
      <PageHeader
        title="Coberturas"
        description="Eventos cubiertos por comunicaciones. Cada uno con su carpeta en Drive y fases de contenido."
        action={<CoberturaCreateDialog />}
      />

      {coberturas.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title="Sin coberturas"
          description="Crea la primera. Se generará su carpeta en Drive con Contenido Crudo, Editado y Aprobado."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coberturas.map((c) => (
            <Link key={c.id} href={`/dashboard/comunicaciones/coberturas/${c.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex h-full flex-col gap-2 p-3">
                  <CoberturaPortada imagenes={portadas[c.id] ?? []} nombre={c.nombre} />
                  <div className="flex items-start justify-between gap-2 px-2 pt-1">
                    <p className="font-semibold leading-tight">{c.nombre}</p>
                    <Badge variant={ESTADO_TONE[c.estado] ?? "muted"} className="shrink-0">
                      {c.estado.replace("_", " ")}
                    </Badge>
                  </div>
                  {c.descripcion && (
                    <p className="line-clamp-2 px-2 text-xs text-muted-foreground">{c.descripcion}</p>
                  )}
                  <div className="mt-auto flex flex-wrap gap-3 px-2 pb-1 pt-2 text-xs text-muted-foreground">
                    {c.fecha && <span className="flex items-center gap-1"><CalendarDays className="size-3.5" />{formatDate(c.fecha)}</span>}
                    {c.lugar && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{c.lugar}</span>}
                    {c.drive_folder_id && <span className="flex items-center gap-1 text-emerald-600"><HardDrive className="size-3.5" />Drive</span>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
