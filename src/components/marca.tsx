import { cn } from "@/lib/utils";

/**
 * Los cinco colores firma de la marca Jairo León Vargas, en el orden del logo
 * (los puntos bajo "Congresista" y la franja multicolor).
 * Fuente única de verdad: la usan el logo, la franja y el Manual de marca.
 */
export const MARCA_PUNTOS = [
  { nombre: "Amarillo", hex: "#f49a20" },
  { nombre: "Azul", hex: "#2a3883" },
  { nombre: "Rojo", hex: "#e92025" },
  { nombre: "Verde", hex: "#35a74a" },
  { nombre: "Morado", hex: "#8e378e" },
] as const;

const FONT = "var(--font-sans), system-ui, sans-serif";

/** Fila de los 5 puntos de color, centrada en el ancho `width` a la altura `cy`. */
function Puntos({ cy, r, width, gap }: { cy: number; r: number; width: number; gap: number }) {
  const total = gap * (MARCA_PUNTOS.length - 1);
  const start = width / 2 - total / 2;
  return (
    <>
      {MARCA_PUNTOS.map((p, i) => (
        <circle key={p.nombre} cx={start + i * gap} cy={cy} r={r} fill={p.hex} />
      ))}
    </>
  );
}

/** Wordmark "JAIROLEÓN": JAIRO en negra + LEÓN en fina, hereda `currentColor`. */
function JairoLeon({
  x,
  y,
  size,
  length,
  anchor = "middle",
}: {
  x: number;
  y: number;
  size: number;
  length: number;
  anchor?: "start" | "middle";
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      textLength={length}
      lengthAdjust="spacingAndGlyphs"
      fill="currentColor"
      style={{ fontFamily: FONT, fontSize: size, letterSpacing: "-0.02em" }}
    >
      <tspan fontWeight={900}>JAIRO</tspan>
      <tspan fontWeight={300}>LEÓN</tspan>
    </text>
  );
}

export type LogoVariant = "full" | "compact" | "isotipo";

/**
 * Logo oficial "JAIRO LEÓN · Congresista" reconstruido en SVG (escalable y
 * consciente del tema: el texto hereda `currentColor`, así que se ve negro sobre
 * fondos claros y blanco sobre los oscuros; los puntos conservan su color).
 * Escala por altura: pasa `className="h-10"` (u otra) para fijar el tamaño.
 *
 * Vistas (`variant`):
 * - `full` (por defecto): lockup completo — JAIRO LEÓN + CONGRESISTA + puntos.
 * - `compact`: JAIRO LEÓN + puntos, sin bajada. Para encabezados pequeños.
 * - `isotipo`: solo los cinco puntos. Para favicon, avatar o espacios mínimos.
 */
export function LogoJLV({
  className,
  variant = "full",
  title = "Jairo León · Congresista",
  /** Compatibilidad con la firma anterior (next/image); en SVG no aplica. */
  priority: _priority,
}: {
  className?: string;
  variant?: LogoVariant;
  title?: string;
  priority?: boolean;
}) {
  const common = {
    role: "img" as const,
    "aria-label": title,
    className: cn("w-auto", className),
    style: { overflow: "visible" as const },
  };

  if (variant === "isotipo") {
    return (
      <svg viewBox="0 0 116 24" className={cn("h-6 w-auto", className)} role="img" aria-label={title}>
        <title>{title}</title>
        <Puntos cy={12} r={8} width={116} gap={22} />
      </svg>
    );
  }

  if (variant === "compact") {
    return (
      <svg viewBox="0 0 300 94" {...common} className={cn("h-10 w-auto", className)}>
        <title>{title}</title>
        <JairoLeon x={150} y={58} size={64} length={296} />
        <Puntos cy={82} r={5} width={300} gap={20} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 340 118" {...common} className={cn("h-14 w-auto", className)}>
      <title>{title}</title>
      <JairoLeon x={170} y={60} size={66} length={336} />
      <text
        x={170}
        y={90}
        textAnchor="middle"
        textLength={176}
        lengthAdjust="spacingAndGlyphs"
        fill="currentColor"
        style={{ fontFamily: FONT, fontSize: 15, fontWeight: 400, letterSpacing: "0.34em" }}
      >
        CONGRESISTA
      </text>
      <Puntos cy={108} r={4.8} width={340} gap={19} />
    </svg>
  );
}

/**
 * Franja multicolor — el elemento firma de la marca Jairo León Vargas.
 * Orden tomado del logo: amarillo · azul · rojo · verde · morado.
 */
export function MarcaBar({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block w-full rounded-full bg-franja", className)} />;
}

/**
 * Lockup tipográfico "JAIRO LEÓN / Congresista" con la franja de marca.
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
      <span className={cn("font-black uppercase tracking-tight", big ? "text-4xl sm:text-5xl" : "text-lg")}>
        Jairo León
      </span>
      <span
        className={cn(
          "font-medium uppercase tracking-[0.34em]",
          big ? "mt-1 text-sm sm:text-base" : "mt-0.5 text-[9px]",
        )}
      >
        Congresista
      </span>
      <MarcaBar className={cn(big ? "mt-2 h-1.5 w-40 sm:w-56" : "mt-1.5 h-[3px] w-24")} />
    </span>
  );
}
