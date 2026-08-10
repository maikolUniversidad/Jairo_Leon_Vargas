"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Grabación de voz del navegador. No sabe nada de coberturas ni de preguntas:
 * graba y devuelve el blob.
 *
 * Mismo camino que usa el Asistente IA en ChatComposer: getUserMedia →
 * MediaRecorder → FormData a /api/ia/transcribe.
 */

export interface GrabacionLista {
  blob: Blob;
  duracionSeg: number;
}

/** `MediaRecorder` no existe en SSR ni en navegadores viejos. */
export function grabacionSoportada(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export function useGrabadora() {
  const [grabando, setGrabando] = useState(false);
  const [permisoDenegado, setPermisoDenegado] = useState(false);
  const [segundos, setSegundos] = useState(0);

  const recorder = useRef<MediaRecorder | null>(null);
  const trozos = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const inicio = useRef(0);
  const reloj = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Suelta el micrófono. Si no se hace, el indicador del navegador se queda
   * encendido aunque ya no se esté grabando, y eso asusta con razón.
   */
  const soltar = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (reloj.current) {
      clearInterval(reloj.current);
      reloj.current = null;
    }
  }, []);

  // Si el componente se desmonta a mitad de grabación, el micrófono se libera.
  useEffect(() => soltar, [soltar]);

  const iniciar = useCallback(async (): Promise<boolean> => {
    if (!grabacionSoportada()) return false;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      trozos.current = [];
      const mr = new MediaRecorder(s);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) trozos.current.push(e.data);
      };
      recorder.current = mr;
      mr.start();
      inicio.current = Date.now();
      setSegundos(0);
      reloj.current = setInterval(
        () => setSegundos(Math.floor((Date.now() - inicio.current) / 1000)),
        1000,
      );
      setGrabando(true);
      setPermisoDenegado(false);
      return true;
    } catch {
      // Tanto negar el permiso como no tener micrófono caen aquí.
      setPermisoDenegado(true);
      soltar();
      return false;
    }
  }, [soltar]);

  const detener = useCallback((): Promise<GrabacionLista | null> => {
    const mr = recorder.current;
    if (!mr || mr.state === "inactive") {
      soltar();
      setGrabando(false);
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      mr.onstop = () => {
        const duracionSeg = Math.max(1, Math.round((Date.now() - inicio.current) / 1000));
        const blob = new Blob(trozos.current, { type: mr.mimeType || "audio/webm" });
        recorder.current = null;
        soltar();
        setGrabando(false);
        resolve(blob.size > 0 ? { blob, duracionSeg } : null);
      };
      mr.stop();
    });
  }, [soltar]);

  return { grabando, permisoDenegado, segundos, iniciar, detener, soltar };
}

/**
 * Manda el audio a Whisper y devuelve el texto.
 * Lanza con un mensaje entendible: quien llama decide si reintenta sin volver a
 * grabar, que es lo que hace el cuestionario.
 */
export async function transcribir(blob: Blob): Promise<string> {
  const fd = new FormData();
  fd.append("audio", blob, "respuesta.webm");

  const res = await fetch("/api/ia/transcribe", { method: "POST", body: fd });
  const data = (await res.json().catch(() => ({}))) as { texto?: string; error?: string };
  if (!res.ok) throw new Error(data.error || "No se pudo transcribir el audio.");
  return (data.texto ?? "").trim();
}
