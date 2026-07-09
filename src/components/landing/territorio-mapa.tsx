"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, MapPin, MapPinned, Megaphone, Lightbulb } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LOCALIDADES } from "@/lib/validations";
import { loadLeaflet } from "@/lib/leaflet";
import {
  GEO_SOURCES,
  featureName,
  normalizeName,
} from "@/lib/geo-sources";

/* eslint-disable @typescript-eslint/no-explicit-any */

const SOURCE = GEO_SOURCES.bogota_localidades;

// Paleta de marca (Jairo León Vargas / Pacto Histórico).
const MARCA = { morado: "#8e378e", naranja: "#f49a20", azul: "#2a3883" };

const STYLE_BASE = { color: MARCA.azul, weight: 1.75, fillColor: MARCA.azul, fillOpacity: 0.12 };
const STYLE_HOVER = { color: MARCA.naranja, weight: 2.5, fillColor: MARCA.naranja, fillOpacity: 0.4 };
const STYLE_SELECTED = { color: MARCA.morado, weight: 3, fillColor: MARCA.morado, fillOpacity: 0.5 };

// Los polígonos vienen en MAYÚSCULAS y sin tildes ("CANDELARIA"); los mapeamos
// al nombre canónico de la app ("La Candelaria") para que el mapa, los chips y
// los enlaces a /participa queden sincronizados.
function resolveCanonical(raw: string): string {
  const n = normalizeName(raw);
  const exact = LOCALIDADES.find((l) => normalizeName(l) === n);
  if (exact) return exact;
  const partial = LOCALIDADES.find((l) => {
    const ln = normalizeName(l);
    return ln.includes(n) || n.includes(ln);
  });
  return partial ?? raw;
}

export function TerritorioMapa() {
  const localidades = useMemo(() => LOCALIDADES.filter((l) => l !== "Otra"), []);

  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const geoRef = useRef<any>(null);
  const layersByName = useRef<Map<string, any>>(new Map());

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [selected, setSelected] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);

  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selected;

  function styleFor(name: string) {
    if (
      selectedRef.current &&
      normalizeName(resolveCanonical(name)) === normalizeName(selectedRef.current)
    ) {
      return STYLE_SELECTED;
    }
    return STYLE_BASE;
  }

  // Inicializa Leaflet + capa de localidades una sola vez.
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    (async () => {
      const L = await loadLeaflet().catch(() => null);
      if (!L || cancelled || !elRef.current) { setStatus("error"); return; }

      const map = L.map(elRef.current, { scrollWheelZoom: false, attributionControl: true })
        .setView([4.61, -74.09], 11);
      mapRef.current = map;

      // Tiles claros (CartoDB Positron) para que resalten los polígonos de marca.
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap · © CARTO",
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      // Carga el GeoJSON (local primero, luego respaldo remoto).
      let data: any = null;
      for (const url of SOURCE.urls) {
        try {
          const r = await fetch(url);
          if (r.ok) { data = await r.json(); break; }
        } catch { /* siguiente candidato */ }
      }
      if (cancelled) return;
      if (!data) { setStatus("error"); return; }

      const geo = L.geoJSON(data, {
        style: (f: any) => styleFor(featureName(f.properties ?? {}, SOURCE.nameKeys)),
        onEachFeature: (f: any, layer: any) => {
          const canon = resolveCanonical(featureName(f.properties ?? {}, SOURCE.nameKeys));
          layersByName.current.set(normalizeName(canon), layer);
          // Etiqueta permanente con el nombre de la localidad (siempre visible).
          layer.bindTooltip(canon, {
            permanent: true,
            direction: "center",
            className: "territorio-label",
          });
          layer.on("mouseover", () => {
            if (!selectedRef.current || normalizeName(canon) !== normalizeName(selectedRef.current)) {
              layer.setStyle(STYLE_HOVER);
            }
          });
          layer.on("mouseout", () => layer.setStyle(styleFor(canon)));
          layer.on("click", () => selectLocalidad(canon, { fromMap: true }));
        },
      }).addTo(map);
      geoRef.current = geo;

      try {
        map.fitBounds(geo.getBounds(), { padding: [16, 16] });
      } catch { /* sin bounds */ }

      // Corrige el tamaño cuando el contenedor termina de montarse.
      setTimeout(() => map.invalidateSize(), 0);
      setStatus("ready");
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      geoRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Selecciona una localidad (desde el mapa o desde la lista) y la enfoca.
  function selectLocalidad(name: string, opts: { fromMap?: boolean } = {}) {
    setSelected(name);
    selectedRef.current = name;

    // Recolorea todas las capas para reflejar la selección.
    geoRef.current?.eachLayer((layer: any) => {
      const n = featureName(layer.feature?.properties ?? {}, SOURCE.nameKeys);
      layer.setStyle(styleFor(n));
    });

    // Vuela al polígono seleccionado.
    const layer = layersByName.current.get(normalizeName(name));
    if (layer && mapRef.current) {
      try {
        mapRef.current.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 13 });
      } catch { /* sin bounds */ }
      layer.bringToFront?.();
    }

    // Al elegir desde la lista, colapsa el desplegable en móvil y muestra el mapa.
    if (!opts.fromMap) setListOpen(false);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      {/* Mapa */}
      <div className="lg:col-span-3">
        <div className="relative overflow-hidden rounded-2xl border shadow-sm">
          <div ref={elRef} className="h-[420px] w-full sm:h-[520px] lg:h-[560px]" />

          {/* Etiqueta flotante */}
          <div className="pointer-events-none absolute right-3 top-3 z-[500] flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur">
            <MapPinned className="size-3.5 text-primary" />
            Haz clic en tu localidad
          </div>

          {status === "loading" && (
            <div className="absolute inset-0 z-[600] flex items-center justify-center bg-background/70 text-sm text-muted-foreground">
              Cargando mapa de Bogotá…
            </div>
          )}
          {status === "error" && (
            <div className="absolute inset-x-3 bottom-3 z-[600] rounded-lg border bg-background/95 p-3 text-xs text-muted-foreground shadow">
              No se pudieron cargar los límites de las localidades. Ejecuta{" "}
              <code>node scripts/fetch-geo.mjs</code> para descargarlos, o usa la
              lista de la derecha para elegir tu zona.
            </div>
          )}
        </div>
      </div>

      {/* Panel: selección + desplegable de localidades */}
      <aside className="lg:col-span-2">
        <div className="space-y-4 lg:sticky lg:top-24">
          {/* Detalle de la localidad seleccionada */}
          <SelectedPanel selected={selected} />

          {/* Desplegable con todas las localidades */}
          <div className="overflow-hidden rounded-2xl border">
            <button
              type="button"
              onClick={() => setListOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              aria-expanded={listOpen}
            >
              <span className="flex items-center gap-2 font-semibold">
                <MapPin className="size-4 text-primary" />
                {selected ? "Cambiar localidad" : "Ver las 20 localidades"}
              </span>
              <ChevronDown
                className={cn(
                  "size-5 shrink-0 text-muted-foreground transition-transform duration-200",
                  listOpen && "rotate-180",
                )}
              />
            </button>

            <div
              className={cn(
                "grid transition-all duration-300 ease-in-out",
                listOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <ul className="grid grid-cols-1 gap-1.5 border-t p-3 sm:grid-cols-2">
                  {localidades.map((loc) => {
                    const active = selected === loc;
                    return (
                      <li key={loc}>
                        <button
                          type="button"
                          onClick={() => selectLocalidad(loc)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                            active
                              ? "border-primary bg-primary/10 font-medium text-primary"
                              : "border-transparent hover:border-border hover:bg-muted/60",
                          )}
                        >
                          <MapPin
                            className={cn(
                              "size-4 shrink-0",
                              active ? "text-primary" : "text-muted-foreground",
                            )}
                          />
                          {loc}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function SelectedPanel({ selected }: { selected: string | null }) {
  if (!selected) {
    return (
      <div className="rounded-2xl border border-dashed p-6 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MapPinned className="size-6" />
        </span>
        <p className="mt-3 font-semibold">Elige tu localidad</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecciónala en el mapa o en la lista para proponer ideas y reportar
          problemáticas de tu barrio.
        </p>
      </div>
    );
  }

  const q = `?localidad=${encodeURIComponent(selected)}`;
  return (
    <div className="overflow-hidden rounded-2xl border shadow-sm">
      <div className="bg-marca-gradient px-5 py-4 text-white">
        <p className="text-xs font-medium uppercase tracking-wide text-white/80">
          Localidad seleccionada
        </p>
        <p className="flex items-center gap-2 text-xl font-bold">
          <MapPin className="size-5" />
          {selected}
        </p>
      </div>
      <div className="space-y-2 p-4">
        <p className="text-sm text-muted-foreground">
          ¿Qué quieres hacer por <span className="font-medium text-foreground">{selected}</span>?
        </p>
        <div className="grid gap-2">
          <Button asChild className="w-full justify-start">
            <Link href={`/participa${q}#propuesta`}>
              <Lightbulb className="size-4" /> Proponer una idea aquí
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full justify-start">
            <Link href={`/solicitudes${q}`}>
              <Megaphone className="size-4" /> Reportar una problemática
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
