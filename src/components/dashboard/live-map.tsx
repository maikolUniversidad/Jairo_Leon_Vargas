"use client";

import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface MapPerson {
  id: string;
  name: string;
  lat: number;
  lng: number;
  updated_at?: string;
}
export interface MapDestination {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const BOGOTA: [number, number] = [4.711, -74.0721];

let leafletPromise: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject();
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve((window as any).L);
    script.onerror = () => reject(new Error("No se pudo cargar el mapa."));
    document.body.appendChild(script);
  });
  return leafletPromise;
}

function personIcon(L: any, name: string) {
  const ini = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return L.divIcon({
    className: "",
    html: `<div style="background:#0e7490;color:#fff;border:2px solid #fff;border-radius:9999px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font:600 11px sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.4)">${ini}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}
function destIcon(L: any) {
  return L.divIcon({
    className: "",
    html: `<div style="background:#dc2626;color:#fff;border:2px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);width:26px;height:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.4)"><span style="transform:rotate(45deg);font:600 13px sans-serif">★</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  });
}

export function LiveMap({
  people,
  destinations = [],
  trail = [],
  pickMode = false,
  onPick,
}: {
  people: MapPerson[];
  destinations?: MapDestination[];
  trail?: [number, number][];
  pickMode?: boolean;
  onPick?: (lat: number, lng: number) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [error, setError] = useState(false);

  // Inicializa el mapa una vez.
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !elRef.current || mapRef.current) return;
        LRef.current = L;
        const map = L.map(elRef.current).setView(BOGOTA, 11);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 19,
        }).addTo(map);
        layerRef.current = L.layerGroup().addTo(map);
        map.on("click", (e: any) => onPickRef.current?.(e.latlng.lat, e.latlng.lng));
        mapRef.current = map;
      })
      .catch(() => setError(true));
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Cursor según modo "fijar destino".
  useEffect(() => {
    if (elRef.current) elRef.current.style.cursor = pickMode ? "crosshair" : "";
  }, [pickMode]);

  // Redibuja marcadores cuando cambian los datos.
  useEffect(() => {
    const L = LRef.current;
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!L || !layer || !map) return;
    layer.clearLayers();
    const pts: [number, number][] = [];

    if (trail.length > 1) {
      L.polyline(trail, { color: "#0e7490", weight: 3, opacity: 0.6, dashArray: "4 6" }).addTo(layer);
      for (const t of trail) pts.push(t);
    }

    for (const p of people) {
      const ts = p.updated_at ? new Date(p.updated_at).toLocaleTimeString() : "";
      L.marker([p.lat, p.lng], { icon: personIcon(L, p.name) })
        .bindPopup(`<b>${p.name}</b>${ts ? `<br/>Actualizado: ${ts}` : ""}`)
        .addTo(layer);
      pts.push([p.lat, p.lng]);
    }
    for (const d of destinations) {
      L.marker([d.lat, d.lng], { icon: destIcon(L) })
        .bindPopup(`<b>Destino:</b> ${d.label}`)
        .addTo(layer);
      pts.push([d.lat, d.lng]);
    }
    if (pts.length === 1) map.setView(pts[0], 15);
    else if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40], maxZoom: 16 });
  }, [people, destinations, trail]);

  if (error) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-xl border bg-muted/30 text-sm text-muted-foreground">
        No se pudo cargar el mapa. Revisa tu conexión.
      </div>
    );
  }

  return <div ref={elRef} className="h-[420px] w-full rounded-xl border" />;
}
