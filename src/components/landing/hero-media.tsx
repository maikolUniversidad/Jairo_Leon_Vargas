"use client";

import { useState } from "react";

/**
 * Fondo del intro: video difuminado a pantalla completa con capa de color de
 * marca para legibilidad. Si no hay video (o falla la carga) queda un fondo
 * "ambiente" animado que imita un video difuminado —así el hero siempre luce bien.
 */
export function HeroMedia({ videoUrl }: { videoUrl?: string }) {
  const [videoOk, setVideoOk] = useState(true);

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {/* Base ambiente animada (fallback y color de marca) */}
      <div className="absolute inset-0 bg-marca-hero" />
      <div className="absolute -left-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-marca-morado/40 blur-3xl motion-safe:animate-[drift_16s_ease-in-out_infinite]" />
      <div className="absolute -bottom-28 -right-16 h-[26rem] w-[26rem] rounded-full bg-marca-naranja/25 blur-3xl motion-safe:animate-[drift_22s_ease-in-out_infinite_reverse]" />
      <div className="absolute left-1/3 top-1/4 h-72 w-72 rounded-full bg-marca-vinotinto/30 blur-3xl motion-safe:animate-[drift_19s_ease-in-out_infinite]" />

      {/* Video difuminado (opcional: perfil.hero_video_url o /hero.mp4) */}
      {videoUrl && videoOk && (
        <video
          className="absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 scale-110 object-cover blur-[7px]"
          src={videoUrl}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setVideoOk(false)}
        />
      )}

      {/* Capas de contraste para el texto */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1030]/85 via-[#241640]/72 to-[#2a3883]/62" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#150d24]/85 via-transparent to-transparent" />
    </div>
  );
}
