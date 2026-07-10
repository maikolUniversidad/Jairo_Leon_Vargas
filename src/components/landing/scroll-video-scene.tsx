"use client";

import { useEffect, useRef, useState } from "react";

export interface SceneKeyframe {
  at: number;
  title: string;
  subtitle?: string;
  audioUrl?: string;
}

interface ScrollVideoSceneProps {
  videoSrcPortrait: string;
  videoSrcLandscape?: string;
  keyframes?: SceneKeyframe[];
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
  const videoRef   = useRef<HTMLVideoElement>(null);

  const targetProgress = useRef(0);
  const lastProgress   = useRef(-1);       // ← detectar cambio real
  const rafId          = useRef<number>(0);
  const lastKfAt       = useRef<number | null>(null);
  const audioRef       = useRef<HTMLAudioElement | null>(null);

  const [activeKf,  setActiveKf]  = useState<SceneKeyframe | null>(null);
  const [kfVisible, setKfVisible] = useState(false);

  /* ─── RAF loop: solo actualiza currentTime cuando el progreso cambió ─── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.load();

    const tick = () => {
      rafId.current = requestAnimationFrame(tick);
      if (!video.duration) return;

      const p = targetProgress.current;
      // Evita actualizar si no hubo cambio (≥0.1 ms de video = ~0.00001 en escala)
      if (Math.abs(p - lastProgress.current) < 0.0001) return;
      lastProgress.current = p;

      // Nunca setear exactamente duration — algunos browsers lo tratan como "ended"
      video.currentTime = Math.min(p * video.duration, video.duration - 0.04);
    };

    rafId.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId.current);
  }, []);

  /* ─── Scroll: solo escribe targetProgress, cero DOM ─── */
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const THRESHOLD = 0.06;
    const sorted = [...keyframes].sort((a, b) => a.at - b.at);

    const onScroll = () => {
      const rect = wrapper.getBoundingClientRect();
      const wh   = window.innerHeight;
      if (rect.top >= wh || rect.bottom <= 0) return;

      // El scroll "útil" empieza cuando rect.top < 0 y termina cuando rect.bottom = wh
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
            const a = new Audio(hit.audioUrl);
            audioRef.current = a;
            a.play().catch(() => {});
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

  /* ─── Rotación portrait ↔ landscape ─── */
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

  const initialSrc =
    typeof window !== "undefined" && !isPortrait() && videoSrcLandscape
      ? videoSrcLandscape
      : videoSrcPortrait;

  return (
    <div
      ref={wrapperRef}
      className="relative w-full"
      style={{ height: `${scrollMultiplier * 100}vh` }}
    >
      <div className="sticky top-0 h-[100dvh] w-full overflow-hidden bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={initialSrc}
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Overlay texto */}
        <div
          aria-live="polite"
          className={[
            "pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center",
            "transition-opacity duration-700",
            kfVisible && activeKf ? "opacity-100" : "opacity-0",
          ].join(" ")}
        >
          {activeKf && (
            <div className="max-w-lg">
              <h2
                className="text-balance text-3xl font-black text-white sm:text-4xl md:text-5xl"
                style={{ textShadow: "0 2px 24px rgba(0,0,0,0.95), 0 0 48px rgba(0,0,0,0.7)" }}
              >
                {activeKf.title}
              </h2>
              {activeKf.subtitle && (
                <p
                  className="mt-3 text-base font-semibold text-white/90 sm:text-lg"
                  style={{ textShadow: "0 1px 12px rgba(0,0,0,0.85)" }}
                >
                  {activeKf.subtitle}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-background/70 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </div>
    </div>
  );
}
