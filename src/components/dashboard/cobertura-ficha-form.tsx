"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ClipboardCopy, Loader2, Mic, Pencil, Save, Sparkles, X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Field, describeFieldErrors, useFieldErrors } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CoberturaAsistentes } from "@/components/dashboard/cobertura-asistentes";
import { CoberturaCuestionario } from "@/components/dashboard/cobertura-cuestionario";
import { CoberturaExtraccionReview } from "@/components/dashboard/cobertura-extraccion-review";
import {
  type FichaExtraida, type Pregunta, type Respuesta,
} from "@/lib/cuestionario-shared";
import { type PersonaResuelta } from "@/lib/personas-match";
import { type ResultadoDictado } from "@/actions/cuestionario";
import {
  getBriefCobertura, updateCoberturaFicha,
  type Asistente, type Cobertura, type PersonaVinculable,
} from "@/actions/coberturas";

/** Clave del traspaso al chat: el brief no viaja por la URL (ver abajo). */
const CLAVE_PROMPT = "ia:prompt";

interface Datos {
  nombre: string;
  descripcion: string;
  fecha: string;
  lugar: string;
  objetivo: string;
  resumen: string;
  mensajes_clave: string;
  temas: string;
  resultados: string;
  compromisos: string;
  aliados: string;
  publico_estimado: string;
  hashtags: string;
}

const desde = (c: Cobertura): Datos => ({
  nombre: c.nombre,
  descripcion: c.descripcion ?? "",
  fecha: c.fecha ?? "",
  lugar: c.lugar ?? "",
  objetivo: c.objetivo ?? "",
  resumen: c.resumen ?? "",
  mensajes_clave: c.mensajes_clave ?? "",
  temas: (c.temas ?? []).join(", "),
  resultados: c.resultados ?? "",
  compromisos: c.compromisos ?? "",
  aliados: c.aliados ?? "",
  publico_estimado: c.publico_estimado != null ? String(c.publico_estimado) : "",
  hashtags: (c.hashtags ?? []).join(", "),
});

/* ───────────────────────────── Vista de lectura ───────────────────────────── */

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  if (!valor?.trim()) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{etiqueta}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-sm">{valor.trim()}</dd>
    </div>
  );
}

function Lectura({ c }: { c: Cobertura }) {
  const tieneAlgo =
    c.objetivo || c.resumen || c.mensajes_clave || c.resultados ||
    c.compromisos || c.aliados || c.publico_estimado || c.temas?.length || c.hashtags?.length;

  if (!tieneAlgo) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay datos de la jornada. Escríbelos para que la IA pueda redactar con contexto.
      </p>
    );
  }

  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <Dato etiqueta="Objetivo" valor={c.objetivo} />
      <Dato etiqueta="Qué se hizo" valor={c.resumen} />
      <Dato etiqueta="Mensajes clave" valor={c.mensajes_clave} />
      <Dato etiqueta="Temas" valor={c.temas?.join(", ")} />
      <Dato etiqueta="Resultados" valor={c.resultados} />
      <Dato etiqueta="Compromisos" valor={c.compromisos} />
      <Dato etiqueta="Aliados" valor={c.aliados} />
      <Dato etiqueta="Público estimado" valor={c.publico_estimado ? `${c.publico_estimado} personas` : null} />
      <Dato etiqueta="Hashtags" valor={c.hashtags?.join(", ")} />
    </dl>
  );
}

/* ─────────────────────────────── Componente ─────────────────────────────── */

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <details open className="rounded-lg border bg-muted/20">
      <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">{titulo}</summary>
      <div className="grid gap-3 px-3 pb-3 sm:grid-cols-2">{children}</div>
    </details>
  );
}

export function CoberturaFicha({
  cobertura: inicial,
  asistentes,
  personas,
  preguntas,
  respuestas,
}: {
  cobertura: Cobertura;
  asistentes: Asistente[];
  personas: PersonaVinculable[];
  preguntas: Pregunta[];
  respuestas: Respuesta[];
}) {
  const router = useRouter();
  const fe = useFieldErrors();
  const [, start] = useTransition();

  const [cobertura, setCobertura] = useState(inicial);
  const [editando, setEditando] = useState(false);
  const [datos, setDatos] = useState<Datos>(() => desde(inicial));
  const [guardando, setGuardando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [briefManual, setBriefManual] = useState<string | null>(null);

  /* ── Cuestionario por voz ── */
  const params = useSearchParams();
  const [cuestionario, setCuestionario] = useState(false);
  const [propuesta, setPropuesta] = useState<FichaExtraida | null>(null);
  const [personasDichas, setPersonasDichas] = useState<PersonaResuelta[]>([]);

  // Al crear una cobertura «dictando» se llega con ?cuestionario=1: así crear y
  // editar comparten el mismo punto de entrada y no hay que sostener audio en
  // memoria mientras la cobertura todavía no existe.
  useEffect(() => {
    if (params.get("cuestionario") === "1") {
      setCuestionario(true);
      setEditando(true);
      router.replace(`/dashboard/comunicaciones/coberturas/${inicial.id}`, { scroll: false });
    }
  }, [params, router, inicial.id]);

  const respondidas = respuestas.filter((r) => r.transcripcion.trim()).length;

  /** Vuelca a los campos del formulario lo que se eligió en la revisión. */
  const aplicarPropuesta = (elegidos: FichaExtraida) => {
    setDatos((d) => {
      const out = { ...d };
      for (const [campo, valor] of Object.entries(elegidos)) {
        if (valor === undefined || valor === null) continue;
        // Los campos de lista y número viven como texto en el formulario.
        (out as Record<string, string>)[campo] = Array.isArray(valor)
          ? valor.join(", ")
          : String(valor);
      }
      return out;
    });
    setPropuesta(null);
    setEditando(true);
    toast.success("Listo. Revisa y guarda la ficha.");
  };

  const set = (campo: keyof Datos, valor: string) => {
    setDatos((d) => ({ ...d, [campo]: valor }));
    fe.clear(campo);
  };

  const guardar = () =>
    start(async () => {
      setGuardando(true);
      const res = await updateCoberturaFicha(cobertura.id, {
        nombre: datos.nombre,
        descripcion: datos.descripcion,
        fecha: datos.fecha,
        lugar: datos.lugar,
        objetivo: datos.objetivo,
        resumen: datos.resumen,
        mensajes_clave: datos.mensajes_clave,
        temas: datos.temas.split(",").map((t) => t.trim()).filter(Boolean),
        resultados: datos.resultados,
        compromisos: datos.compromisos,
        aliados: datos.aliados,
        publico_estimado: datos.publico_estimado.trim() ? Number(datos.publico_estimado) : null,
        hashtags: datos.hashtags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      setGuardando(false);
      if (res.ok && res.data) {
        setCobertura(res.data);
        setDatos(desde(res.data));
        setEditando(false);
        toast.success(res.message);
        router.refresh();
      } else {
        fe.fromResult(res);
        toast.error(describeFieldErrors(res) ?? res.message);
      }
    });

  /** Pide el brief al servidor; devuelve null si falla (ya avisó). */
  const pedirBrief = async (): Promise<string | null> => {
    setGenerando(true);
    const res = await getBriefCobertura(cobertura.id);
    setGenerando(false);
    if (!res.ok || !res.data) {
      toast.error(res.ok ? "No se pudo generar el resumen." : res.message);
      return null;
    }
    return res.data.texto;
  };

  const copiar = async () => {
    const texto = await pedirBrief();
    if (!texto) return;
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Prompt copiado al portapapeles.");
    } catch {
      // Algunos navegadores bloquean el portapapeles fuera de un gesto directo:
      // se muestra el texto para copiarlo a mano en vez de perderlo.
      setBriefManual(texto);
    }
  };

  const llevarAlChat = async () => {
    const texto = await pedirBrief();
    if (!texto) return;
    try {
      // El brief lleva nombres de asistentes y puede pasar de varios miles de
      // caracteres. Por la URL quedaría en el historial y en los registros del
      // servidor, así que viaja por sessionStorage.
      sessionStorage.setItem(CLAVE_PROMPT, texto);
      router.push("/dashboard/ia?prompt=sesion");
    } catch {
      toast.warning("Se envió una versión recortada del resumen al chat.");
      router.push(`/dashboard/ia?prompt=${encodeURIComponent(texto.slice(0, 1500))}`);
    }
  };

  return (
    <>
      <CoberturaCuestionario
        abierto={cuestionario}
        coberturaId={inicial.id}
        preguntas={preguntas}
        respuestasIniciales={respuestas}
        onCerrar={() => setCuestionario(false)}
        onExtraido={(res: ResultadoDictado) => {
          setCuestionario(false);
          setPropuesta(res.ficha);
          setPersonasDichas(res.personas);
        }}
      />

      <CoberturaExtraccionReview
        abierto={propuesta !== null}
        propuesta={propuesta ?? {}}
        actuales={datos as unknown as Record<string, unknown>}
        personas={personasDichas}
        coberturaId={inicial.id}
        onCancelar={() => setPropuesta(null)}
        onAplicar={aplicarPropuesta}
      />

      <Card className="mb-4">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Datos de la cobertura</h2>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setCuestionario(true)}>
                <Mic className="size-4" />
                {respondidas > 0
                  ? `Cuestionario · ${respondidas} de ${preguntas.length}`
                  : "Responder hablando"}
              </Button>
              <Button variant="outline" size="sm" onClick={copiar} disabled={generando}>
                {generando ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCopy className="size-4" />}
                Copiar prompt
              </Button>
              <Button size="sm" onClick={llevarAlChat} disabled={generando}>
                <Sparkles className="size-4" /> Abrir en el chat IA
              </Button>
              {!editando && (
                <Button variant="ghost" size="sm" onClick={() => setEditando(true)}>
                  <Pencil className="size-4" /> Editar
                </Button>
              )}
            </div>
          </div>

          {editando ? (
            <div className="space-y-3" ref={fe.containerRef}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nombre" required {...fe.field("nombre")}>
                  <Input value={datos.nombre} onChange={(e) => set("nombre", e.target.value)} />
                </Field>
                <Field label="Lugar">
                  <Input
                    value={datos.lugar}
                    onChange={(e) => set("lugar", e.target.value)}
                    placeholder="Barrio, localidad, sede…"
                  />
                </Field>
                <Field label="Fecha">
                  <Input type="date" value={datos.fecha} onChange={(e) => set("fecha", e.target.value)} />
                </Field>
                <Field label="De qué se trata">
                  <Textarea rows={2} value={datos.descripcion} onChange={(e) => set("descripcion", e.target.value)} />
                </Field>
              </div>

              <Bloque titulo="Qué se hizo">
                <Field label="Objetivo" hint="Para qué se convocó.">
                  <Textarea rows={3} value={datos.objetivo} onChange={(e) => set("objetivo", e.target.value)} />
                </Field>
                <Field label="Qué ocurrió" hint="La bitácora de la jornada.">
                  <Textarea rows={3} value={datos.resumen} onChange={(e) => set("resumen", e.target.value)} />
                </Field>
              </Bloque>

              <Bloque titulo="Mensaje">
                <Field label="Mensajes clave" hint="Uno por línea.">
                  <Textarea
                    rows={3}
                    value={datos.mensajes_clave}
                    onChange={(e) => set("mensajes_clave", e.target.value)}
                  />
                </Field>
                <Field label="Temas" hint="Separados por comas.">
                  <Input
                    value={datos.temas}
                    onChange={(e) => set("temas", e.target.value)}
                    placeholder="movilidad, espacio público"
                  />
                </Field>
              </Bloque>

              <Bloque titulo="Cierre">
                <Field label="Resultados">
                  <Textarea rows={3} value={datos.resultados} onChange={(e) => set("resultados", e.target.value)} />
                </Field>
                <Field label="Compromisos">
                  <Textarea rows={3} value={datos.compromisos} onChange={(e) => set("compromisos", e.target.value)} />
                </Field>
              </Bloque>

              <Bloque titulo="Contexto">
                <Field label="Aliados y organizaciones">
                  <Input value={datos.aliados} onChange={(e) => set("aliados", e.target.value)} />
                </Field>
                <Field label="Público estimado" {...fe.field("publico_estimado")}>
                  <Input
                    type="number"
                    min={0}
                    value={datos.publico_estimado}
                    onChange={(e) => set("publico_estimado", e.target.value)}
                    placeholder="Personas"
                  />
                </Field>
                <Field label="Hashtags" hint="Separados por comas." className="sm:col-span-2">
                  <Input
                    value={datos.hashtags}
                    onChange={(e) => set("hashtags", e.target.value)}
                    placeholder="#Kennedy, #Movilidad"
                  />
                </Field>
              </Bloque>

              <div className="flex gap-2">
                <Button onClick={guardar} disabled={guardando}>
                  {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Guardar ficha
                </Button>
                <Button
                  variant="ghost"
                  disabled={guardando}
                  onClick={() => { setDatos(desde(cobertura)); fe.clear(); setEditando(false); }}
                >
                  <X className="size-4" /> Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Lectura c={cobertura} />
          )}

          <div className="border-t pt-4">
            <h3 className="mb-2 text-sm font-semibold">Quiénes estuvieron</h3>
            <CoberturaAsistentes
              coberturaId={cobertura.id}
              asistentes={asistentes}
              personas={personas}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={briefManual !== null} onOpenChange={(o) => !o && setBriefManual(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Copia el prompt a mano</DialogTitle>
            <DialogDescription>
              El navegador bloqueó el portapapeles. Selecciona el texto y cópialo.
            </DialogDescription>
          </DialogHeader>
          <Textarea readOnly rows={16} value={briefManual ?? ""} className="font-mono text-xs" />
        </DialogContent>
      </Dialog>
    </>
  );
}
