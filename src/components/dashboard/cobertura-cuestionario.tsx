"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  CAMPO_LABEL, acotar, preguntasAplicables, primeraPendiente,
  type FichaExtraida, type Pregunta, type Respuesta,
} from "@/lib/cuestionario-shared";
import { extraerFicha, guardarRespuesta } from "@/actions/cuestionario";

type Estado = "preguntando" | "procesando";

/**
 * Cuestionario por voz. Se recorre en carrusel: adelante, atrás, saltando con
 * los puntos o con las flechas del teclado.
 *
 * El avance se guarda respuesta a respuesta, no al terminar: si se cae la
 * conexión o cierran la pestaña, lo dicho no se pierde.
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
  /** null = todavía no eligieron si la jornada ya ocurrió. */
  const [yaOcurrio, setYaOcurrio] = useState<boolean | null>(null);
  const [i, setI] = useState(0);
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [estado, setEstado] = useState<Estado>("preguntando");
  const [transcribiendo, setTranscribiendo] = useState(false);
  /** Audio grabado que no se pudo transcribir: permite reintentar sin regrabar. */
  const [pendiente, setPendiente] = useState<Blob | null>(null);

  const grabadora = useGrabadora();
  const soportado = grabacionSoportada();

  const lista = useMemo(
    () => (yaOcurrio === null ? [] : preguntasAplicables(preguntas, yaOcurrio)),
    [preguntas, yaOcurrio],
  );
  const actual = lista[i] ?? null;
  const respondidas = useMemo(
    () => new Set(Object.entries(textos).filter(([, t]) => t.trim()).map(([id]) => id)),
    [textos],
  );

  // Al abrir, precarga lo ya respondido para poder retomar donde se iba.
  useEffect(() => {
    if (!abierto) return;
    setTextos(Object.fromEntries(respuestasIniciales.map((r) => [r.pregunta_id, r.transcripcion])));
    setYaOcurrio(null);
    setI(0);
    setEstado("preguntando");
    setPendiente(null);
  }, [abierto, respuestasIniciales]);

  // Al elegir el momento, abre en la primera sin responder.
  useEffect(() => {
    if (yaOcurrio === null) return;
    const aplicables = preguntasAplicables(preguntas, yaOcurrio);
    const yaHechas = new Set(
      respuestasIniciales.filter((r) => r.transcripcion.trim()).map((r) => r.pregunta_id),
    );
    setI(primeraPendiente(aplicables, yaHechas));
  }, [yaOcurrio, preguntas, respuestasIniciales]);

  /** Guarda antes de moverse: nadie pierde lo dicho por navegar. */
  const guardarActual = useCallback(async () => {
    if (!actual) return;
    const texto = (textos[actual.id] ?? "").trim();
    if (!texto) return;
    const previa = respuestasIniciales.find((r) => r.pregunta_id === actual.id);
    if (previa?.transcripcion.trim() === texto) return; // nada cambió
    await guardarRespuesta({
      cobertura_id: coberturaId,
      pregunta_id: actual.id,
      transcripcion: texto,
    });
  }, [actual, textos, coberturaId, respuestasIniciales]);

  const ir = useCallback(
    (destino: number) => {
      void guardarActual();
      setPendiente(null);
      setI(acotar(destino, lista.length));
    },
    [guardarActual, lista.length],
  );

  // Flechas del teclado: recorrer sin soltar el ratón.
  useEffect(() => {
    if (!abierto || yaOcurrio === null || estado !== "preguntando") return;
    const onKey = (e: KeyboardEvent) => {
      const enCampo = (e.target as HTMLElement)?.tagName === "TEXTAREA";
      if (enCampo) return;
      if (e.key === "ArrowRight") ir(i + 1);
      if (e.key === "ArrowLeft") ir(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto, yaOcurrio, estado, i, ir]);

  const ponerTexto = (texto: string) => {
    if (!actual) return;
    setTextos((t) => ({ ...t, [actual.id]: texto }));
  };

  const procesarAudio = async (blob: Blob) => {
    setTranscribiendo(true);
    try {
      const texto = await transcribir(blob);
      if (!texto) {
        toast.error("No se entendió nada. Intenta de nuevo o escríbelo.");
        setPendiente(blob);
        return;
      }
      // Se concatena en vez de reemplazar: es normal grabar en dos tandas.
      const previo = (actual && textos[actual.id]) || "";
      ponerTexto(previo ? `${previo} ${texto}` : texto);
      setPendiente(null);
    } catch (e) {
      // Se conserva el audio: reintentar no obliga a volver a hablar.
      setPendiente(blob);
      toast.error(e instanceof Error ? e.message : "No se pudo transcribir.");
    } finally {
      setTranscribiendo(false);
    }
  };

  const alternarGrabacion = async () => {
    if (grabadora.grabando) {
      const out = await grabadora.detener();
      if (out) await procesarAudio(out.blob);
      return;
    }
    const ok = await grabadora.iniciar();
    if (!ok) toast.error("No se pudo usar el micrófono. Puedes escribir la respuesta.");
  };

  const terminar = async () => {
    await guardarActual();
    setEstado("procesando");
    const res = await extraerFicha(coberturaId);
    setEstado("preguntando");
    if (res.ok && res.data) {
      onExtraido(res.data);
    } else {
      toast.error(res.message);
    }
  };

  const totalRespondidas = lista.filter((p) => respondidas.has(p.id)).length;

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-w-2xl">
        {yaOcurrio === null ? (
          <>
            <DialogHeader>
              <DialogTitle>Cuestionario por voz</DialogTitle>
              <DialogDescription>
                Responde hablando y la información se acomoda sola en el formulario.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm">¿La jornada ya ocurrió?</p>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => setYaOcurrio(true)}>
                  Sí, ya pasó
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setYaOcurrio(false)}>
                  Todavía no
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Si todavía no ocurrió, se omiten las preguntas sobre lo que pasó.
              </p>
            </div>
          </>
        ) : lista.length === 0 ? (
          <>
            <DialogHeader>
              <DialogTitle>Sin preguntas</DialogTitle>
            </DialogHeader>
            <p className="py-4 text-sm text-muted-foreground">
              No hay preguntas activas para este momento. Revísalas en Configuración.
            </p>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                Pregunta {i + 1} de {lista.length}
              </DialogTitle>
              <DialogDescription>
                {totalRespondidas} de {lista.length} respondidas · llena {actual ? CAMPO_LABEL[actual.campo] : ""}
              </DialogDescription>
            </DialogHeader>

            {/* Los puntos son navegables: saltar a cualquier pregunta sin pasar
                por las del medio. */}
            <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
              {lista.map((p, idx) => (
                <button
                  key={p.id}
                  onClick={() => ir(idx)}
                  title={p.pregunta}
                  aria-label={`Ir a la pregunta ${idx + 1}`}
                  aria-current={idx === i}
                  className={`size-2.5 rounded-full transition ${
                    idx === i
                      ? "ring-2 ring-primary ring-offset-2 bg-primary"
                      : respondidas.has(p.id)
                        ? "bg-primary/60"
                        : "bg-muted-foreground/25"
                  }`}
                />
              ))}
            </div>

            <div className="space-y-3 py-1">
              <div>
                <p className="text-base font-medium">{actual?.pregunta}</p>
                {actual?.ayuda && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{actual.ayuda}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {soportado ? (
                  <Button
                    variant={grabadora.grabando ? "destructive" : "default"}
                    onClick={alternarGrabacion}
                    disabled={transcribiendo || estado === "procesando"}
                  >
                    {grabadora.grabando ? (
                      <>
                        <Square className="mr-1.5 size-4" /> Detener ({grabadora.segundos}s)
                      </>
                    ) : (
                      <>
                        <Mic className="mr-1.5 size-4" /> Grabar
                      </>
                    )}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Este navegador no permite grabar. Escribe la respuesta.
                  </span>
                )}

                {transcribiendo && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Transcribiendo…
                  </span>
                )}

                {/* El audio se conservó: reintentar no obliga a volver a hablar. */}
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
                rows={4}
                value={(actual && textos[actual.id]) || ""}
                onChange={(e) => ponerTexto(e.target.value)}
                placeholder="Lo transcrito aparece aquí. Puedes corregirlo."
              />
              <p className="text-xs text-muted-foreground">
                Whisper se equivoca con nombres propios y con ruido de calle. Corregir aquí es más
                barato que corregir la ficha después.
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 border-t pt-3">
              <Button variant="ghost" onClick={() => ir(i - 1)} disabled={i === 0}>
                <ChevronLeft className="size-4" /> Anterior
              </Button>

              <Button
                onClick={terminar}
                disabled={estado === "procesando" || totalRespondidas === 0}
                title={
                  totalRespondidas === 0
                    ? "Responde al menos una pregunta"
                    : "Pasa lo respondido al formulario"
                }
              >
                {estado === "procesando" ? (
                  <>
                    <Loader2 className="mr-1.5 size-4 animate-spin" /> Procesando…
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-1.5 size-4" /> Pasar al formulario
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                onClick={() => ir(i + 1)}
                disabled={i >= lista.length - 1}
              >
                Siguiente <ChevronRight className="size-4" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
