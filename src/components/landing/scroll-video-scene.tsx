"use client";

import { useEffect, useRef, useState } from "react";

export interface SceneKeyframe {
  /** Posición normalizada [0,1] en la duración del video */
  at: number;
  title: string;
  subtitle?: string;
  /** Ruta del audio a reproducir al entrar en este keyframe */
  audioUrl?: string;
}

interface ScrollVideoSceneProps {
  /** Video principal (portrait / móvil) */
  videoSrcPortrait: string;
  /** Video alternativo (landscape / escritorio). Usa el portrait si no se pasa. */
  videoSrcLandscape?: string;
  keyframes?: SceneKeyframe[];
  /** Cuántos viewports ocupa el área de scroll (default 3) */
  scrollMultiplier?: number;
}

const DEFAULT_KEYFRAMES: SceneKeyframe[] = [
  { at: 0, title: "Una historia de territorio", subtitle: "Desde los barrios de Bogotá" },
  { at: 1, title: "Construyendo juntos",        subtitle: "Con la gente y para la gente" },
];

function isPortrait() {
  if (typeof window === "undefined") return true;
  return window.innerHeight >= window.innerWidth;
}

export function ScrollVideoScene({
  videoSrcPortrait,
  videoSrcLandscape,
  keyframes = DEFAULT_KEYFRAMES,
  scrollMultiplier = 3,
}: ScrollVideoSceneProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const videoRef  = useRef<HTMLVideoElement>(null);

  /* Progreso objetivo — actualizado desde scroll, leído en RAF */
  const targetProgress = useRef(0);
  const rafId          = useRef<number>(0);
  const lastKfAt       = useRef<number | null>(null);
  const audioRef       = useRef<HTMLAudioElement | null>(null);

  const [activeKf,  setActiveKf]  = useState<SceneKeyframe | null>(null);
  const [kfVisible, setKfVisible] = useState(false);

  /* ─── RAF loop: el único lugar donde se toca currentTime ─── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tick = () => {
      rafId.current = requestAnimationFrame(tick);
      if (!video.duration) return;
      video.currentTime = targetProgress.current * video.duration;
    };

    /* Activa el video para iOS (requiere interacción o carga previa) */
    video.load();
    rafId.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId.current);
  }, []);

  /* ─── Scroll: solo actualiza targetProgress y estado UI ─── */
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const THRESHOLD = 0.06;
    const sorted = [...keyframes].sort((a, b) => a.at - b.at);

    const onScroll = () => {
      const rect = wrapper.getBoundingClientRect();
      const wh   = window.innerHeight;
      if (rect.top >= wh || rect.bottom <= 0) return;

      const total   = rect.height - wh;
      const scrolled = Math.max(0, -rect.top);
      const p        = Math.min(1, scrolled / total);
      targetProgress.current = p;

      /* Keyframe activo */
      let hit: SceneKeyframe | null = null;
      for (const kf of sorted) {
        if (Math.abs(p - kf.at) < THRESHOLD) { hit = kf; break; }
      }

      if (hit) {
        if (hit.at !== lastKfAt.current) {
          lastKfAt.current = hit.at;
          if (hit.audioUrl) {
            audioRef.current?.pause();
            const audio = new Audio(hit.audioUrl);
            audioRef.current = audio;
            audio.play().catch(() => {});
          }
        }
        setActiveKf(hit);
        setKfVisible(true);
      } else {
        setKfVisible(false);
        lastKfAt.current = null;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [keyframes]);

  /* ─── Cambio portrait ↔ landscape al rotar ─── */
  useEffect(() => {
    if (!videoSrcLandscape) return;
    const video = videoRef.current;
    if (!video) return;

    const onOrient = () => {
      const src = isPortrait() ? videoSrcPortrait : videoSrcLandscape!;
      if (!video.src.endsWith(src)) {
        const p = video.duration ? video.currentTime / video.duration : 0;
        video.src = src;
        video.load();
        video.addEventListener("loadedmetadata", () => {
          video.currentTime = p * video.duration;
        }, { once: true });
      }
    };

    window.addEventListener("resize", onOrient, { passive: true });
    return () => window.removeEventListener("resize", onOrient);
  }, [videoSrcPortrait, videoSrcLandscape]);

  const src = (typeof window !== "undefined" && !isPortrait() && videoSrcLandscape)
    ? videoSrcLandscape
    : videoSrcPortrait;

  return (
    <div
      ref={wrapperRef}
      className="relative w-full"
      style={{ height: `${scrollMultiplier * 100}vh` }}
    >
      {/* Zona sticky: ocupa 100vh mientras el usuario scrollea por el wrapper */}
      <div className="sticky top-0 h-[100dvh] w-full overflow-hidden bg-black">

        {/* Video nativo — object-cover se encarga del recorte en cualquier ratio */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={src}
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ willChange: "contents" }}
        />

        {/* Overlay texto en keyframes */}
        <div
          aria-live="polite"
          className={[
            "pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-5 text-center",
            "transition-opacity duration-700",
            kfVisible && activeKf ? "opacity-100" : "opacity-0",
          ].join(" ")}
        >
          {activeKf && (
            <div className="max-w-lg">
              <h2
                className="text-balance text-3xl font-black text-white sm:text-4xl md:text-5xl lg:text-6xl"
                style={{ textShadow: "0 2px 20px rgba(0,0,0,0.9), 0 0 40px rgba(0,0,0,0.6)" }}
              >
                {activeKf.title}
              </h2>
              {activeKf.subtitle && (
                <p
                  className="mt-3 text-base font-semibold text-white/90 sm:text-lg md:text-xl"
                  style={{ textShadow: "0 1px 10px rgba(0,0,0,0.8)" }}
                >
                  {activeKf.subtitle}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Gradientes de borde para fusionar con las secciones adyacentes */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-background/80 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </div>
    </div>
  );
}
