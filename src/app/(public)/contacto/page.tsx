import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Phone, MapPin } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/landing/page-intro";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Canales de contacto y atención.",
};

const CANALES = [
  { icon: Mail, label: "Correo", value: "[pendiente]", tono: "bg-marca-morado" },
  { icon: Phone, label: "Teléfono / WhatsApp", value: "[pendiente]", tono: "bg-marca-verde" },
  { icon: MapPin, label: "Bogotá D.C.", value: "Atención territorial", tono: "bg-marca-naranja" },
];

export default function ContactoPage() {
  return (
    <div className="container max-w-3xl py-12 md:py-16">
      <PageIntro
        eyebrow="Hablemos"
        title="Contacto"
        description="Estamos para escucharte. Elige el canal que prefieras."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {CANALES.map(({ icon: Icon, label, value, tono }) => (
          <Card key={label} className="shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
              <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm", tono)}>
                <Icon className="size-5" />
              </span>
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-sm text-muted-foreground">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8 overflow-hidden border-0 bg-marca-gradient text-white shadow-lg">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <h2 className="text-xl font-bold">¿Eres prensa o una organización?</h2>
          <p className="text-white/90">
            Escríbenos a través del formulario y te contactaremos.
          </p>
          <Button asChild variant="accent">
            <Link href="/participa">Ir al formulario</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
