import Link from "next/link";
import { Clapperboard, MapPin, CalendarDays, HardDrive } from "lucide-react";

import { PageHeader, EmptyState } from "@/components/dashboard/shared";
import { CoberturaCreateDialog } from "@/components/dashboard/cobertura-create-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listCoberturas } from "@/actions/coberturas";
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
                <CardContent className="flex h-full flex-col gap-2 p-5">
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Clapperboard className="size-5" />
                    </span>
                    <Badge variant={ESTADO_TONE[c.estado] ?? "muted"}>{c.estado.replace("_", " ")}</Badge>
                  </div>
                  <p className="mt-1 font-semibold leading-tight">{c.nombre}</p>
                  {c.descripcion && <p className="line-clamp-2 text-xs text-muted-foreground">{c.descripcion}</p>}
                  <div className="mt-auto flex flex-wrap gap-3 pt-2 text-xs text-muted-foreground">
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
