"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export interface SceneKeyframe {
  /** Posición normalizada [0,1] en el video donde el texto aparece */
  at: number;
  title: string;
  subtitle?: string;
  /** URL del audio a reproducir al entrar al keyframe */
  audioUrl?: string;
}

interface ScrollVideoSceneProps {
  /** Video en modo retrato (móvil / vertical) */
  videoSrcPortrait: string;
  /** Video en modo paisaje (escritorio / horizontal). Si no se pasa, usa el mismo retrato. */
  videoSrcLandscape?: string;
  keyframes?: SceneKeyframe[];
  /** Cuántos viewports dura el scroll (default 3) */
  scrollMultiplier?: number;
}

const DEFAULT_KEYFRAMES: SceneKeyframe[] = [
  { at: 0, title: "Una historia de territorio", subtitle: "Desde los barrios de Bogotá" },
  { at: 1, title: "Construyendo juntos", subtitle: "Con la gente y para la gente" },
];

/* ─── helpers ─── */

/** Calcula el scale del plano Three.js para lograr object-fit:cover */
function getCoverScale(
  videoW: number,
  videoH: number,
  canvasW: number,
  canvasH: number,
): [number, number] {
  const videoAr = videoW / videoH;
  const canvasAr = canvasW / canvasH;
  if (canvasAr > videoAr) {
    // Canvas más ancho que el video → escala por ancho
    return [1, videoAr / canvasAr];
  } else {
    // Canvas más alto que el video → escala por alto
    return [canvasAr / videoAr, 1];
  }
}

function isPortrait() {
  if (typeof window === "undefined") return true;
  return window.innerHeight > window.innerWidth;
}

export function ScrollVideoScene({
  videoSrcPortrait,
  videoSrcLandscape,
  keyframes = DEFAULT_KEYFRAMES,
  scrollMultiplier = 3,
}: ScrollVideoSceneProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* Three.js refs */
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const textureRef = useRef<THREE.VideoTexture | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number>(0);

  /* UI state */
  const [activeKf, setActiveKf] = useState<SceneKeyframe | null>(null);
  const [kfVisible, setKfVisible] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastKfAt = useRef<number | null>(null);

  /* ─── Three.js setup ─── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    /* Renderer */
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    /* Escena y cámara ortográfica 2D */
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    cameraRef.current = camera;

    /* Geometría del plano — 2×2 para cubrir el clip space completo */
    const geometry = new THREE.PlaneGeometry(2, 2);

    /* Video — elige retrato o paisaje según orientación inicial */
    const portrait = isPortrait();
    const src = (!portrait && videoSrcLandscape) ? videoSrcLandscape : videoSrcPortrait;

    const video = document.createElement("video");
    video.src = src;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    videoRef.current = video;

    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    textureRef.current = texture;

    const material = new THREE.MeshBasicMaterial({ map: texture });
    const mesh = new THREE.Mesh(geometry, material);
    sceneRef.current.add(mesh);
    meshRef.current = mesh;

    /* Ajusta cover cuando el video carga sus dimensiones */
    const updateCover = () => {
      const vw = (video as HTMLVideoElement & { videoWidth: number }).videoWidth;
      const vh = (video as HTMLVideoElement & { videoHeight: number }).videoHeight;
      if (!vw || !vh) return;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      const [sx, sy] = getCoverScale(vw, vh, cw, ch);
      mesh.scale.set(1 / sx, 1 / sy, 1);
    };

    video.addEventListener("loadedmetadata", updateCover);

    /* Render loop */
    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      texture.needsUpdate = true;
      renderer.render(scene, camera);
    };
    render();

    /* Resize */
    const onResize = () => {
      if (!canvas.parentElement) return;
      const w = canvas.parentElement.clientWidth;
      const h = canvas.parentElement.clientHeight;
      renderer.setSize(w, h, false);
      updateCover();

      /* Cambia fuente de video al rotar dispositivo (si hay versión landscape) */
      if (videoSrcLandscape) {
        const newSrc = (isPortrait() ? videoSrcPortrait : videoSrcLandscape);
        if (video.src !== newSrc && !video.src.endsWith(newSrc)) {
          const progress = video.duration ? video.currentTime / video.duration : 0;
          video.src = newSrc;
          video.load();
          video.addEventListener("loadedmetadata", () => {
            video.currentTime = progress * video.duration;
            updateCover();
          }, { once: true });
        }
      }
    };
    window.addEventListener("resize", onResize);
    onResize();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
      video.removeEventListener("loadedmetadata", updateCover);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      texture.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoSrcPortrait, videoSrcLandscape]);

  /* ─── Scroll handler ─── */
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const onScroll = () => {
      const video = videoRef.current;
      const rect = wrapper.getBoundingClientRect();
      const wh = window.innerHeight;

      const isVisible = rect.top < wh && rect.bottom > 0;
      if (!isVisible || !video?.duration) return;

      const totalScroll = rect.height - wh;
      const scrolled = Math.max(0, -rect.top);
      const progress = Math.min(1, scrolled / totalScroll);

      video.currentTime = progress * video.duration;

      /* Detecta keyframe activo */
      const THRESHOLD = 0.06;
      const sortedKf = [...keyframes].sort((a, b) => a.at - b.at);
      let hit: SceneKeyframe | null = null;
      for (const kf of sortedKf) {
        if (Math.abs(progress - kf.at) < THRESHOLD) { hit = kf; break; }
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

  return (
    <div
      ref={wrapperRef}
      className="relative w-full"
      style={{ height: `${scrollMultiplier * 100}vh` }}
    >
      {/* Canvas sticky */}
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-black">
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: "100%", height: "100%" }}
        />

        {/* Overlay de texto en keyframes */}
        <div
          aria-live="polite"
          className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-5 text-center transition-opacity duration-700 ${
            kfVisible && activeKf ? "opacity-100" : "opacity-0"
          }`}
        >
          {activeKf && (
            <div className="max-w-xl">
              <h2 className="text-balance text-3xl font-black text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.85)] sm:text-4xl md:text-5xl lg:text-6xl">
                {activeKf.title}
              </h2>
              {activeKf.subtitle && (
                <p className="mt-3 text-lg font-semibold text-white/85 drop-shadow-[0_1px_8px_rgba(0,0,0,0.7)] sm:text-xl md:text-2xl">
                  {activeKf.subtitle}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Fade-out hacia la siguiente sección */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-background to-transparent" />
      </div>
    </div>
  );
}
