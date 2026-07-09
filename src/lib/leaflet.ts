/* eslint-disable @typescript-eslint/no-explicit-any */
// Carga Leaflet desde CDN una sola vez (compartido por los mapas del dashboard).

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

let leafletPromise: Promise<any> | null = null;

export function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
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
