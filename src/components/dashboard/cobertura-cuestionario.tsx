"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, Loader2, Mic, Square, TriangleAlert, Wand2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { grabacionSoportada, transcribir, useGrabadora } from "@/lib/audio-recorder";
import {
  CAMPO_LABEL, acotar, preguntasAplicables,
  type FichaExtraida, type Pregunta, type Respuesta,
} from "@/lib/cuestionario-shared";
import { guardarDictado } from "@/actions/cuestionario";

type Paso = "momento" | "grabando" | "revisando";

const mmss = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/**
 * Cuestionario por voz: UNA grabación corrida mientras se ojean las preguntas
 * como guion, y la IA reparte después.
 *
 * Se hizo así porque contar la jornada de un tirón sale natural; parar a
 * contestar de a una pregunta, no. Las preguntas no son casillas: son el guion
 * de lo que hay que acordarse de mencionar.
 */
export function CoberturaCuestionario({
  abierto,
  coberturaId,
  preguntas,
  respuestasIniciales,
  onCerrar,
  onExtraido,
}: {
  abierto: boolean;
  coberturaId: string;
  preguntas: Pregunta[];
  respuestasIniciales: Respuesta[];
  onCerrar: () => void;
  onExtraido: (ficha: FichaExtraida) => void;
}) {
  const [paso, setPaso] = useState<Paso>("momento");
  const [yaOcurrio, setYaOcurrio] = useState(true);
  const [i, setI] = useState(0);
  const [texto, setTexto] = useState("");
  const [transcribiendo, setTranscribiendo] = useState(false);
  const [repartiendo, setRepartiendo] = useState(false);
  /** Audio que no se pudo transcribir: reintentar sin volver a hablar. */
  const [pendiente, setPendiente] = useState<Blob | null>(null);
  const [duracion, setDuracion] = useState(0);

  const grabadora = useGrabadora();
  const soportado = grabacionSoportada();

  /**
   * El reinicio se ata SOLO a la apertura del diálogo.
   *
   * Antes dependía también de `respuestasIniciales`, y como guardar revalidaba
   * la ruta, el server component mandaba un arreglo nuevo en cada avance: el
   * efecto se volvía a disparar y la pregunta «¿ya ocurrió?» reaparecía sola.
   */
  const estabaAbierto = useRef(false);
  useEffect(() => {
    if (abierto && !estabaAbierto.current) {
      setPaso("momento");
      setYaOcurrio(true);
      setI(0);
      setTexto("");
      setPendiente(null);
      setDuracion(0);
    }
    estabaAbierto.current = abierto;
  }, [abierto]);

  const lista = useMemo(
    () => preguntasAplicables(preguntas, yaOcurrio),
    [preguntas, yaOcurrio],
  );
  const actual = lista[i] ?? null;

  /** Campos que ya tienen algo, de una grabación anterior. */
  const yaCubiertos = useMemo(
    () => new Set(respuestasIniciales.filter((r) => r.transcripcion.trim()).map((r) => r.pregunta_id)),
    [respuestasIniciales],
  );

  const ir = useCallback(
    (destino: number) => setI((prev) => acotar(destino === prev ? prev : destino, lista.length)),
    [lista.length],
  );

  // Flechas del teclado para recorrer el guion sin soltar el micrófono.
  useEffect(() => {
    if (!abierto || paso !== "grabando") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight") ir(i + 1);
      if (e.key === "ArrowLeft") ir(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto, paso, i, ir]);

  const procesarAudio = async (blob: Blob) => {
    setTranscribiendo(true);
    try {
      const t = await transcribir(blob);
      if (!t) {
        toast.error("No se entendió nada. Intenta de nuevo o escríbelo.");
        setPendiente(blob);
        return;
      }
      // Se concatena: es normal grabar en dos tandas o acordarse de algo después.
      setTexto((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t));
      setPendiente(null);
      setPaso("revisando");
    } catch (e) {
      setPendiente(blob);
      toast.error(e instanceof Error ? e.message : "No se pudo transcribir.");
    } finally {
      setTranscribiendo(false);
    }
  };

  const alternarGrabacion = async () => {
    if (grabadora.grabando) {
      const out = await grabadora.detener();
      if (out) {
        setDuracion((d) => d + out.duracionSeg);
        await procesarAudio(out.blob);
      }
      return;
    }
    const ok = await grabadora.iniciar();
    if (!ok) toast.error("No se pudo usar el micrófono. Puedes escribir lo que pasó.");
  };

  const repartir = async () => {
    const t = texto.trim();
    if (!t) return toast.error("Todavía no hay nada que repartir.");
    setRepartiendo(true);
    const res = await guardarDictado({
      cobertura_id: coberturaId,
      transcripcion: t,
      duracion_seg: duracion || null,
    });
    setRepartiendo(false);
    if (res.ok && res.data) onExtraido(res.data);
    else toast.error(res.message);
  };

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-w-2xl">
        {paso === "momento" ? (
          <>
            <DialogHeader>
              <DialogTitle>Cuestionario por voz</DialogTitle>
              <DialogDescription>
                Cuenta la jornada de corrido. Las preguntas son solo el guion.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm">¿La jornada ya ocurrió?</p>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => {
                    setYaOcurrio(true);
                    setPaso("grabando");
                  }}
                >
                  Sí, ya pasó
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setYaOcurrio(false);
                    setPaso("grabando");
                  }}
                >
                  Todavía no
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Si todavía no ocurrió, se omiten las preguntas sobre lo que pasó.
              </p>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {paso === "grabando" ? "Cuenta la jornada" : "Revisa lo transcrito"}
              </DialogTitle>
              <DialogDescription>
                {paso === "grabando"
                  ? "Habla seguido. Ve pasando las preguntas para no dejarte nada."
                  : "Corrige lo que haga falta y repártelo en el formulario."}
              </DialogDescription>
            </DialogHeader>

            {/* ── El guion ── */}
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {lista.map((p, idx) => (
                  <button
                    key={p.id}
                    onClick={() => ir(idx)}
                    title={p.pregunta}
                    aria-label={`Ir a la pregunta ${idx + 1}`}
                    aria-current={idx === i}
                    className={`size-2.5 rounded-full transition ${
                      idx === i
                        ? "bg-primary ring-2 ring-primary ring-offset-2"
                        : yaCubiertos.has(p.id)
                          ? "bg-primary/50"
                          : "bg-muted-foreground/25"
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-start gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-0.5 shrink-0"
                  onClick={() => ir(i - 1)}
                  disabled={i === 0}
                  aria-label="Pregunta anterior"
                >
                  <ChevronLeft className="size-4" />
                </Button>

                <div className="min-w-0 flex-1 text-center">
                  <p className="text-base font-medium">{actual?.pregunta}</p>
                  {actual?.ayuda && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{actual.ayuda}</p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground/70">
                    {i + 1} de {lista.length} · llena {actual ? CAMPO_LABEL[actual.campo] : ""}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-0.5 shrink-0"
                  onClick={() => ir(i + 1)}
                  disabled={i >= lista.length - 1}
                  aria-label="Pregunta siguiente"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>

            {/* ── Grabación ── */}
            <div className="flex flex-wrap items-center gap-2">
              {soportado ? (
                <Button
                  variant={grabadora.grabando ? "destructive" : "default"}
                  onClick={alternarGrabacion}
                  disabled={transcribiendo || repartiendo}
                >
                  {grabadora.grabando ? (
                    <>
                      <Square className="mr-1.5 size-4" /> Detener · {mmss(grabadora.segundos)}
                    </>
                  ) : (
                    <>
                      <Mic className="mr-1.5 size-4" />
                      {texto.trim() ? "Seguir grabando" : "Grabar"}
                    </>
                  )}
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Este navegador no permite grabar. Escribe abajo lo que pasó.
                </span>
              )}

              {transcribiendo && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Transcribiendo…
                </span>
              )}

              {pendiente && !transcribiendo && (
                <Button variant="outline" size="sm" onClick={() => procesarAudio(pendiente)}>
                  Reintentar transcripción
                </Button>
              )}

              {grabadora.permisoDenegado && (
                <span className="flex items-center gap-1 text-xs text-amber-600">
                  <TriangleAlert className="size-3.5" /> Sin acceso al micrófono
                </span>
              )}
            </div>

            <Textarea
              rows={8}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Aquí aparece todo lo que dijiste. Puedes corregirlo antes de repartirlo."
            />
            <p className="text-xs text-muted-foreground">
              Esta transcripción se guarda completa. La IA la reparte en los campos, pero lo que
              dijiste queda tal cual.
            </p>

            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <Button variant="ghost" onClick={onCerrar}>
                Cancelar
              </Button>
              <Button
                onClick={repartir}
                disabled={repartiendo || transcribiendo || !texto.trim()}
              >
                {repartiendo ? (
                  <>
                    <Loader2 className="mr-1.5 size-4 animate-spin" /> Repartiendo…
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-1.5 size-4" /> Repartir en el formulario
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
