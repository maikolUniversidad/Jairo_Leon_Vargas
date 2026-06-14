import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Phone, MapPin } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Canales de contacto y atención.",
};

export default function ContactoPage() {
  return (
    <div className="container max-w-3xl py-12 md:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-bold md:text-4xl">Contacto</h1>
        <p className="mt-2 text-muted-foreground">
          Estamos para escucharte. Elige el canal que prefieras.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Mail, label: "Correo", value: "[pendiente]" },
          { icon: Phone, label: "Teléfono / WhatsApp", value: "[pendiente]" },
          { icon: MapPin, label: "Bogotá D.C.", value: "Atención territorial" },
        ].map(({ icon: Icon, label, value }) => (
          <Card key={label}>
            <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-sm text-muted-foreground">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <h2 className="text-xl font-semibold">¿Eres prensa o una organización?</h2>
          <p className="text-muted-foreground">
            Escríbenos a través del formulario y te contactaremos.
          </p>
          <Button asChild>
            <Link href="/participa">Ir al formulario</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
