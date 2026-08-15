"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Loader2, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { uploadEvidencia } from "@/lib/upload-evidencia";
import { addEvidencia } from "@/actions/inventario";
import type { MomentoEvidencia } from "@/lib/inventario-shared";

/**
 * Captura o sube una evidencia (foto/video) de un equipo. En móvil, el atributo
 * `capture` abre la cámara directamente para grabar cómo se recibe o se entrega.
 * Sube al bucket `inventario` y registra la referencia con `addEvidencia`.
 */
export function EvidenciaUploader({
  equipoId,
  momento,
  prestamoId = null,
  novedadId = null,
  onUploaded,
  size = "sm",
}: {
  equipoId: string;
  momento: MomentoEvidencia;
  prestamoId?: string | null;
  novedadId?: string | null;
  onUploaded?: () => void;
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLInputElement>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [, start] = useTransition();

  const manejar = async (file: File | undefined, tipo: "video" | "foto") => {
    if (!file) return;
    setSubiendo(true);
    try {
      const up = await uploadEvidencia(equipoId, file);
      if (!up.ok || !up.path) {
        toast.error(up.message ?? "No se pudo subir.");
        return;
      }
      const res = await addEvidencia({
        equipo_id: equipoId,
        prestamo_id: prestamoId,
        novedad_id: novedadId,
        momento,
        tipo_media: tipo,
        storage_path: up.path,
        url: up.url,
        mime: up.mime,
      });
      if (res.ok) {
        toast.success("Evidencia guardada.");
        onUploaded?.();
        start(() => router.refresh());
      } else {
        toast.error(res.message);
      }
    } finally {
      setSubiendo(false);
      if (videoRef.current) videoRef.current.value = "";
      if (fotoRef.current) fotoRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={videoRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => manejar(e.target.files?.[0], "video")}
      />
      <input
        ref={fotoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => manejar(e.target.files?.[0], "foto")}
      />
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled={subiendo}
        onClick={() => videoRef.current?.click()}
      >
        {subiendo ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Video className="mr-1 size-4" />}
        Video
      </Button>
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled={subiendo}
        onClick={() => fotoRef.current?.click()}
      >
        <Camera className="mr-1 size-4" /> Foto
      </Button>
    </div>
  );
}
