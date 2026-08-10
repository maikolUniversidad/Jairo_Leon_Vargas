"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, CalendarDays, HardDrive, MapPin, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CoberturaBoard } from "@/components/dashboard/cobertura-board";
import { CoberturaFicha } from "@/components/dashboard/cobertura-ficha-form";
import { formatDate } from "@/lib/utils";
import {
  repairCoberturaDrive, updateCoberturaEstado,
  type Asistente, type Cobertura, type CoberturaFile, type Fase, type PersonaVinculable,
} from "@/actions/coberturas";

const ESTADOS = ["planeada", "en_curso", "en_edicion", "en_aprobacion", "publicada", "archivada"];

export function CoberturaDetail({
  cobertura,
  files,
  asistentes,
  personas,
}: {
  cobertura: Cobertura;
  files: Record<Fase, CoberturaFile[]>;
  asistentes: Asistente[];
  personas: PersonaVinculable[];
}) {
  const router = useRouter();
  const [, start] = useTransition();

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3">
        <Link href="/dashboard/comunicaciones/coberturas"><ArrowLeft className="size-4" /> Coberturas</Link>
      </Button>

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{cobertura.nombre}</h1>
            {cobertura.descripcion && <p className="mt-1 text-sm text-muted-foreground">{cobertura.descripcion}</p>}
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
              {cobertura.fecha && <span className="flex items-center gap-1"><CalendarDays className="size-4" />{formatDate(cobertura.fecha)}</span>}
              {cobertura.lugar && <span className="flex items-center gap-1"><MapPin className="size-4" />{cobertura.lugar}</span>}
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Select
              defaultValue={cobertura.estado}
              onValueChange={(v) => start(async () => {
                const res = await updateCoberturaEstado(cobertura.id, v);
                if (res.ok) toast.success(res.message); else toast.error(res.message);
              })}
            >
              <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ESTADOS.map((e) => <SelectItem key={e} value={e}>{e.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
            {cobertura.drive_link ? (
              <Button asChild variant="outline" size="sm">
                <a href={cobertura.drive_link} target="_blank" rel="noopener noreferrer">
                  <HardDrive className="size-4" /> Abrir carpeta en Drive
                </a>
              </Button>
            ) : (
              <Button
                variant="outline" size="sm"
                onClick={() => start(async () => {
                  const res = await repairCoberturaDrive(cobertura.id);
                  if (res.ok) { toast.success(res.message); router.refresh(); } else toast.error(res.message);
                })}
              >
                <RefreshCw className="size-4" /> Crear carpeta en Drive
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <CoberturaFicha cobertura={cobertura} asistentes={asistentes} personas={personas} />

      <CoberturaBoard cobertura={cobertura} files={files} />
    </>
  );
}
