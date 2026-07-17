import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Logo oficial "JAIRO LEÓN VARGAS" (PNG · Jairo Morado, servido a 800×219;
 * original en public/Logos/). Escala por altura: pasa `className="h-10"`
 * (o la que corresponda) para fijar el tamaño.
 */
export function LogoJLV({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo-jlv.png"
      alt="Jairo León Vargas"
      width={800}
      height={219}
      priority={priority}
      className={cn("h-10 w-auto", className)}
    />
  );
}

/**
 * Franja multicolor — el elemento firma de la marca Jairo León Vargas.
 * Orden tomado del logo: naranja · azul · rojo · verde · morado.
 */
export function MarcaBar({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block w-full rounded-full bg-franja", className)} />;
}

/**
 * Logotipo "JAIRO / LEÓN VARGAS" con la franja de marca.
 * El color del texto se hereda del contenedor (usar text-white sobre fondos oscuros).
 */
export function Wordmark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "md" | "lg";
}) {
  const big = size === "lg";
  return (
    <span className={cn("inline-flex flex-col leading-none", className)}>
      <span
        className={cn(
          "font-black uppercase tracking-tight",
          big ? "text-4xl sm:text-5xl" : "text-lg",
        )}
      >
        Jairo
      </span>
      <span
        className={cn(
          "font-semibold uppercase tracking-[0.2em]",
          big ? "mt-0.5 text-sm sm:text-base" : "text-[10px]",
        )}
      >
        León Vargas
      </span>
      <MarcaBar className={cn(big ? "mt-2 h-1.5 w-40 sm:w-56" : "mt-1.5 h-[3px] w-24")} />
    </span>
  );
}
