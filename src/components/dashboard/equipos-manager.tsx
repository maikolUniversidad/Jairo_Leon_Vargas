"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Pencil, Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createEquipo, toggleEquipo, updateEquipo } from "@/actions/equipos";
import {
  TIPOS_EQUIPO,
  TIPO_EQUIPO_LABEL,
  type EquipoCobertura,
  type TipoEquipo,
} from "@/lib/equipos-shared";

interface Borrador {
  nombre: string;
  tipo: TipoEquipo;
}

const VACIO: Borrador = { nombre: "", tipo: "mixto" };

/**
 * Catálogo de equipos de grabación y fotografía.
 *
 * No hay borrado: los equipos se desactivan. Borrar uno dejaría sin atribución
 * al material que ya grabó, y ese registro histórico es el punto de la función.
 */
export function EquiposManager({ equipos }: { equipos: EquipoCobertura[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [nuevo, setNuevo] = useState<Borrador>(VACIO);
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<Borrador>(VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const refrescar = () => start(() => router.refresh());

  const crear = () => {
    setErrores({});
    start(async () => {
      const res = await createEquipo(nuevo);
      if (res.ok) {
        setNuevo(VACIO);
        toast.success(res.message);
        refrescar();
      } else {
        // Error por campo, no un toast ciego: el nombre duplicado se marca
        // donde el usuario lo puede arreglar.
        setErrores(res.fieldErrors ?? {});
        if (!res.fieldErrors) toast.error(res.message);
      }
    });
  };

  const guardar = (id: string) => {
    setErrores({});
    start(async () => {
      const res = await updateEquipo(id, borrador);
      if (res.ok) {
        setEditando(null);
        toast.success(res.message);
        refrescar();
      } else {
        setErrores(res.fieldErrors ?? {});
        if (!res.fieldErrors) toast.error(res.message);
      }
    });
  };

  const alternar = (id: string, activo: boolean) =>
    start(async () => {
      const res = await toggleEquipo(id, activo);
      if (res.ok) {
        toast.success(res.message);
        refrescar();
      } else {
        toast.error(res.message);
      }
    });

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h3 className="text-sm font-semibold">Equipos de grabación y fotografía</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            A cada archivo de una cobertura se le asigna el equipo que lo produjo. Los equipos no se
            borran: se desactivan, para no dejar sin atribución el material ya subido.
          </p>
        </div>

        {/* Alta */}
        <div className="flex flex-wrap items-start gap-2 rounded-lg border border-dashed p-3">
          <div className="min-w-[12rem] flex-1">
            <Input
              value={nuevo.nombre}
              onChange={(e) => setNuevo((n) => ({ ...n, nombre: e.target.value }))}
              placeholder="Nombre del equipo"
              aria-label="Nombre del equipo"
              aria-invalid={Boolean(errores.nombre)}
            />
            {errores.nombre && (
              <p className="mt-1 text-[11px] text-destructive">{errores.nombre}</p>
            )}
          </div>
          <select
            value={nuevo.tipo}
            onChange={(e) => setNuevo((n) => ({ ...n, tipo: e.target.value as TipoEquipo }))}
            aria-label="Tipo de equipo"
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            {TIPOS_EQUIPO.map((t) => (
              <option key={t} value={t}>
                {TIPO_EQUIPO_LABEL[t]}
              </option>
            ))}
          </select>
          <Button onClick={crear} disabled={nuevo.nombre.trim().length < 2}>
            <Plus className="mr-1 size-4" /> Agregar
          </Button>
        </div>

        {/* Listado */}
        {equipos.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Todavía no hay equipos. Crea el primero para poder subir material.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {equipos.map((eq) => (
              <li key={eq.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                {editando === eq.id ? (
                  <>
                    <div className="min-w-[10rem] flex-1">
                      <Input
                        value={borrador.nombre}
                        onChange={(e) => setBorrador((b) => ({ ...b, nombre: e.target.value }))}
                        aria-label={`Nombre de ${eq.nombre}`}
                        aria-invalid={Boolean(errores.nombre)}
                      />
                      {errores.nombre && (
                        <p className="mt-1 text-[11px] text-destructive">{errores.nombre}</p>
                      )}
                    </div>
                    <select
                      value={borrador.tipo}
                      onChange={(e) => setBorrador((b) => ({ ...b, tipo: e.target.value as TipoEquipo }))}
                      aria-label={`Tipo de ${eq.nombre}`}
                      className="h-9 rounded-md border bg-background px-2 text-sm"
                    >
                      {TIPOS_EQUIPO.map((t) => (
                        <option key={t} value={t}>
                          {TIPO_EQUIPO_LABEL[t]}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" onClick={() => guardar(eq.id)}>
                      <Check className="size-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>
                      <X className="size-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className={`flex-1 text-sm ${eq.activo ? "" : "text-muted-foreground line-through"}`}>
                      {eq.nombre}
                    </span>
                    <Badge variant="muted">{TIPO_EQUIPO_LABEL[eq.tipo]}</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setErrores({});
                        setEditando(eq.id);
                        setBorrador({ nombre: eq.nombre, tipo: eq.tipo });
                      }}
                      aria-label={`Editar ${eq.nombre}`}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => alternar(eq.id, !eq.activo)}
                      className="text-xs text-muted-foreground"
                    >
                      {eq.activo ? "Desactivar" : "Activar"}
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
