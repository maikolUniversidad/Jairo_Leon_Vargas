"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Field, type useFieldErrors } from "@/components/ui/field";
import { normalizeName } from "@/lib/geo-sources";
import { LOCALIDADES, looksLikeEmail } from "@/lib/validations";
import {
  CONTACT_TIPOS, CONTACT_TIPO_LABELS, ZONE_TYPES, ZONE_TYPE_LABELS, type ZoneType,
} from "@/types/database";
import { ensureZone } from "@/actions/territorio";

export interface ZoneOpt { id: string; nombre_zona: string; tipo_zona?: ZoneType | null }

/** Forma del estado del formulario de contacto. Todo string para el DOM. */
export interface ContactFormState {
  nombre: string; apellido: string; puesto: string; organizacion: string;
  tipo: string; influencia: string; telefono: string; whatsapp: string;
  email: string; localidad: string; barrio: string; direccion: string;
  zona_id: string; notas: string;
  telefono_2: string; email_2: string;
  facebook: string; instagram: string; x_twitter: string; tiktok: string;
  sitio_web: string;
  documento: string; fecha_nacimiento: string; genero: string;
  otros_datos: string;
}

export const CONTACT_FORM_VACIO: ContactFormState = {
  nombre: "", apellido: "", puesto: "", organizacion: "", tipo: "aliado",
  influencia: "", telefono: "", whatsapp: "", email: "", localidad: "",
  barrio: "", direccion: "", zona_id: "", notas: "",
  telefono_2: "", email_2: "",
  facebook: "", instagram: "", x_twitter: "", tiktok: "", sitio_web: "",
  documento: "", fecha_nacimiento: "", genero: "",
  otros_datos: "",
};

/** Marca las opciones que aún no existen en `zones` y hay que registrar al elegirlas. */
const SUGERIDA = "sugerida:";

const GENEROS = ["Femenino", "Masculino", "Otro", "Prefiere no decir"];

interface Props {
  f: ContactFormState;
  set: (k: keyof ContactFormState, v: string) => void;
  fe: ReturnType<typeof useFieldErrors>;
  zones: ZoneOpt[];
  /** Abre de entrada la sección de datos adicionales (útil al editar). */
  defaultExpanded?: boolean;
}

/**
 * Campos compartidos por el diálogo de crear y el de editar contacto.
 *
 * Solo el nombre es obligatorio. Un contacto sin teléfono ni correo se guarda
 * sin problema; un correo con formato dudoso avisa en ámbar pero no bloquea.
 */
export function ContactFormFields({ f, set, fe, zones, defaultExpanded }: Props) {
  const [zoneOpts, setZoneOpts] = useState<ZoneOpt[]>(zones);
  const [zoneBusy, setZoneBusy] = useState(false);
  const [nuevoTipo, setNuevoTipo] = useState<ZoneType>("localidad");
  const [masDatos, setMasDatos] = useState(Boolean(defaultExpanded));

  // Mantiene las zonas del servidor sin perder las que se acaban de registrar aquí.
  useEffect(() => {
    setZoneOpts((prev) => {
      const merged = new Map(prev.map((z) => [z.id, z]));
      for (const z of zones) merged.set(z.id, z);
      return [...merged.values()];
    });
  }, [zones]);

  /** Zonas registradas + localidades de Bogotá que todavía no existen como zona. */
  const zonaOptions = useMemo<ComboboxOption[]>(() => {
    const registradas = [...zoneOpts]
      .sort((a, b) => a.nombre_zona.localeCompare(b.nombre_zona, "es"))
      .map((z) => ({
        value: z.id,
        label: z.nombre_zona,
        hint: z.tipo_zona ? ZONE_TYPE_LABELS[z.tipo_zona] : undefined,
      }));
    const existentes = new Set(zoneOpts.map((z) => normalizeName(z.nombre_zona)));
    const sugeridas = LOCALIDADES.filter(
      (l) => l !== "Otra" && !existentes.has(normalizeName(l)),
    ).map((l) => ({
      value: `${SUGERIDA}localidad:${l}`,
      label: l,
      hint: "Localidad",
      keywords: ["bogota"],
      suggested: true,
    }));
    return [...registradas, ...sugeridas];
  }, [zoneOpts]);

  async function registrarZona(nombre: string, tipo: ZoneType) {
    setZoneBusy(true);
    try {
      const res = await ensureZone(nombre.trim(), tipo);
      const z = res.ok ? res.data?.zone : null;
      if (!z) {
        toast.error(res.ok ? "No se pudo registrar la zona." : res.message);
        return;
      }
      setZoneOpts((prev) =>
        prev.some((o) => o.id === z.id)
          ? prev
          : [...prev, { id: z.id, nombre_zona: z.nombre_zona, tipo_zona: z.tipo_zona }],
      );
      set("zona_id", z.id);
      toast.success(`Zona «${z.nombre_zona}» registrada.`);
    } finally {
      setZoneBusy(false);
    }
  }

  function elegirZona(v: string) {
    if (!v.startsWith(SUGERIDA)) return set("zona_id", v);
    const raw = v.slice(SUGERIDA.length);
    const i = raw.indexOf(":");
    void registrarZona(raw.slice(i + 1), raw.slice(0, i) as ZoneType);
  }

  /** Aviso ámbar (no bloqueante) si el correo no tiene pinta de correo. */
  const avisoCorreo = (v: string) =>
    v.trim() && !looksLikeEmail(v) ? "No parece un correo. Se guarda igual." : undefined;

  const txt = (k: keyof ContactFormState) => ({
    id: k,
    value: f[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value),
    "aria-invalid": !!fe.errors[k],
  });

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre" required {...fe.field("nombre")}>
          <Input {...txt("nombre")} autoComplete="given-name" />
        </Field>
        <Field label="Apellido" {...fe.field("apellido")}>
          <Input {...txt("apellido")} autoComplete="family-name" />
        </Field>
        <Field label="Puesto / cargo" {...fe.field("puesto")}>
          <Input {...txt("puesto")} placeholder="Presidente JAC, Edil…" />
        </Field>
        <Field label="Organización" {...fe.field("organizacion")}>
          <Input {...txt("organizacion")} />
        </Field>

        <Field label="Tipo" {...fe.field("tipo")}>
          <Select value={f.tipo} onValueChange={(v) => set("tipo", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONTACT_TIPOS.map((t) => (
                <SelectItem key={t} value={t}>{CONTACT_TIPO_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Influencia" {...fe.field("influencia")}>
          <Select value={f.influencia} onValueChange={(v) => set("influencia", v)}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Media</SelectItem>
              <SelectItem value="baja">Baja</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Teléfono" hint="Opcional" {...fe.field("telefono")}>
          <Input {...txt("telefono")} type="tel" inputMode="tel" autoComplete="tel" />
        </Field>
        <Field label="WhatsApp" hint="Si se deja vacío se usa el teléfono" {...fe.field("whatsapp")}>
          <Input {...txt("whatsapp")} type="tel" inputMode="tel" />
        </Field>
        <Field
          label="Correo"
          hint="Opcional"
          warning={avisoCorreo(f.email)}
          {...fe.field("email")}
        >
          <Input {...txt("email")} type="email" inputMode="email" autoCapitalize="none" autoComplete="email" />
        </Field>

        <Field label="Zona / territorio" {...fe.field("zona_id")}>
          <Combobox
            value={f.zona_id}
            onChange={elegirZona}
            options={zonaOptions}
            busy={zoneBusy}
            placeholder="Sin zona"
            searchPlaceholder="Buscar zona o territorio…"
            emptyText="No está registrada. Escríbela para crearla."
            onCreate={(nombre) => registrarZona(nombre, nuevoTipo)}
            createLabel="Crear zona"
            createSlot={
              <select
                value={nuevoTipo}
                onChange={(e) => setNuevoTipo(e.target.value as ZoneType)}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-muted-foreground"
              >
                {ZONE_TYPES.map((t) => (
                  <option key={t} value={t}>Como {ZONE_TYPE_LABELS[t].toLowerCase()}</option>
                ))}
              </select>
            }
          />
        </Field>
        <Field label="Localidad" {...fe.field("localidad")}>
          <Input {...txt("localidad")} />
        </Field>
        <Field label="Barrio" {...fe.field("barrio")}>
          <Input {...txt("barrio")} />
        </Field>
        <Field label="Dirección" className="sm:col-span-2" {...fe.field("direccion")}>
          <Input {...txt("direccion")} autoComplete="street-address" />
        </Field>
      </div>

      <Field label="Notas" {...fe.field("notas")}>
        <Textarea
          id="notas"
          rows={2}
          value={f.notas}
          onChange={(e) => set("notas", e.target.value)}
          aria-invalid={!!fe.errors.notas}
        />
      </Field>

      {/* ── Datos adicionales, plegados para no abrumar ── */}
      <button
        type="button"
        onClick={() => setMasDatos((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-dashed px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
        aria-expanded={masDatos}
      >
        <span>Más datos de contacto (opcional)</span>
        <ChevronDown className={`size-4 transition-transform ${masDatos ? "rotate-180" : ""}`} />
      </button>

      {masDatos && (
        <div className="space-y-4 rounded-lg border bg-muted/30 p-3 sm:p-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Segundo canal
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Otro teléfono" {...fe.field("telefono_2")}>
                <Input {...txt("telefono_2")} type="tel" inputMode="tel" />
              </Field>
              <Field
                label="Otro correo"
                warning={avisoCorreo(f.email_2)}
                {...fe.field("email_2")}
              >
                <Input {...txt("email_2")} type="email" inputMode="email" autoCapitalize="none" />
              </Field>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Redes y web
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Facebook" hint="Usuario o enlace" {...fe.field("facebook")}>
                <Input {...txt("facebook")} placeholder="@usuario" autoCapitalize="none" />
              </Field>
              <Field label="Instagram" hint="Usuario o enlace" {...fe.field("instagram")}>
                <Input {...txt("instagram")} placeholder="@usuario" autoCapitalize="none" />
              </Field>
              <Field label="X (Twitter)" hint="Usuario o enlace" {...fe.field("x_twitter")}>
                <Input {...txt("x_twitter")} placeholder="@usuario" autoCapitalize="none" />
              </Field>
              <Field label="TikTok" hint="Usuario o enlace" {...fe.field("tiktok")}>
                <Input {...txt("tiktok")} placeholder="@usuario" autoCapitalize="none" />
              </Field>
              <Field label="Sitio web" className="sm:col-span-2" {...fe.field("sitio_web")}>
                <Input {...txt("sitio_web")} inputMode="url" autoCapitalize="none" placeholder="ejemplo.com" />
              </Field>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Datos personales
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Documento" {...fe.field("documento")}>
                <Input {...txt("documento")} inputMode="numeric" />
              </Field>
              <Field label="Fecha de nacimiento" {...fe.field("fecha_nacimiento")}>
                <Input {...txt("fecha_nacimiento")} type="date" />
              </Field>
              <Field label="Género" {...fe.field("genero")}>
                <Select value={f.genero || "__none__"} onValueChange={(v) => set("genero", v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin especificar</SelectItem>
                    {GENEROS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>

          <Field
            label="Otros datos"
            hint="Cualquier dato que no encaje arriba"
            {...fe.field("otros_datos")}
          >
            <Textarea
              id="otros_datos"
              rows={3}
              value={f.otros_datos}
              onChange={(e) => set("otros_datos", e.target.value)}
              aria-invalid={!!fe.errors.otros_datos}
            />
          </Field>
        </div>
      )}
    </>
  );
}
