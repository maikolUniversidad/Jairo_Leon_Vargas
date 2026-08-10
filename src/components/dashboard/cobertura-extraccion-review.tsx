"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  CAMPOS_PREGUNTA, CAMPO_LABEL, TIPO_CAMPO,
  type CampoPregunta, type FichaExtraida,
} from "@/lib/cuestionario-shared";

/** Cómo se ve un valor cualquiera de la ficha en la comparación. */
function comoTexto(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

/**
 * Revisión de lo que la IA propone, campo por campo, antes de tocar el
 * formulario.
 *
 * La preselección importa: si el campo estaba vacío, gana lo propuesto; si ya
 * tenía texto, gana lo actual. Sobrescribir lo que alguien escribió a mano tiene
 * que ser un acto deliberado, no el camino por defecto.
 */
export function CoberturaExtraccionReview({
  abierto,
  propuesta,
  actuales,
  onCancelar,
  onAplicar,
}: {
  abierto: boolean;
  propuesta: FichaExtraida;
  /** Lo que hay hoy en el formulario, por campo. */
  actuales: Partial<Record<CampoPregunta, unknown>>;
  onCancelar: () => void;
  onAplicar: (elegidos: FichaExtraida) => void;
}) {
  const filas = useMemo(
    () =>
      CAMPOS_PREGUNTA.filter((c) => propuesta[c] !== undefined).map((campo) => ({
        campo,
        actual: comoTexto(actuales[campo]),
        propuesto: comoTexto(propuesta[campo]),
      })),
    [propuesta, actuales],
  );

  /** true = usar lo propuesto. */
  const [usar, setUsar] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!abierto) return;
    setUsar(Object.fromEntries(filas.map((f) => [f.campo, f.actual.trim() === ""])));
  }, [abierto, filas]);

  const aplicar = () => {
    const out: Record<string, unknown> = {};
    for (const f of filas) if (usar[f.campo]) out[f.campo] = propuesta[f.campo];
    onAplicar(out as FichaExtraida);
  };

  const cuantos = filas.filter((f) => usar[f.campo]).length;

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCancelar()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Revisar lo que se entendió</DialogTitle>
          <DialogDescription>
            Elige qué queda en cada campo. Nada se guarda hasta que lo apliques.
          </DialogDescription>
        </DialogHeader>

        {filas.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No se sacó información utilizable de lo respondido.
          </p>
        ) : (
          <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
            {filas.map((f) => (
              <div key={f.campo} className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-medium">
                  {CAMPO_LABEL[f.campo]}
                  {TIPO_CAMPO[f.campo] !== "texto" && (
                    <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                      ({TIPO_CAMPO[f.campo]})
                    </span>
                  )}
                </p>

                <div className="grid gap-2 sm:grid-cols-2">
                  <label
                    className={`cursor-pointer rounded-md border p-2 text-xs transition ${
                      !usar[f.campo] ? "border-primary bg-primary/5" : "border-muted"
                    }`}
                  >
                    <span className="mb-1 flex items-center gap-1.5 font-medium">
                      <input
                        type="radio"
                        name={`campo-${f.campo}`}
                        checked={!usar[f.campo]}
                        onChange={() => setUsar((u) => ({ ...u, [f.campo]: false }))}
                      />
                      Conservar lo actual
                    </span>
                    <span className="block text-muted-foreground">
                      {f.actual || <em>(vacío)</em>}
                    </span>
                  </label>

                  <label
                    className={`cursor-pointer rounded-md border p-2 text-xs transition ${
                      usar[f.campo] ? "border-primary bg-primary/5" : "border-muted"
                    }`}
                  >
                    <span className="mb-1 flex items-center gap-1.5 font-medium">
                      <input
                        type="radio"
                        name={`campo-${f.campo}`}
                        checked={Boolean(usar[f.campo])}
                        onChange={() => setUsar((u) => ({ ...u, [f.campo]: true }))}
                      />
                      Usar lo dictado
                    </span>
                    <span className="block">{f.propuesto}</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t pt-3">
          <Button variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button onClick={aplicar} disabled={filas.length === 0}>
            <Check className="mr-1.5 size-4" />
            Aplicar {cuantos} campo{cuantos === 1 ? "" : "s"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
