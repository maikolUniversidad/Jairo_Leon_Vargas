"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, HardDrive, FolderOpen, Upload, FileText, X, MapPin, CalendarDays, RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { uploadCoberturaFile } from "@/lib/upload";
import {
  updateCoberturaEstado, removeCoberturaFile, repairCoberturaDrive,
  type Cobertura, type CoberturaFile, type Fase,
} from "@/actions/coberturas";

const FASES: { key: Fase; label: string; folder: keyof Cobertura; tone: string }[] = [
  { key: "crudo", label: "Contenido Crudo", folder: "drive_crudo_id", tone: "border-t-amber-400" },
  { key: "editado", label: "Contenido Editado", folder: "drive_editado_id", tone: "border-t-blue-400" },
  { key: "aprobado", label: "Contenido Aprobado", folder: "drive_aprobado_id", tone: "border-t-emerald-500" },
];

const ESTADOS = ["planeada", "en_curso", "en_edicion", "en_aprobacion", "publicada", "archivada"];

export function CoberturaDetail({
  cobertura,
  files: filesIni,
}: {
  cobertura: Cobertura;
  files: Record<Fase, CoberturaFile[]>;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [files, setFiles] = useState(filesIni);
  const [uploadingFase, setUploadingFase] = useState<Fase | null>(null);

  async function handleUpload(fase: Fase, list: FileList) {
    setUploadingFase(fase);
    try {
      let okCount = 0;
      for (const file of Array.from(list)) {
        const res = await uploadCoberturaFile(cobertura.id, fase, file);
        if (res.ok) okCount++;
        else toast.error(`${file.name}: ${res.message}`);
      }
      if (okCount > 0) { toast.success(`${okCount} archivo(s) agregado(s).`); router.refresh(); }
    } finally {
      setUploadingFase(null);
    }
  }

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

      <div className="grid gap-4 lg:grid-cols-3">
        {FASES.map((f) => {
          const list = files[f.key];
          const folderId = cobertura[f.folder] as string | null;
          return (
            <div key={f.key} className={`flex flex-col rounded-xl border border-t-4 bg-muted/20 ${f.tone}`}>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="font-semibold">{f.label}</span>
                <Badge variant="muted">{list.length}</Badge>
              </div>

              <div className="flex flex-1 flex-col gap-2 px-3 pb-3">
                {list.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground/60">Sin archivos</p>
                )}
                {list.map((file) => (
                  <div key={file.id} className="flex items-center gap-2 rounded-lg border bg-background p-2 text-sm">
                    <FileText className="size-4 shrink-0 text-primary" />
                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate hover:underline">
                      {file.nombre}
                    </a>
                    <button
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => start(async () => {
                        const res = await removeCoberturaFile(file.id, file.storage_path);
                        if (res.ok) setFiles((p) => ({ ...p, [f.key]: p[f.key].filter((x) => x.id !== file.id) }));
                        else toast.error(res.message);
                      })}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}

                <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50">
                  <Upload className="size-4" />
                  {uploadingFase === f.key ? "Subiendo…" : "Subir archivos"}
                  <input
                    type="file" multiple className="hidden"
                    disabled={uploadingFase !== null}
                    onChange={(e) => { if (e.target.files?.length) handleUpload(f.key, e.target.files); e.target.value = ""; }}
                  />
                </label>

                {folderId && (
                  <a
                    href={`https://drive.google.com/drive/folders/${folderId}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary"
                  >
                    <FolderOpen className="size-3.5" /> Ver en Drive
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
