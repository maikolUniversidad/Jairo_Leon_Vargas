"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, UserPlus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  addAsistente, removeAsistente,
  type Asistente, type PersonaVinculable,
} from "@/actions/coberturas";

/** Roles que de verdad cambian cómo lee la IA el brief. */
const ROLES = ["Asistente", "Ponente", "Organizador", "Prensa", "Equipo"];
const SIN_ROL = "__sin_rol__";

/** Equipo primero: «¿quién de los nuestros estuvo?» es la pregunta más frecuente. */
const GRUPOS = [
  { vinculo: "equipo" as const, titulo: "Del equipo" },
  { vinculo: "aliado" as const, titulo: "Aliados y organizaciones" },
  { vinculo: "otro" as const, titulo: "Otros asistentes" },
];

export function CoberturaAsistentes({
  coberturaId,
  asistentes: iniciales,
  personas,
}: {
  coberturaId: string;
  asistentes: Asistente[];
  personas: PersonaVinculable[];
}) {
  const [asistentes, setAsistentes] = useState(iniciales);
  const [rol, setRol] = useState<string>(SIN_ROL);
  const [nombreLibre, setNombreLibre] = useState("");
  const [, start] = useTransition();

  // Las personas ya registradas no vuelven a ofrecerse en el buscador.
  const yaVinculados = useMemo(
    () =>
      new Set(
        asistentes
          .map((a) => (a.contacto_id ? `contacto:${a.contacto_id}` : a.ciudadano_id ? `ciudadano:${a.ciudadano_id}` : null))
          .filter(Boolean) as string[],
      ),
    [asistentes],
  );

  const opciones: ComboboxOption[] = useMemo(
    () =>
      personas
        .map((p) => ({
          value: `${p.tipo}:${p.id}`,
          label: p.nombre,
          hint:
            p.tipo === "usuario" ? "del equipo" : p.tipo === "contacto" ? "contacto" : "ciudadano",
          keywords: p.detalle ? [p.detalle] : undefined,
        }))
        .filter((o) => !yaVinculados.has(o.value)),
    [personas, yaVinculados],
  );

  const agregar = (input: Parameters<typeof addAsistente>[0]) =>
    start(async () => {
      const res = await addAsistente(input);
      if (res.ok && res.data) {
        setAsistentes((prev) => [...prev, res.data!]);
      } else {
        toast.error(res.message);
      }
    });

  const vincular = (valor: string) => {
    if (!valor) return;
    const [tipo, id] = valor.split(":");
    const persona = personas.find((p) => p.tipo === tipo && p.id === id);
    if (!persona) return;
    agregar({
      cobertura_id: coberturaId,
      nombre: persona.nombre,
      rol: rol === SIN_ROL ? null : rol,
      // Un usuario de la plataforma es, por definición, gente del equipo.
      user_id: tipo === "usuario" ? id : null,
      contacto_id: tipo === "contacto" ? id : null,
      ciudadano_id: tipo === "ciudadano" ? id : null,
      vinculo: tipo === "usuario" ? "equipo" : tipo === "contacto" ? "aliado" : "otro",
    });
  };

  const agregarLibre = () => {
    const nombre = nombreLibre.trim();
    if (!nombre) return;
    if (asistentes.some((a) => a.nombre.toLowerCase() === nombre.toLowerCase())) {
      toast.error("Esa persona ya está en la lista.");
      return;
    }
    setNombreLibre("");
    agregar({ cobertura_id: coberturaId, nombre, rol: rol === SIN_ROL ? null : rol });
  };

  const quitar = (id: string) =>
    start(async () => {
      const previo = asistentes;
      setAsistentes((prev) => prev.filter((a) => a.id !== id));
      const res = await removeAsistente(id);
      if (!res.ok) {
        setAsistentes(previo);
        toast.error(res.message);
      }
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={rol} onValueChange={setRol}>
          <SelectTrigger className="h-10 w-40"><SelectValue placeholder="Rol" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={SIN_ROL}>Sin rol</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          se aplica a quien agregues a continuación
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Combobox
          value=""
          onChange={vincular}
          options={opciones}
          placeholder="Buscar en el equipo, contactos y ciudadanos…"
          searchPlaceholder="Nombre, organización o documento…"
          emptyText="Nadie con ese nombre en la plataforma."
        />
        <div className="flex gap-2">
          <Input
            value={nombreLibre}
            onChange={(e) => setNombreLibre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                agregarLibre();
              }
            }}
            placeholder="…o escribe un nombre suelto"
          />
          <Button type="button" variant="outline" onClick={agregarLibre} disabled={!nombreLibre.trim()}>
            <Plus className="size-4" /> Agregar
          </Button>
        </div>
      </div>

      {asistentes.length === 0 ? (
        <p className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
          <UserPlus className="size-4" /> Todavía no hay nadie registrado.
        </p>
      ) : (
        <div className="space-y-2">
          {GRUPOS.map(({ vinculo, titulo }) => {
            const delGrupo = asistentes.filter((a) => (a.vinculo ?? "otro") === vinculo);
            if (delGrupo.length === 0) return null;
            return (
              <div key={vinculo}>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {titulo} · {delGrupo.length}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {delGrupo.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-full border bg-background py-1 pl-3 pr-1.5 text-sm"
            >
              <span>{a.nombre}</span>
              {a.rol && <Badge variant="muted">{a.rol}</Badge>}
              {a.organizacion && <Badge variant="muted">{a.organizacion}</Badge>}
              {(a.user_id || a.contacto_id || a.ciudadano_id) && (
                <Badge variant="secondary">
                  {a.user_id ? "usuario" : a.contacto_id ? "contacto" : "ciudadano"}
                </Badge>
              )}
              <button
                type="button"
                onClick={() => quitar(a.id)}
                aria-label={`Quitar a ${a.nombre}`}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
