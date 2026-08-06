"use client";

import * as React from "react";
import { Check, ChevronDown, Loader2, Plus, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Texto corto a la derecha (p. ej. el tipo de zona). */
  hint?: string;
  /** Términos extra por los que también se debe encontrar la opción. */
  keywords?: string[];
  /** Opción propuesta que todavía no está registrada. */
  suggested?: boolean;
}

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
/** Normaliza para comparar: minúsculas y sin tildes. */
const norm = (s: string) => s.normalize("NFD").replace(DIACRITICS, "").toLowerCase().trim();

/** Puntúa qué tan bien encaja una opción con la búsqueda (-1 = no encaja). */
function score(option: ComboboxOption, terms: string[], q: string): number {
  const haystack = norm(
    [option.label, option.hint, ...(option.keywords ?? [])].filter(Boolean).join(" "),
  );
  if (!terms.every((t) => haystack.includes(t))) return -1;
  const label = norm(option.label);
  if (label === q) return 100;
  if (label.startsWith(q)) return 80;
  if (label.split(/\s+/).some((w) => w.startsWith(q))) return 60;
  if (label.includes(q)) return 40;
  return 20;
}

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  /** Muestra el control en estado "guardando" (p. ej. registrando la opción nueva). */
  busy?: boolean;
  /** Permite registrar lo que el usuario escribió como opción nueva. */
  onCreate?: (label: string) => void | Promise<void>;
  createLabel?: string;
  /** Control extra dentro de la fila de "crear" (p. ej. el tipo de zona). */
  createSlot?: React.ReactNode;
}

/**
 * Selector con búsqueda inteligente (sin tildes, por palabras y ordenado por
 * relevancia) que además permite registrar un valor nuevo si no existe.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Seleccionar…",
  searchPlaceholder = "Buscar…",
  emptyText = "Sin coincidencias.",
  className,
  disabled,
  busy,
  onCreate,
  createLabel = "Crear",
  createSlot,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listId = React.useId();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;
  const query = norm(q);

  const results = React.useMemo(() => {
    if (!query) return options;
    const terms = query.split(/\s+/).filter(Boolean);
    return options
      .map((o) => ({ o, s: score(o, terms, query) }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => b.s - a.s || a.o.label.localeCompare(b.o.label, "es"))
      .map((r) => r.o);
  }, [options, query]);

  const exact = results.some((o) => norm(o.label) === query);
  const canCreate = !!onCreate && query.length >= 2 && !exact;
  const total = results.length + (canCreate ? 1 : 0);

  // Cierra al hacer clic fuera del control.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  React.useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      inputRef.current?.focus();
    }
  }, [open]);

  React.useEffect(() => setActive(0), [query]);

  React.useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(option: ComboboxOption) {
    setOpen(false);
    onChange(option.value);
  }

  function create() {
    const label = q.trim();
    if (!onCreate || label.length < 2) return;
    setOpen(false);
    void onCreate(label);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!total) return;
      setActive((i) => (e.key === "ArrowDown" ? (i + 1) % total : (i - 1 + total) % total));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = results[active];
      if (option) choose(option);
      else if (canCreate) create();
    } else if (e.key === "Escape") {
      // Evita que el Escape cierre también el diálogo que contiene al selector.
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        disabled={disabled || busy}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background py-2 pl-3 text-left text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          selected && !busy ? "pr-16" : "pr-9",
        )}
      >
        <span className={cn("line-clamp-1", !selected && "text-muted-foreground")}>
          {busy ? "Guardando…" : selected ? selected.label : placeholder}
        </span>
      </button>

      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
        {busy ? (
          <Loader2 className="size-4 animate-spin opacity-60" />
        ) : (
          <ChevronDown className="size-4 opacity-50" />
        )}
      </span>

      {selected && !busy && !disabled && (
        <button
          type="button"
          aria-label="Quitar selección"
          onClick={() => onChange("")}
          className="absolute right-8 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div id={listId} ref={listRef} role="listbox" className="max-h-56 overflow-y-auto p-1">
            {results.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">{emptyText}</p>
            )}
            {results.map((o, i) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                data-active={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
              >
                <Check className={cn("size-3.5 shrink-0", o.value === value ? "opacity-100" : "opacity-0")} />
                <span className="flex-1 truncate">{o.label}</span>
                {o.suggested && (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    nueva
                  </span>
                )}
                {o.hint && <span className="shrink-0 text-[11px] text-muted-foreground">{o.hint}</span>}
              </button>
            ))}
          </div>

          {canCreate && (
            <div className="border-t p-1">
              <button
                type="button"
                data-active={active === results.length}
                onMouseEnter={() => setActive(results.length)}
                onClick={create}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
              >
                <Plus className="size-3.5 shrink-0 text-primary" />
                <span className="flex-1 truncate">
                  {createLabel} «{q.trim()}»
                </span>
              </button>
              {createSlot && <div className="px-2 pb-1 pt-1.5">{createSlot}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
