"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronDown, ChevronUp, Pencil, Plus, TriangleAlert, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CAMPOS_PREGUNTA, CAMPO_LABEL, MOMENTOS,
  type CampoPregunta, type Momento, type Pregunta,
} from "@/lib/cuestionario-shared";
import {
  createPregunta, moverPregunta, togglePregunta, updatePregunta,
} from "@/actions/preguntas";

const MOMENTO_LABEL: Record<Momento, string> = {
  siempre: "Siempre",
  posterior: "Solo después del evento",
};

interface Borrador {
  pregunta: string;
  ayuda: string;
  campo: CampoPregunta;
  momento: Momento;
  orden: number;
  activa: boolean;
}

const VACIO: Borrador = {
  pregunta: "",
  ayuda: "",
  campo: "resumen",
  momento: "posterior",
  orden: 0,
  activa: true,
};

const desde = (p: Pregunta): Borrador => ({
  pregunta: p.pregunta,
  ayuda: p.ayuda ?? "",
  campo: p.campo,
  momento: p.momento,
  orden: p.orden,
  activa: p.activa,
});

/**
 * Los dos selectores que comparten el alta y la edición.
 *
 * Fuera del componente a propósito: definida dentro del render, React la trata
 * como un tipo nuevo en cada pasada, remonta los <select> y estos pierden el
 * foco en cuanto se cambia cualquier campo del formulario.
 */
function Campos({
  valor,
  onCambio,
}: {
  valor: Borrador;
  onCambio: (b: Borrador) => void;
}) {
  return (
    <>
      <select
        value={valor.campo}
        onChange={(e) => onCambio({ ...valor, campo: e.target.value as CampoPregunta })}
        aria-label="Campo que llena"
        className="h-9 rounded-md border bg-background px-2 text-sm"
      >
        {CAMPOS_PREGUNTA.map((c) => (
          <option key={c} value={c}>
            {CAMPO_LABEL[c]}
          </option>
        ))}
      </select>
      <select
        value={valor.momento}
        onChange={(e) => onCambio({ ...valor, momento: e.target.value as Momento })}
        aria-label="Cuándo aplica"
        className="h-9 rounded-md border bg-background px-2 text-sm"
      >
        {MOMENTOS.map((m) => (
          <option key={m} value={m}>
            {MOMENTO_LABEL[m]}
          </option>
        ))}
      </select>
    </>
  );
}

/**
 * Catálogo de preguntas del cuestionario por voz.
 *
 * Lo que se edita aquí es el GUION que ve quien graba: qué se le recuerda
 * mencionar y en qué orden. El campo destino es lo que amarra cada respuesta a
 * su casilla de la ficha; sin él la IA no sabría dónde ponerla.
 */
export function PreguntasManager({ preguntas }: { preguntas: Pregunta[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [nueva, setNueva] = useState<Borrador>(VACIO);
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<Borrador>(VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const refrescar = () => start(() => router.refresh());

  const correr = (
    accion: () => Promise<{ ok: boolean; message: string; fieldErrors?: Record<string, string> }>,
    alTerminar?: () => void,
  ) =>
    start(async () => {
      setErrores({});
      const res = await accion();
      if (res.ok) {
        alTerminar?.();
        toast.success(res.message);
        refrescar();
      } else {
        setErrores(res.fieldErrors ?? {});
        if (!res.fieldErrors) toast.error(res.message);
      }
    });

  /** Campos de la ficha que ninguna pregunta activa está cubriendo. */
  const sinCubrir = CAMPOS_PREGUNTA.filter(
    (c) => !preguntas.some((p) => p.activa && p.campo === c),
  );

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h3 className="text-sm font-semibold">Preguntas del cuestionario por voz</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Es el guion que ve quien graba la jornada. Cada pregunta apunta al campo de la ficha
            que llena, y dice si tiene sentido antes del evento o solo después.
          </p>
        </div>

        {sinCubrir.length > 0 && (
          <p className="flex items-start gap-1.5 rounded-md border border-amber-300/60 bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Sin ninguna pregunta activa, estos campos nunca se llenarán hablando:{" "}
              <strong>{sinCubrir.map((c) => CAMPO_LABEL[c]).join(", ")}</strong>.
            </span>
          </p>
        )}

        {/* Alta */}
        <div className="flex flex-wrap items-start gap-2 rounded-lg border border-dashed p-3">
          <div className="min-w-[14rem] flex-1">
            <Input
              value={nueva.pregunta}
              onChange={(e) => setNueva((n) => ({ ...n, pregunta: e.target.value }))}
              placeholder="¿Qué compromisos quedaron?"
              aria-label="Pregunta"
              aria-invalid={Boolean(errores.pregunta)}
            />
            {errores.pregunta && (
              <p className="mt-1 text-[11px] text-destructive">{errores.pregunta}</p>
            )}
            <Input
              value={nueva.ayuda}
              onChange={(e) => setNueva((n) => ({ ...n, ayuda: e.target.value }))}
              placeholder="Ayuda opcional: acuerdos concretos, con quién y para cuándo."
              aria-label="Texto de ayuda"
              className="mt-2"
            />
          </div>
          <Campos valor={nueva} onCambio={setNueva} />
          <Button
            onClick={() => correr(() => createPregunta(nueva), () => setNueva(VACIO))}
            disabled={nueva.pregunta.trim().length < 5}
          >
            <Plus className="mr-1 size-4" /> Agregar
          </Button>
        </div>

        {/* Listado */}
        {preguntas.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No hay preguntas. El cuestionario por voz no tendrá guion.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {preguntas.map((p, i) => (
              <li key={p.id} className="px-3 py-2">
                {editando === p.id ? (
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-[14rem] flex-1">
                      <Input
                        value={borrador.pregunta}
                        onChange={(e) => setBorrador((b) => ({ ...b, pregunta: e.target.value }))}
                        aria-label={`Pregunta ${i + 1}`}
                        aria-invalid={Boolean(errores.pregunta)}
                      />
                      {errores.pregunta && (
                        <p className="mt-1 text-[11px] text-destructive">{errores.pregunta}</p>
                      )}
                      <Input
                        value={borrador.ayuda}
                        onChange={(e) => setBorrador((b) => ({ ...b, ayuda: e.target.value }))}
                        placeholder="Ayuda opcional"
                        aria-label="Texto de ayuda"
                        className="mt-2"
                      />
                    </div>
                    <Campos valor={borrador} onCambio={setBorrador} />
                    <Button
                      size="sm"
                      onClick={() =>
                        correr(() => updatePregunta(p.id, borrador), () => setEditando(null))
                      }
                    >
                      <Check className="size-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex shrink-0 flex-col">
                      <button
                        onClick={() => correr(() => moverPregunta(p.id, -1))}
                        disabled={i === 0}
                        aria-label="Subir"
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <ChevronUp className="size-3.5" />
                      </button>
                      <button
                        onClick={() => correr(() => moverPregunta(p.id, 1))}
                        disabled={i === preguntas.length - 1}
                        aria-label="Bajar"
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <ChevronDown className="size-3.5" />
                      </button>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${p.activa ? "" : "text-muted-foreground line-through"}`}>
                        {p.pregunta}
                      </p>
                      {p.ayuda && (
                        <p className="truncate text-[11px] text-muted-foreground">{p.ayuda}</p>
                      )}
                    </div>

                    <Badge variant="secondary">{CAMPO_LABEL[p.campo]}</Badge>
                    {p.momento === "posterior" && <Badge variant="muted">tras el evento</Badge>}

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setErrores({});
                        setEditando(p.id);
                        setBorrador(desde(p));
                      }}
                      aria-label={`Editar «${p.pregunta}»`}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-muted-foreground"
                      onClick={() => correr(() => togglePregunta(p.id, !p.activa))}
                    >
                      {p.activa ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="text-[11px] text-muted-foreground">
          Las preguntas no se borran, se desactivan: borrarlas arrastraría por cascada las
          respuestas ya grabadas en cada cobertura.
        </p>
      </CardContent>
    </Card>
  );
}
