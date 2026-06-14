import type { Metadata } from "next";

export const metadata: Metadata = { title: "Términos de uso" };

export default function TerminosPage() {
  return (
    <div className="container max-w-3xl py-12 md:py-16">
      <h1 className="text-3xl font-bold">Términos de uso</h1>
      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
        Al usar este sitio aceptas los presentes términos. El contenido tiene
        fines informativos y de participación ciudadana. [Texto pendiente de
        revisión jurídica.]
      </p>
    </div>
  );
}
