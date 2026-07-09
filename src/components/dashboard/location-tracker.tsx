"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MapPin, X } from "lucide-react";

import { updateMyLocation, setLocationSharing, getMySharing } from "@/actions/ubicaciones";

// Evento para activar/desactivar desde cualquier parte (p. ej. la página de Ubicaciones).
export const LOCATION_TOGGLE_EVENT = "utl:set-location-sharing";
export const LOCATION_STATE_EVENT = "utl:location-sharing-changed";

const MIN_INTERVAL_MS = 12_000; // no guardar más seguido que esto

/**
 * Captura la ubicación del usuario mientras "compartir" esté activo y la
 * sincroniza con la base. Se monta una sola vez en el layout, por lo que sigue
 * funcionando al navegar entre módulos (segundo plano dentro de la web, mientras
 * la pestaña siga abierta). El seguimiento con la pantalla apagada requiere una
 * app nativa/PWA dedicada.
 */
export function LocationTracker() {
  const [sharing, setSharing] = useState(false);
  const watchId = useRef<number | null>(null);
  const lastSent = useRef(0);

  // Estado inicial desde la base.
  useEffect(() => {
    getMySharing().then((on) => {
      if (on) setSharing(true);
    });
  }, []);

  // Escucha solicitudes de encendido/apagado desde otros componentes.
  useEffect(() => {
    const handler = (e: Event) => {
      const active = (e as CustomEvent<boolean>).detail;
      void toggle(active);
    };
    window.addEventListener(LOCATION_TOGGLE_EVENT, handler);
    return () => window.removeEventListener(LOCATION_TOGGLE_EVENT, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Arranca/detiene la captura cuando cambia `sharing`.
  useEffect(() => {
    if (!sharing) {
      if (watchId.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      return;
    }
    if (!("geolocation" in navigator)) {
      toast.error("Este dispositivo no permite geolocalización.");
      setSharing(false);
      return;
    }
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSent.current < MIN_INTERVAL_MS) return;
        lastSent.current = now;
        void updateMyLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        });
      },
      (err) => {
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Permiso de ubicación denegado."
            : "No se pudo obtener la ubicación.",
        );
        setSharing(false);
        void setLocationSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );

    return () => {
      if (watchId.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [sharing]);

  // Avisa a la UI del estado actual.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(LOCATION_STATE_EVENT, { detail: sharing }));
  }, [sharing]);

  async function toggle(active: boolean) {
    setSharing(active);
    const res = await setLocationSharing(active);
    if (!res.ok) {
      toast.error(res.message);
      setSharing(!active);
    }
  }

  if (!sharing) return null;

  return (
    <div className="fixed bottom-28 left-4 z-50 flex items-center gap-2 rounded-full border bg-background/95 px-3 py-1.5 text-xs shadow-lg backdrop-blur lg:bottom-4">
      <span className="relative flex size-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
      </span>
      <MapPin className="size-3.5 text-emerald-600" />
      Compartiendo ubicación
      <button
        type="button"
        aria-label="Dejar de compartir"
        onClick={() => toggle(false)}
        className="ml-1 rounded-full p-0.5 hover:bg-muted"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
