"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ExternalLink, FileQuestion, Loader2, Replace, Save, Send, Star, Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogTitle,
} from "@/components/ui/dialog";
import { Field, describeFieldErrors, useFieldErrors } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";
import { formatBytes, mediaKind } from "@/lib/media-kind";
import { reemplazarArchivoCobertura, subirArchivoCobertura } from "@/lib/upload-cobertura";
import {
  removeCoberturaFile, updateCoberturaFileMeta, type CoberturaFile, type Fase,
} from "@/actions/coberturas";

const FASE_LABEL: Record<Fase, string> = {
  crudo: "Contenido Crudo",
  editado: "Contenido Editado",
  aprobado: "Contenido Aprobado",
};

/* ─────────────────────────── Reproductor ─────────────────────────── */

function Visor({ file }: { file: CoberturaFile }) {
  const kind = mediaKind(file.mime, file.nombre);

  // En Drive delegamos la reproducción a Google: hace streaming por rangos, así
  // que un video de varios GB arranca al instante sin pasar por el servidor.
  if (file.drive_file_id) {
    if (kind === "imagen") {
      return (
        // El proxy ya devuelve el ancho pedido y cachea en el navegador, así que
        // `next/image` no aporta nada aquí.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/drive/thumb/${file.drive_file_id}?w=1600`}
          alt={file.nombre}
          className="max-h-[60vh] w-full bg-black object-contain"
        />
      );
    }
    return (
      <iframe
        src={`https://drive.google.com/file/d/${file.drive_file_id}/preview`}
        allow="autoplay; fullscreen"
        allowFullScreen
        title={file.nombre}
        className="h-[60vh] w-full border-0 bg-black"
      />
    );
  }

  // Archivos que siguen en Supabase (Drive desconectado): reproducción nativa.
  if (kind === "imagen") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={file.url} alt={file.nombre} className="max-h-[60vh] w-full bg-black object-contain" />;
  }
  if (kind === "video") {
    return <video src={file.url} controls className="max-h-[60vh] w-full bg-black" />;
  }
  if (kind === "audio") {
    return (
      <div className="flex h-40 items-center justify-center bg-muted/40 px-6">
        <audio src={file.url} controls className="w-full" />
      </div>
    );
  }
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-2 bg-muted/40 text-muted-foreground">
      <FileQuestion className="size-8" />
      <p className="text-sm">Este tipo de archivo no se puede previsualizar aquí.</p>
    </div>
  );
}

/* ─────────────────────────── Diálogo ─────────────────────────── */

export function CoberturaFileDialog({
  file,
  fases,
  onClose,
  onActualizar,
  onEliminar,
  onNuevoArchivo,
  onMover,
}: {
  file: CoberturaFile | null;
  fases: Fase[];
  onClose: () => void;
  onActualizar: (file: CoberturaFile) => void;
  onEliminar: (id: string) => void;
  onNuevoArchivo: (file: CoberturaFile) => void;
  onMover: (fase: Fase) => void;
}) {
  const [, start] = useTransition();
  const fe = useFieldErrors();

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tags, setTags] = useState("");
  const [destacado, setDestacado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [transferencia, setTransferencia] = useState<string | null>(null);
  const [faseDerivada, setFaseDerivada] = useState<Fase>("editado");

  const inputReemplazo = useRef<HTMLInputElement>(null);
  const inputDerivar = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) return;
    setNombre(file.nombre);
    setDescripcion(file.descripcion ?? "");
    setTags(file.tags.join(", "));
    setDestacado(file.destacado);
    setFaseDerivada(file.fase === "crudo" ? "editado" : "aprobado");
    fe.clear();
    // La ficha se recarga al cambiar de archivo; `fe` es estable entre renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id]);

  if (!file) return null;

  const guardarFicha = () =>
    start(async () => {
      setGuardando(true);
      const res = await updateCoberturaFileMeta({
        file_id: file.id,
        nombre,
        descripcion,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        destacado,
      });
      setGuardando(false);
      if (res.ok && res.data) {
        onActualizar(res.data);
        toast.success(res.message);
      } else {
        fe.fromResult(res);
        toast.error(describeFieldErrors(res) ?? res.message);
      }
    });

  const reemplazar = async (nuevo: File) => {
    setTransferencia("Reemplazando… 0%");
    const res = await reemplazarArchivoCobertura(file.id, nuevo, {
      onProgress: (f) => setTransferencia(`Reemplazando… ${Math.round(f * 100)}%`),
    });
    setTransferencia(null);
    if (res.ok && res.file) {
      onActualizar(res.file);
      setNombre(res.file.nombre);
      toast.success(res.message ?? "Contenido reemplazado.");
    } else if (!res.cancelado) {
      toast.error(res.message ?? "No se pudo reemplazar.");
    }
  };

  const derivar = async (nuevo: File) => {
    setTransferencia("Subiendo… 0%");
    const res = await subirArchivoCobertura(file.cobertura_id, faseDerivada, nuevo, {
      origenFileId: file.id,
      onProgress: (f) => setTransferencia(`Subiendo… ${Math.round(f * 100)}%`),
    });
    setTransferencia(null);
    if (res.ok && res.file) {
      onNuevoArchivo(res.file);
      toast.success(`Agregado a ${FASE_LABEL[faseDerivada]}.`);
    } else if (!res.cancelado) {
      toast.error(res.message ?? "No se pudo subir.");
    }
  };

  const eliminar = () =>
    start(async () => {
      const res = await removeCoberturaFile(file.id, file.storage_path);
      if (res.ok) {
        onEliminar(file.id);
        onClose();
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    });

  const ocupado = transferencia !== null;

  return (
    <Dialog open onOpenChange={(o) => !o && !ocupado && onClose()}>
      <DialogContent className="max-w-5xl p-0 sm:p-0">
        <DialogTitle className="sr-only">{file.nombre}</DialogTitle>
        <DialogDescription className="sr-only">
          Vista previa y ficha del archivo {file.nombre}.
        </DialogDescription>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-hidden rounded-t-2xl bg-black lg:rounded-l-2xl lg:rounded-tr-none">
            <Visor file={file} />
          </div>

          <div className="flex flex-col gap-3 p-4 lg:max-h-[80vh] lg:overflow-y-auto" ref={fe.containerRef}>
            <div className="flex flex-wrap items-center gap-1.5">
              {file.version > 1 && <Badge variant="secondary">versión {file.version}</Badge>}
              {file.origen_file_id && <Badge variant="outline">derivado</Badge>}
            </div>

            {/* Misma operación que arrastrar la tarjeta, para quien no usa ratón. */}
            <Field label="Fase">
              <Select value={file.fase} onValueChange={(v) => onMover(v as Fase)}>
                <SelectTrigger className="h-9" disabled={ocupado}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {fases.map((f) => (
                    <SelectItem key={f} value={f}>{FASE_LABEL[f]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Nombre" {...fe.field("nombre")}>
              <Input
                value={nombre}
                onChange={(e) => { setNombre(e.target.value); fe.clear("nombre"); }}
                disabled={ocupado}
              />
            </Field>

            <Field label="Descripción" {...fe.field("descripcion")}>
              <Textarea
                rows={3}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Qué se ve, para qué sirve, qué falta…"
                disabled={ocupado}
              />
            </Field>

            <Field label="Etiquetas" hint="Separadas por comas.">
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="entrevista, plano general"
                disabled={ocupado}
              />
            </Field>

            <button
              type="button"
              onClick={() => setDestacado((d) => !d)}
              disabled={ocupado}
              className="flex items-center gap-2 self-start rounded-lg border px-3 py-1.5 text-sm hover:bg-muted/60"
            >
              <Star className={`size-4 ${destacado ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`} />
              {destacado ? "Destacado" : "Marcar como destacado"}
            </button>

            <Button onClick={guardarFicha} disabled={guardando || ocupado} className="w-full">
              {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Guardar ficha
            </Button>

            <div className="space-y-2 border-t pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contenido</p>

              <input
                ref={inputReemplazo}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void reemplazar(f);
                }}
              />
              <Button
                variant="outline"
                className="w-full"
                disabled={ocupado || !file.drive_file_id}
                onClick={() => inputReemplazo.current?.click()}
                title={file.drive_file_id ? undefined : "Solo para archivos alojados en Drive"}
              >
                <Replace className="size-4" /> Reemplazar contenido
              </Button>

              <div className="flex gap-2">
                <Select value={faseDerivada} onValueChange={(v) => setFaseDerivada(v as Fase)}>
                  <SelectTrigger className="h-9 flex-1" disabled={ocupado}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fases.map((f) => (
                      <SelectItem key={f} value={f}>{FASE_LABEL[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  ref={inputDerivar}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void derivar(f);
                  }}
                />
                <Button variant="outline" disabled={ocupado} onClick={() => inputDerivar.current?.click()}>
                  <Send className="size-4" /> Enviar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                «Enviar» sube una pieza nueva a la fase elegida y la deja enlazada a esta.
              </p>

              {transferencia && (
                <p className="flex items-center gap-2 text-sm text-primary">
                  <Loader2 className="size-4 animate-spin" /> {transferencia}
                </p>
              )}
            </div>

            <div className="mt-auto space-y-2 border-t pt-3 text-xs text-muted-foreground">
              <p>{formatBytes(file.size)} · subido el {formatDate(file.created_at)}</p>
              <div className="flex gap-2">
                <Button asChild variant="ghost" size="sm" className="flex-1">
                  <a href={file.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4" /> Abrir original
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={ocupado}
                  onClick={eliminar}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" /> Eliminar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
