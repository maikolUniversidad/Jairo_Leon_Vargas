"use client";

import * as React from "react";
import { AlertCircle, AlertTriangle } from "lucide-react";
import type { ZodError, ZodType } from "zod";

import { cn } from "@/lib/utils";

export type FieldErrors = Record<string, string>;

/** Convierte errores de Zod a un mapa campo→mensaje (espejo cliente de actions/types). */
export function toFieldErrors(error: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.errors) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

interface ActionLike {
  ok: boolean;
  message: string;
  fieldErrors?: FieldErrors;
}

/** Nombres legibles para los campos que devuelven los esquemas Zod. */
const FIELD_LABELS: Record<string, string> = {
  alerta: "Alerta", apellido: "Apellido", area_id: "Área", asunto: "Asunto",
  avatar_url: "Foto", barrio: "Barrio", bio: "Sobre mí", cargo: "Cargo",
  categoria: "Categoría", contenido: "Contenido", correo: "Correo",
  descripcion: "Descripción", direccion: "Dirección", documento: "Documento",
  email: "Correo", entidad: "Entidad", estado: "Estado", fecha: "Fecha",
  fecha_fin: "Fecha de fin", fecha_gestion: "Fecha de gestión",
  fecha_ingreso: "Fecha de ingreso", fecha_inicio: "Fecha de inicio",
  fecha_limite: "Fecha límite", full_name: "Nombre completo", guion: "Guion",
  influencia: "Influencia", lugar: "Lugar", localidad: "Localidad",
  nombre: "Nombre", nombre_zona: "Nombre de la zona", notas: "Notas",
  observaciones: "Observaciones", organizacion: "Organización",
  password: "Contraseña", persona_encargada: "Persona encargada",
  persona_recibe: "Persona recibe", phone: "Teléfono", prioridad: "Prioridad",
  puesto: "Puesto / cargo", red: "Red", responsable_id: "Responsable",
  role_key: "Rol", semaforo: "Semáforo", telefono: "Teléfono", texto: "Texto",
  tipo: "Tipo", titulo: "Título", tramite: "Trámite", url: "Enlace",
  user_id: "Persona", whatsapp: "WhatsApp", zona_id: "Zona",
};

export function fieldLabel(name: string): string {
  return FIELD_LABELS[name] ?? name.replace(/_/g, " ");
}

/**
 * Convierte `fieldErrors` en un mensaje que SÍ dice qué campo falla.
 *
 * Red de seguridad para los formularios que todavía no pintan el error debajo
 * del campo: en vez del inútil "Revisa los campos", el toast dice
 * «Correo: Correo inválido». Devuelve null si no hay errores por campo.
 */
export function describeFieldErrors(res: ActionLike): string | null {
  const fe = res.fieldErrors;
  if (!fe) return null;
  const entries = Object.entries(fe);
  if (entries.length === 0) return null;
  const parts = entries
    .slice(0, 3)
    .map(([k, msg]) => (k === "_" ? msg : `${fieldLabel(k)}: ${msg}`));
  const resto = entries.length - parts.length;
  return parts.join(" · ") + (resto > 0 ? ` (y ${resto} más)` : "");
}

/**
 * Estado de errores por campo para formularios.
 *
 * Resuelve el problema de los toasts genéricos ("Revisa los campos") que no
 * dicen QUÉ campo falla: valida en el cliente con el mismo esquema Zod del
 * server action, pinta el error debajo del campo y lleva el foco al primero.
 *
 * Uso:
 *   const fe = useFieldErrors();
 *   ...
 *   <div ref={fe.containerRef}>
 *     <Field label="Correo" {...fe.field("email")}>
 *       <Input value={...} onChange={(e) => { set("email", e.target.value); fe.clear("email"); }} />
 *     </Field>
 *   </div>
 */
export function useFieldErrors() {
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  /** Lleva el foco y el scroll al primer campo inválido. */
  const focusFirstInvalid = React.useCallback(() => {
    // Espera al repintado para que los `data-invalid` ya estén en el DOM.
    requestAnimationFrame(() => {
      const root: ParentNode = containerRef.current ?? document;
      const wrapper = root.querySelector<HTMLElement>('[data-invalid="true"]');
      if (!wrapper) return;
      wrapper.scrollIntoView({ block: "center", behavior: "smooth" });
      wrapper
        .querySelector<HTMLElement>("input, textarea, select, [role='combobox'], button")
        ?.focus({ preventScroll: true });
    });
  }, []);

  const show = React.useCallback(
    (next: FieldErrors) => {
      setErrors(next);
      if (Object.keys(next).length > 0) focusFirstInvalid();
    },
    [focusFirstInvalid],
  );

  /** Limpia un campo (al escribir) o todos si se omite el nombre. */
  const clear = React.useCallback((name?: string) => {
    setErrors((prev) => {
      if (!name) return {};
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  /**
   * Valida contra el esquema antes de llamar al servidor. Devuelve los datos
   * si son válidos, o `null` tras pintar los errores.
   */
  const validate = React.useCallback(
    <T,>(schema: ZodType<T>, value: unknown): T | null => {
      const parsed = schema.safeParse(value);
      if (parsed.success) {
        setErrors({});
        return parsed.data;
      }
      show(toFieldErrors(parsed.error));
      return null;
    },
    [show],
  );

  /** Absorbe los `fieldErrors` que devuelve un server action fallido. */
  const fromResult = React.useCallback(
    (res: ActionLike) => {
      const fe = "fieldErrors" in res ? res.fieldErrors : undefined;
      if (fe && Object.keys(fe).length > 0) show(fe);
      return fe;
    },
    [show],
  );

  /** Props para pasar a `<Field>`. */
  const field = React.useCallback(
    (name: string) => ({ name, error: errors[name] }),
    [errors],
  );

  return {
    errors,
    hasErrors: Object.keys(errors).length > 0,
    containerRef,
    show,
    clear,
    validate,
    fromResult,
    field,
    focusFirstInvalid,
  };
}

interface FieldProps {
  label?: string;
  /** Clave del campo; se usa para enlazar label, control y mensaje de error. */
  name?: string;
  error?: string;
  /**
   * Aviso NO bloqueante (ámbar). Para datos sospechosos pero admisibles:
   * un correo mal escrito se avisa, pero el contacto se guarda igual.
   */
  warning?: string;
  required?: boolean;
  /** Texto de ayuda, se oculta cuando hay error o aviso. */
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Envuelve un control de formulario con su etiqueta y su mensaje de error.
 *
 * Cuando hay error marca `data-invalid` en el contenedor, lo que tiñe de rojo
 * el borde del control que lleve dentro (input, textarea, select o el botón de
 * un combobox) sin necesidad de tocar cada primitiva.
 */
export function Field({
  label,
  name,
  error,
  warning,
  required,
  hint,
  className,
  children,
}: FieldProps) {
  const invalid = Boolean(error);
  const warned = !invalid && Boolean(warning);
  const errorId = name ? `${name}-error` : undefined;

  return (
    <div
      data-invalid={invalid || undefined}
      className={cn(
        "min-w-0 space-y-1.5",
        // Tiñe el control interno sin acoplarse a cada primitiva de UI.
        invalid &&
          "[&_[role=combobox]]:border-destructive [&_button[type=button]]:border-destructive [&_input]:border-destructive [&_select]:border-destructive [&_textarea]:border-destructive",
        warned && "[&_input]:border-amber-500 [&_textarea]:border-amber-500",
        className,
      )}
    >
      {label && (
        <label
          htmlFor={name}
          className="block text-sm font-medium leading-none text-foreground"
        >
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
      )}
      {children}
      {invalid ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1 text-xs font-medium text-destructive"
        >
          <AlertCircle className="mt-px size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : warned ? (
        <p className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-500">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          <span>{warning}</span>
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/**
 * Resumen de errores para formularios largos: dice cuántos campos faltan y
 * permite saltar al primero. Se coloca junto al botón de envío.
 */
export function FieldErrorSummary({
  errors,
  onFocus,
  className,
}: {
  errors: FieldErrors;
  onFocus?: () => void;
  className?: string;
}) {
  const keys = Object.keys(errors);
  if (keys.length === 0) return null;

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive",
        className,
      )}
    >
      <AlertCircle className="size-4 shrink-0" />
      <span className="font-medium">
        {keys.length === 1
          ? "Falta corregir 1 campo."
          : `Faltan corregir ${keys.length} campos.`}
      </span>
      {onFocus && (
        <button
          type="button"
          onClick={onFocus}
          className="underline underline-offset-2 hover:no-underline"
        >
          Ir al primero
        </button>
      )}
    </div>
  );
}
