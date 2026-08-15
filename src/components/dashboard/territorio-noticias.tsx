"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Newspaper, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getNoticiasZona, type NoticiasZona } from "@/actions/territorio";
import { zonaLabel, type Nivel, type Zona } from "@/lib/territorio";
import { formatDate } from "@/lib/utils";

/** El tipo de la capa del mapa no es el mismo vocabulario que el de zona. */
const NIVEL_DE_TIPO: Record<string, Nivel> = {
  departamento: "departamento",
  municipio: "municipio",
  // Una localidad o un barrio de Bogotá se consultan como el municipio que son.
  localidad: "municipio",
  barrio: "municipio",
};

/**
 * Lo que dice la prensa sobre la zona seleccionada.
 *
 * Se consulta al seleccionar y se guarda unas horas: con 1.122 municipios,
 * recolectarlos todos de antemano sería recolectar sobre todo lo que nadie va
 * a mirar.
 */
export function TerritorioNoticias({
  nombre,
  codigo,
  tipo,
  padre,
}: {
  nombre: string;
  codigo: string | null;
  tipo: string;
  padre?: string | null;
}) {
  const [datos, setDatos] = useState<NoticiasZona | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(
    async (forzar: boolean) => {
      const nivel = NIVEL_DE_TIPO[tipo];
      if (!nivel) return;

      setCargando(true);
      setError(null);
      const zona: Zona = {
        nivel,
        // Sin código de la capa se usa el nombre como llave: no es ideal, pero
        // permite cachear igual las capas que no traen divipola.
        codigo: codigo ?? nombre,
        nombre,
        // Un barrio o localidad de Bogotá se consulta con Bogotá al lado.
        departamento: padre ?? (tipo === "localidad" || tipo === "barrio" ? "Bogotá" : null),
      };
      const res = await getNoticiasZona(zona, forzar);
      setCargando(false);
      if (res.ok && res.data) setDatos(res.data);
      else {
        setDatos(null);
        setError(res.message);
      }
    },
    [nombre, codigo, tipo, padre],
  );

  // Se recarga al cambiar de zona, no en cada render del panel.
  useEffect(() => {
    setDatos(null);
    void cargar(false);
  }, [cargar]);

  if (!NIVEL_DE_TIPO[tipo]) return null;

  const zona: Zona = {
    nivel: NIVEL_DE_TIPO[tipo]!,
    codigo: codigo ?? nombre,
    nombre,
    departamento: padre ?? null,
  };

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center gap-2">
        <Newspaper className="size-4 shrink-0 text-muted-foreground" />
        <p className="flex-1 text-sm font-medium">Qué dice la prensa</p>
        {datos && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => cargar(true)}
            disabled={cargando}
            title="Volver a consultar ahora"
          >
            <RefreshCw className={`size-3.5 ${cargando ? "animate-spin" : ""}`} />
          </Button>
        )}
      </div>

      <p className="mb-2 text-[11px] text-muted-foreground">
        Titulares recientes sobre {zonaLabel(zona)}.
      </p>

      {cargando && !datos ? (
        <p className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Consultando la prensa…
        </p>
      ) : error ? (
        <p className="py-3 text-xs text-muted-foreground">{error}</p>
      ) : datos && datos.items.length > 0 ? (
        <>
          <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {datos.items.map((n) => (
              <li key={n.url}>
                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block rounded p-1.5 hover:bg-muted/60"
                >
                  <span className="flex items-start gap-1.5 text-xs leading-snug">
                    <ExternalLink className="mt-0.5 size-3 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                    <span className="min-w-0 flex-1">{n.titulo}</span>
                  </span>
                  <span className="ml-4.5 mt-0.5 block text-[10px] text-muted-foreground">
                    {[n.fuente, n.published_at ? formatDate(n.published_at) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-muted-foreground">
            {datos.total} titulares · {datos.desde_cache ? "guardado" : "recién consultado"} el{" "}
            {formatDate(datos.recolectado_en, { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </>
      ) : (
        <p className="py-3 text-xs text-muted-foreground">
          No hay noticias recientes de esta zona.
        </p>
      )}
    </div>
  );
}
