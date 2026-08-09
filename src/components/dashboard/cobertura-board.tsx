"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FolderOpen, FolderUp, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CoberturaFileCard } from "@/components/dashboard/cobertura-file-card";
import { CoberturaFileDialog } from "@/components/dashboard/cobertura-file-dialog";
import { CoberturaUploadQueue } from "@/components/dashboard/cobertura-upload-queue";
import { useUploadQueue } from "@/hooks/use-upload-queue";
import { moveCoberturaFile, type Cobertura, type CoberturaFile, type Fase } from "@/actions/coberturas";

/** Tipo propio del arrastre interno: distingue una tarjeta de un archivo del escritorio. */
const TIPO_TARJETA = "application/x-cobertura-file";

const COLUMNAS: { key: Fase; label: string; carpeta: keyof Cobertura; tono: string }[] = [
  { key: "crudo", label: "Contenido Crudo", carpeta: "drive_crudo_id", tono: "border-t-amber-400" },
  { key: "editado", label: "Contenido Editado", carpeta: "drive_editado_id", tono: "border-t-blue-400" },
  { key: "aprobado", label: "Contenido Aprobado", carpeta: "drive_aprobado_id", tono: "border-t-emerald-500" },
];

const FASES: Fase[] = ["crudo", "editado", "aprobado"];

export function CoberturaBoard({
  cobertura,
  files: filesIni,
}: {
  cobertura: Cobertura;
  files: Record<Fase, CoberturaFile[]>;
}) {
  const [files, setFiles] = useState<CoberturaFile[]>(() =>
    FASES.flatMap((f) => filesIni[f] ?? []),
  );
  const [abierto, setAbierto] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [columnaActiva, setColumnaActiva] = useState<Fase | null>(null);
  const [anteCard, setAnteCard] = useState<string | null>(null);

  const agregar = useCallback((nuevo: CoberturaFile) => {
    setFiles((prev) => (prev.some((f) => f.id === nuevo.id) ? prev : [...prev, nuevo]));
  }, []);

  const cola = useUploadQueue(cobertura.id, agregar);

  const porFase = useMemo(() => {
    const map: Record<Fase, CoberturaFile[]> = { crudo: [], editado: [], aprobado: [] };
    for (const f of files) map[f.fase]?.push(f);
    for (const fase of FASES) {
      map[fase].sort((a, b) => a.orden - b.orden || a.created_at.localeCompare(b.created_at));
    }
    return map;
  }, [files]);

  /* ───────────────────────── Arrastre entre fases ───────────────────────── */

  const moverArchivo = (id: string, fase: Fase, antesDe: string | null) => {
    const actual = files.find((f) => f.id === id);
    if (!actual) return;
    if (actual.fase === fase && antesDe === id) return;

    const destino = porFase[fase].filter((f) => f.id !== id);
    const corte = antesDe ? destino.findIndex((f) => f.id === antesDe) : -1;
    const posicion = corte === -1 ? destino.length : corte;
    const ids = [
      ...destino.slice(0, posicion).map((f) => f.id),
      id,
      ...destino.slice(posicion).map((f) => f.id),
    ];

    const previo = files;
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id === id) return { ...f, fase, orden: ids.indexOf(id) + 1 };
        const i = ids.indexOf(f.id);
        return i >= 0 ? { ...f, orden: i + 1 } : f;
      }),
    );

    void (async () => {
      const res = await moveCoberturaFile({ file_id: id, fase, orden_destino: ids });
      if (!res.ok) {
        setFiles(previo);
        toast.error(res.message);
      } else if (actual.fase !== fase) {
        toast.success(res.message);
      }
    })();
  };

  const soltarTarjeta = (fase: Fase, antesDe: string | null) => {
    const id = arrastrando;
    setArrastrando(null);
    setColumnaActiva(null);
    setAnteCard(null);
    if (id) moverArchivo(id, fase, antesDe);
  };

  /* ───────────────────────── Archivos del escritorio ───────────────────────── */

  const soltarArchivos = (fase: Fase, lista: FileList) => {
    const archivos = Array.from(lista);
    const encolados = cola.encolar(archivos, fase);
    if (encolados === 0) {
      toast.error("No se reconoció ningún archivo. Para carpetas usa el botón «Subir carpeta».");
    }
  };

  const seleccionado = files.find((f) => f.id === abierto) ?? null;

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNAS.map((col) => (
          <Columna
            key={col.key}
            col={col}
            files={porFase[col.key]}
            folderId={cobertura[col.carpeta] as string | null}
            activa={columnaActiva === col.key}
            arrastrando={arrastrando}
            anteCard={anteCard}
            onDragOverColumna={(esArchivo) => {
              setColumnaActiva(col.key);
              if (esArchivo) setAnteCard(null);
            }}
            onDragLeaveColumna={() => {
              setColumnaActiva((c) => (c === col.key ? null : c));
              setAnteCard(null);
            }}
            onSoltarTarjeta={(antesDe) => soltarTarjeta(col.key, antesDe)}
            onSoltarArchivos={(lista) => soltarArchivos(col.key, lista)}
            onDragStartTarjeta={(id) => setArrastrando(id)}
            onDragEndTarjeta={() => {
              setArrastrando(null);
              setColumnaActiva(null);
              setAnteCard(null);
            }}
            onSobreTarjeta={setAnteCard}
            onAbrir={setAbierto}
          />
        ))}
      </div>

      <CoberturaFileDialog
        file={seleccionado}
        fases={FASES}
        onClose={() => setAbierto(null)}
        onActualizar={(actualizado) =>
          setFiles((prev) => prev.map((f) => (f.id === actualizado.id ? actualizado : f)))
        }
        onEliminar={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
        onNuevoArchivo={agregar}
        onMover={(fase) => seleccionado && moverArchivo(seleccionado.id, fase, null)}
      />

      <CoberturaUploadQueue
        items={cola.items}
        activos={cola.activos}
        conError={cola.conError}
        onCancelar={cola.cancelar}
        onReintentar={cola.reintentar}
        onLimpiar={cola.limpiarTerminados}
      />
    </>
  );
}

/* ───────────────────────────── Una columna ───────────────────────────── */

function Columna({
  col,
  files,
  folderId,
  activa,
  arrastrando,
  anteCard,
  onDragOverColumna,
  onDragLeaveColumna,
  onSoltarTarjeta,
  onSoltarArchivos,
  onDragStartTarjeta,
  onDragEndTarjeta,
  onSobreTarjeta,
  onAbrir,
}: {
  col: { key: Fase; label: string; tono: string };
  files: CoberturaFile[];
  folderId: string | null;
  activa: boolean;
  arrastrando: string | null;
  anteCard: string | null;
  onDragOverColumna: (esArchivo: boolean) => void;
  onDragLeaveColumna: () => void;
  onSoltarTarjeta: (antesDe: string | null) => void;
  onSoltarArchivos: (lista: FileList) => void;
  onDragStartTarjeta: (id: string) => void;
  onDragEndTarjeta: () => void;
  onSobreTarjeta: (id: string | null) => void;
  onAbrir: (id: string) => void;
}) {
  const inputArchivos = useRef<HTMLInputElement>(null);
  const inputCarpeta = useRef<HTMLInputElement>(null);

  const traeArchivos = (e: React.DragEvent) => e.dataTransfer.types.includes("Files");

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        onDragOverColumna(traeArchivos(e));
      }}
      onDragLeave={(e) => {
        // Ignora el paso del puntero sobre las tarjetas de dentro.
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        onDragLeaveColumna();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (traeArchivos(e)) {
          if (e.dataTransfer.files.length > 0) onSoltarArchivos(e.dataTransfer.files);
          onDragLeaveColumna();
        } else {
          onSoltarTarjeta(anteCard);
        }
      }}
      className={`flex flex-col rounded-xl border border-t-4 bg-muted/20 transition ${col.tono} ${
        activa ? "ring-2 ring-primary/40" : ""
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-semibold">{col.label}</span>
        <Badge variant="muted">{files.length}</Badge>
      </div>

      <div className="flex min-h-[7rem] flex-1 flex-col gap-2 px-3 pb-3">
        {files.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground/60">
            Arrastra archivos aquí, o tarjetas de otra fase.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {files.map((file) => (
              <div
                key={file.id}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes(TIPO_TARJETA)) onSobreTarjeta(file.id);
                }}
                className={anteCard === file.id && arrastrando ? "rounded-lg ring-2 ring-primary" : ""}
              >
                <CoberturaFileCard
                  file={file}
                  arrastrando={arrastrando === file.id}
                  onAbrir={() => onAbrir(file.id)}
                  onDragStart={(e) => {
                    onDragStartTarjeta(file.id);
                    e.dataTransfer.setData("text/plain", file.id);
                    e.dataTransfer.setData(TIPO_TARJETA, file.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={onDragEndTarjeta}
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-1 flex gap-2">
          <input
            ref={inputArchivos}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) onSoltarArchivos(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={inputCarpeta}
            type="file"
            multiple
            className="hidden"
            // @ts-expect-error atributo no estándar, soportado por los navegadores de escritorio
            webkitdirectory=""
            onChange={(e) => {
              if (e.target.files?.length) onSoltarArchivos(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => inputArchivos.current?.click()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-dashed px-2 py-2 text-xs text-muted-foreground hover:bg-muted/50"
          >
            <Upload className="size-3.5" /> Subir archivos
          </button>
          <button
            onClick={() => inputCarpeta.current?.click()}
            title="Subir una carpeta completa"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed px-2.5 py-2 text-xs text-muted-foreground hover:bg-muted/50"
          >
            <FolderUp className="size-3.5" /> Carpeta
          </button>
        </div>

        {folderId && (
          <a
            href={`https://drive.google.com/drive/folders/${folderId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <FolderOpen className="size-3.5" /> Ver en Drive
          </a>
        )}
      </div>
    </div>
  );
}
