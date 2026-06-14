"use client";

import { useState, useTransition } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CheckCircle2, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  citizenRegisterSchema,
  publicSolicitudSchema,
  territorialProposalSchema,
  LOCALIDADES,
  REQUEST_CATEGORIES,
  REQUEST_CATEGORY_LABELS,
  type CitizenRegisterInput,
  type PublicSolicitudInput,
  type RequestCategory,
  type TerritorialProposalInput,
} from "@/lib/validations";
import { registerCitizen } from "@/actions/ciudadanos";
import {
  createPublicRequest,
  submitTerritorialProposal,
} from "@/actions/solicitudes";

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs font-medium text-destructive">{msg}</p>;
}

function Consent({
  registration,
  error,
}: {
  registration: UseFormRegisterReturn;
  error?: string;
}) {
  return (
    <div>
      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          className="mt-0.5 size-4 rounded border-input"
          {...registration}
        />
        <span>
          Autorizo el tratamiento de mis datos personales conforme a la{" "}
          <a href="/politica-datos" className="text-primary underline">
            política de tratamiento de datos
          </a>{" "}
          (Ley 1581 de 2012). Podré solicitar su consulta, actualización o
          supresión.
        </span>
      </label>
      <FieldError msg={error} />
    </div>
  );
}

function RadicadoOk({ radicado, onReset }: { radicado: string; onReset: () => void }) {
  return (
    <Card className="border-emerald-200 bg-emerald-50">
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        <CheckCircle2 className="size-12 text-emerald-600" />
        <h3 className="text-lg font-semibold text-emerald-900">¡Solicitud radicada!</h3>
        <p className="text-sm text-emerald-800">Guarda tu código de seguimiento:</p>
        <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 py-2 font-mono text-lg font-bold text-emerald-900">
          {radicado}
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(radicado);
              toast.success("Código copiado");
            }}
            aria-label="Copiar código"
          >
            <Copy className="size-4" />
          </button>
        </div>
        <Button variant="outline" onClick={onReset}>
          Enviar otra
        </Button>
      </CardContent>
    </Card>
  );
}

/* ───────────────── Registro ciudadano ───────────────── */
function RegistroForm() {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const { register, handleSubmit, setValue, reset, formState } =
    useForm<CitizenRegisterInput>({
      resolver: zodResolver(citizenRegisterSchema),
    });

  if (done)
    return (
      <Card className="border-emerald-200 bg-emerald-50">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <CheckCircle2 className="size-12 text-emerald-600" />
          <h3 className="text-lg font-semibold text-emerald-900">¡Gracias por sumarte!</h3>
          <p className="text-sm text-emerald-800">Te mantendremos al tanto de las novedades.</p>
          <Button variant="outline" onClick={() => { reset(); setDone(false); }}>
            Registrar otra persona
          </Button>
        </CardContent>
      </Card>
    );

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={handleSubmit((values) =>
        start(async () => {
          const res = await registerCitizen(values);
          if (res.ok) { toast.success(res.message); setDone(true); }
          else toast.error(res.message);
        }),
      )}
    >
      <div>
        <Label htmlFor="r-nombre">Nombre *</Label>
        <Input id="r-nombre" {...register("nombre")} />
        <FieldError msg={formState.errors.nombre?.message} />
      </div>
      <div>
        <Label htmlFor="r-apellido">Apellido</Label>
        <Input id="r-apellido" {...register("apellido")} />
      </div>
      <div>
        <Label htmlFor="r-email">Correo</Label>
        <Input id="r-email" type="email" {...register("email")} />
        <FieldError msg={formState.errors.email?.message} />
      </div>
      <div>
        <Label htmlFor="r-tel">WhatsApp / Teléfono</Label>
        <Input id="r-tel" {...register("whatsapp")} />
      </div>
      <div>
        <Label>Localidad</Label>
        <Select onValueChange={(v) => setValue("localidad", v as CitizenRegisterInput["localidad"])}>
          <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
          <SelectContent>
            {LOCALIDADES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="r-barrio">Barrio</Label>
        <Input id="r-barrio" {...register("barrio")} />
      </div>
      <div className="sm:col-span-2">
        <Consent registration={register("consentimiento_datos")} error={formState.errors.consentimiento_datos?.message} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending} size="lg" className="w-full sm:w-auto">
          {pending ? "Enviando…" : "Unirme a la comunidad"}
        </Button>
      </div>
    </form>
  );
}

/* ───────────────── Solicitud categorizada (BASE SOLICITUDES) ───────────────── */
const CATEGORY_HINT: Record<RequestCategory, string> = {
  salud: "Casos de salud: citas, autorizaciones, medicamentos, EPS.",
  entidad: "Trámites ante una entidad (acueducto, energía, alcaldía…).",
  hoja_vida: "Recepción de hojas de vida y oportunidades laborales.",
  peticion_general: "Donaciones, apoyos, solicitudes a la organización.",
  apunte: "Pendientes y notas rápidas para gestionar luego.",
};

function SolicitudForm() {
  const [pending, start] = useTransition();
  const [radicado, setRadicado] = useState<string | null>(null);
  const { register, handleSubmit, setValue, watch, reset, formState } =
    useForm<PublicSolicitudInput>({ resolver: zodResolver(publicSolicitudSchema) });

  const categoria = watch("categoria");

  if (radicado) return <RadicadoOk radicado={radicado} onReset={() => { reset(); setRadicado(null); }} />;

  const showSalud = categoria === "salud";
  const showHV = categoria === "hoja_vida";
  const showEntidad = categoria === "entidad";
  const showOrg = categoria === "peticion_general" || categoria === "apunte";

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={handleSubmit((values) =>
        start(async () => {
          const res = await createPublicRequest(values);
          if (res.ok && res.data) { toast.success(res.message); setRadicado(res.data.radicado); }
          else toast.error(res.message);
        }),
      )}
    >
      <div className="sm:col-span-2">
        <Label>Tipo de solicitud *</Label>
        <Select onValueChange={(v) => setValue("categoria", v as RequestCategory, { shouldValidate: true })}>
          <SelectTrigger><SelectValue placeholder="¿Qué necesitas gestionar?" /></SelectTrigger>
          <SelectContent>
            {REQUEST_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{REQUEST_CATEGORY_LABELS[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {categoria && (
          <p className="mt-1 text-xs text-muted-foreground">{CATEGORY_HINT[categoria]}</p>
        )}
        <FieldError msg={formState.errors.categoria?.message} />
      </div>

      <div>
        <Label htmlFor="s-nombre">Nombre de la persona *</Label>
        <Input id="s-nombre" {...register("nombre")} />
        <FieldError msg={formState.errors.nombre?.message} />
      </div>
      <div>
        <Label htmlFor="s-doc">Documento</Label>
        <Input id="s-doc" {...register("documento")} />
      </div>
      <div>
        <Label htmlFor="s-tel">Teléfono</Label>
        <Input id="s-tel" {...register("telefono")} />
        <FieldError msg={formState.errors.telefono?.message} />
      </div>
      <div>
        <Label htmlFor="s-email">Correo</Label>
        <Input id="s-email" type="email" {...register("email")} />
        <FieldError msg={formState.errors.email?.message} />
      </div>
      <div>
        <Label>Localidad</Label>
        <Select onValueChange={(v) => setValue("localidad", v as PublicSolicitudInput["localidad"])}>
          <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
          <SelectContent>
            {LOCALIDADES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="s-barrio">Barrio</Label>
        <Input id="s-barrio" {...register("barrio")} />
      </div>

      {/* Campos específicos por categoría */}
      {showSalud && (
        <>
          <div>
            <Label htmlFor="s-edad">Edad</Label>
            <Input id="s-edad" type="number" {...register("edad")} />
          </div>
          <div>
            <Label htmlFor="s-eps">EPS</Label>
            <Input id="s-eps" {...register("eps")} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="s-diag">Diagnóstico (si aplica)</Label>
            <Input id="s-diag" {...register("diagnostico")} />
          </div>
        </>
      )}
      {showHV && (
        <>
          <div>
            <Label htmlFor="s-nivel">Nivel académico</Label>
            <Input id="s-nivel" placeholder="Bachiller, técnico, profesional…" {...register("nivel_academico")} />
          </div>
          <div>
            <Label htmlFor="s-perfil">Perfil / cargo</Label>
            <Input id="s-perfil" {...register("perfil")} />
          </div>
        </>
      )}
      {showEntidad && (
        <div className="sm:col-span-2">
          <Label htmlFor="s-entidad">Entidad</Label>
          <Input id="s-entidad" placeholder="Acueducto, Codensa, Secretaría…" {...register("entidad")} />
        </div>
      )}
      {showOrg && (
        <div className="sm:col-span-2">
          <Label htmlFor="s-org">Organización (si aplica)</Label>
          <Input id="s-org" {...register("organizacion")} />
        </div>
      )}

      <div className="sm:col-span-2">
        <Label htmlFor="s-asunto">Asunto breve</Label>
        <Input id="s-asunto" placeholder="Resumen en una línea (opcional)" {...register("asunto")} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="s-desc">Describe la solicitud con detalle *</Label>
        <Textarea id="s-desc" rows={5} {...register("descripcion")} />
        <FieldError msg={formState.errors.descripcion?.message} />
      </div>
      <div className="sm:col-span-2">
        <Consent registration={register("consentimiento_datos")} error={formState.errors.consentimiento_datos?.message} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending} size="lg" className="w-full sm:w-auto">
          {pending ? "Radicando…" : "Radicar solicitud"}
        </Button>
      </div>
    </form>
  );
}

/* ───────────────── Propuesta territorial ───────────────── */
function PropuestaForm() {
  const [pending, start] = useTransition();
  const [radicado, setRadicado] = useState<string | null>(null);
  const { register, handleSubmit, setValue, reset, formState } =
    useForm<TerritorialProposalInput>({ resolver: zodResolver(territorialProposalSchema) });

  if (radicado) return <RadicadoOk radicado={radicado} onReset={() => { reset(); setRadicado(null); }} />;

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={handleSubmit((values) =>
        start(async () => {
          const res = await submitTerritorialProposal(values);
          if (res.ok && res.data) { toast.success(res.message); setRadicado(res.data.radicado); }
          else toast.error(res.message);
        }),
      )}
    >
      <div>
        <Label htmlFor="p-nombre">Nombre *</Label>
        <Input id="p-nombre" {...register("nombre")} />
        <FieldError msg={formState.errors.nombre?.message} />
      </div>
      <div>
        <Label>Localidad *</Label>
        <Select onValueChange={(v) => setValue("localidad", v as TerritorialProposalInput["localidad"])}>
          <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
          <SelectContent>
            {LOCALIDADES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <FieldError msg={formState.errors.localidad?.message} />
      </div>
      <div>
        <Label htmlFor="p-barrio">Barrio</Label>
        <Input id="p-barrio" {...register("barrio")} />
      </div>
      <div>
        <Label htmlFor="p-tema">Tema *</Label>
        <Input id="p-tema" placeholder="Movilidad, ambiente, seguridad…" {...register("tema")} />
        <FieldError msg={formState.errors.tema?.message} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="p-prop">Tu propuesta *</Label>
        <Textarea id="p-prop" rows={4} {...register("propuesta")} />
        <FieldError msg={formState.errors.propuesta?.message} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="p-impacto">Impacto esperado</Label>
        <Textarea id="p-impacto" rows={2} {...register("impacto_esperado")} />
      </div>
      <div className="sm:col-span-2">
        <Consent registration={register("consentimiento_datos")} error={formState.errors.consentimiento_datos?.message} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending} size="lg" className="w-full sm:w-auto">
          {pending ? "Enviando…" : "Enviar propuesta"}
        </Button>
      </div>
    </form>
  );
}

export function ParticipaForms() {
  return (
    <Tabs defaultValue="solicitud" className="w-full">
      <TabsList>
        <TabsTrigger value="solicitud">Solicitud</TabsTrigger>
        <TabsTrigger value="propuesta">Propuesta para mi barrio</TabsTrigger>
        <TabsTrigger value="registro">Unirme a la comunidad</TabsTrigger>
      </TabsList>
      <TabsContent value="solicitud"><SolicitudForm /></TabsContent>
      <TabsContent value="propuesta" id="propuesta"><PropuestaForm /></TabsContent>
      <TabsContent value="registro"><RegistroForm /></TabsContent>
    </Tabs>
  );
}
