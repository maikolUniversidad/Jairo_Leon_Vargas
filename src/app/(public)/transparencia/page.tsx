import type { Metadata } from "next";

export const metadata: Metadata = { title: "Transparencia" };

export default function TransparenciaPage() {
  return (
    <div className="container max-w-3xl py-12 md:py-16">
      <h1 className="text-3xl font-bold">Transparencia</h1>
      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
        Información de transparencia y acceso a la información pública. Si este
        canal opera como sede institucional, aplicará la Ley 1712 de 2014. [Sección
        pendiente de definir según naturaleza jurídica del canal.]
      </p>
    </div>
  );
}
