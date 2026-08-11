"use client";

import { useEffect, useRef, useState } from "react";
import { Clapperboard } from "lucide-react";

/** Cada cuánto pasa a la siguiente imagen mientras el cursor está encima. */
const MS_POR_IMAGEN = 1400;

/**
 * Portada de una cobertura: un carrusel del material ya subido.
 *
 * Rota solo mientras el cursor está encima (o la tarjeta tiene foco), no sola.
 * Con veinte coberturas en pantalla, veinte carruseles girando a la vez marean
 * y disparan veinte peticiones simultáneas al proxy de miniaturas de Drive.
 * Quieto se ve como una portada; al pasar por encima, muestra lo que hay dentro.
 */
export function CoberturaPortada({
  imagenes,
  nombre,
}: {
  imagenes: string[];
  nombre: string;
}) {
  const [i, setI] = useState(0);
  const [activo, setActivo] = useState(false);
  /** Cuáles ya se pidieron: solo se carga la actual y la siguiente. */
  const [cargadas, setCargadas] = useState<Set<number>>(() => new Set([0]));
  const reloj = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!activo || imagenes.length < 2) return;
    reloj.current = setInterval(() => setI((p) => (p + 1) % imagenes.length), MS_POR_IMAGEN);
    return () => {
      if (reloj.current) clearInterval(reloj.current);
      reloj.current = null;
    };
  }, [activo, imagenes.length]);

  // Se precarga la siguiente para que el cambio no parpadee.
  useEffect(() => {
    setCargadas((prev) => {
      const siguiente = (i + 1) % imagenes.length;
      if (prev.has(i) && prev.has(siguiente)) return prev;
      const s = new Set(prev);
      s.add(i);
      s.add(siguiente);
      return s;
    });
  }, [i, imagenes.length]);

  if (imagenes.length === 0) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-lg bg-muted/50">
        <Clapperboard className="size-7 text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <div
      className="relative aspect-[16/9] overflow-hidden rounded-lg bg-muted/50"
      onMouseEnter={() => setActivo(true)}
      onMouseLeave={() => {
        setActivo(false);
        setI(0);
      }}
      onFocus={() => setActivo(true)}
      onBlur={() => setActivo(false)}
    >
      {imagenes.map((src, idx) =>
        cargadas.has(idx) ? (
          // eslint-disable-next-line @next/next/no-img-element -- pasa por el proxy propio, que ya devuelve el ancho pedido
          <img
            key={src}
            src={src}
            alt={idx === 0 ? `Material de ${nombre}` : ""}
            loading="lazy"
            aria-hidden={idx !== i}
            className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${
              idx === i ? "opacity-100" : "opacity-0"
            }`}
          />
        ) : null,
      )}

      {imagenes.length > 1 && (
        <>
          <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1">
            {imagenes.map((src, idx) => (
              <span
                key={src}
                className={`size-1.5 rounded-full transition ${
                  idx === i ? "bg-white" : "bg-white/45"
                }`}
              />
            ))}
          </div>
          <span className="absolute right-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
            {imagenes.length}
          </span>
        </>
      )}
    </div>
  );
}
