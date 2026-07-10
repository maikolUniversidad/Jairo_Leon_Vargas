"use client";

import { useEffect, useRef, useState } from "react";

import { loadLeaflet } from "@/lib/leaflet";
import {
  featureName,
  featureCode,
  normalizeName,
  type GeoLayerSource,
} from "@/lib/geo-sources";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface AreaHighlight {
  count: number;
  prioridad?: string | null;
}

const PRIO_COLOR: Record<string, string> = {
  urgente: "#e92025",
  alta: "#f49a20",
  media: "#2a3883",
  baja: "#35a74a",
};

export function TerritorioMap({
  source,
  highlight,
  onSelect,
}: {
  source: GeoLayerSource;
  highlight: Map<string, AreaHighlight>;
  onSelect: (name: string, code: string | null, tipo: GeoLayerSource["tipo"]) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const geoRef = useRef<any>(null);
  const onSelectRef = useRef(onSelect);
  const highlightRef = useRef(highlight);
  onSelectRef.current = onSelect;
  highlightRef.current = highlight;

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  function styleFor(name: string) {
    const h = highlightRef.current.get(normalizeName(name));
    if (h && h.count > 0) {
      return {
        color: "#334155",
        weight: 1.2,
        fillColor: PRIO_COLOR[h.prioridad ?? ""] ?? "#8e378e",
        fillOpacity: 0.55,
      };
    }
    return { color: "#64748b", weight: 1, fillColor: "#94a3b8", fillOpacity: 0.12 };
  }

  // Inicializa el mapa y carga el GeoJSON cuando cambia la fuente.
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    (async () => {
      const L = await loadLeaflet().catch(() => null);
      if (!L || cancelled || !elRef.current) { setStatus("error"); return; }

      if (!mapRef.current) {
        mapRef.current = L.map(elRef.current).setView([4.65, -74.1], 11);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 19,
        }).addTo(mapRef.current);
      }
      if (geoRef.current) {
        geoRef.current.remove();
        geoRef.current = null;
      }

      // Intenta cada URL candidata (local primero).
      let data: any = null;
      for (const url of source.urls) {
        try {
          const r = await fetch(url);
          if (r.ok) { data = await r.json(); break; }
        } catch { /* siguiente */ }
      }
      if (cancelled) return;
      if (!data) { setStatus("error"); return; }

      geoRef.current = L.geoJSON(data, {
        style: (f: any) => styleFor(featureName(f.properties ?? {}, source.nameKeys)),
        onEachFeature: (f: any, layer: any) => {
          const name = featureName(f.properties ?? {}, source.nameKeys);
          const code = featureCode(f.properties ?? {}, source.codeKeys);
          layer.bindTooltip(name, { sticky: true });
          layer.on("mouseover", () => layer.setStyle({ weight: 3, fillOpacity: 0.7 }));
          layer.on("mouseout", () => layer.setStyle(styleFor(name)));
          layer.on("click", () => onSelectRef.current(name, code, source.tipo));
        },
      }).addTo(mapRef.current);

      try {
        mapRef.current.fitBounds(geoRef.current.getBounds(), { padding: [20, 20] });
      } catch { /* sin bounds */ }
      setStatus("ready");
    })();

    return () => { cancelled = true; };
  }, [source]);

  // Recolorea cuando cambian los conteos de tareas.
  useEffect(() => {
    if (geoRef.current) {
      geoRef.current.eachLayer((layer: any) => {
        const name = featureName(layer.feature?.properties ?? {}, source.nameKeys);
        layer.setStyle(styleFor(name));
      });
    }
  }, [highlight, source]);

  return (
    // `isolate z-0`: encierra los z-index internos de Leaflet (paneles ~400,
    // controles ~1000) en su propio contexto de apilamiento para que no se
    // pinten por encima del topbar ni de la barra de navegación.
    <div className="relative isolate z-0 overflow-hidden rounded-xl">
      <div ref={elRef} className="h-[520px] w-full rounded-xl border" />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/60 text-sm text-muted-foreground">
          Cargando mapa…
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-x-0 bottom-0 m-2 rounded-lg border bg-background/95 p-3 text-xs text-muted-foreground shadow">
          No se pudo cargar la capa <b>{source.label}</b>. Coloca el archivo en{" "}
          <code>public{source.urls[0]}</code> para verla con detalle. Puedes seguir
          usando la lista de áreas para crear y ver tareas.
        </div>
      )}
    </div>
  );
}
