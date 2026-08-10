"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  CAMPOS_PREGUNTA, CAMPO_LABEL, TIPO_CAMPO,
  type CampoPregunta, type FichaExtraida,
} from "@/lib/cuestionario-shared";
import { type PersonaResuelta, type Vinculo } from "@/lib/personas-match";
import { agregarAsistentesDictados } from "@/actions/cuestionario";

const VINCULO_LABEL: Record<Vinculo, string> = {
  equipo: "Del equipo",
  aliado: "Aliado",
  otro: "Otro",
};

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
  personas,
  coberturaId,
  onCancelar,
  onAplicar,
}: {
  abierto: boolean;
  propuesta: FichaExtraida;
  /** Lo que hay hoy en el formulario, por campo. */
  actuales: Partial<Record<CampoPregunta, unknown>>;
  /** Personas nombradas en el dictado, ya emparejadas con la plataforma. */
  personas: PersonaResuelta[];
  coberturaId: string;
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
  /** true = sumar esta persona a quiénes estuvieron. */
  const [sumar, setSumar] = useState<Record<string, boolean>>({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setUsar(Object.fromEntries(filas.map((f) => [f.campo, f.actual.trim() === ""])));
    // Las personas vienen marcadas: quien se nombró estuvo. Desmarcar es la
    // excepción, no la regla.
    setSumar(Object.fromEntries(personas.map((p) => [p.nombre, true])));
  }, [abierto, filas, personas]);

  const aplicar = async () => {
    const elegidas = personas.filter((p) => sumar[p.nombre]);
    if (elegidas.length > 0) {
      setGuardando(true);
      const res = await agregarAsistentesDictados(coberturaId, elegidas);
      setGuardando(false);
      if (!res.ok) toast.error(res.message);
    }
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

        {personas.length > 0 && (
          <div className="rounded-lg border p-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <UserPlus className="size-4" />
              Personas nombradas ({personas.filter((p) => sumar[p.nombre]).length} de{" "}
              {personas.length})
            </p>
            <p className="mb-2 text-xs text-muted-foreground">
              Se suman a «quiénes estuvieron». Las que ya están en la plataforma quedan
              vinculadas a su ficha.
            </p>
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {personas.map((p) => (
                <li key={p.nombre}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={Boolean(sumar[p.nombre])}
                      onChange={(e) =>
                        setSumar((v) => ({ ...v, [p.nombre]: e.target.checked }))
                      }
                    />
                    <span className="font-medium">{p.nombre}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                      {VINCULO_LABEL[p.vinculo]}
                    </span>
                    {p.rol && <span className="text-muted-foreground">{p.rol}</span>}
                    {p.organizacion && (
                      <span className="text-muted-foreground">· {p.organizacion}</span>
                    )}
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                      {p.match ? `vincula con ${p.match.tipo}` : "nueva"}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t pt-3">
          <Button variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button onClick={aplicar} disabled={guardando || (filas.length === 0 && personas.length === 0)}>
            <Check className="mr-1.5 size-4" />
            {guardando ? "Guardando…" : `Aplicar ${cuantos} campo${cuantos === 1 ? "" : "s"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
