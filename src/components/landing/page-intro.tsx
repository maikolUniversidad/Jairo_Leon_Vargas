import { MarcaBar } from "@/components/marca";
import { cn } from "@/lib/utils";

/**
 * Encabezado de página pública con la franja de marca — mantiene el mismo
 * ritmo de campaña en todo el sitio.
 */
export function PageIntro({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-10 max-w-2xl", className)}>
      {eyebrow && (
        <div className="mb-3 flex items-center gap-3">
          <MarcaBar className="h-1 w-10" />
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            {eyebrow}
          </span>
        </div>
      )}
      <h1 className="text-3xl font-black md:text-4xl">{title}</h1>
      {description && <p className="mt-3 text-muted-foreground">{description}</p>}
    </header>
  );
}
