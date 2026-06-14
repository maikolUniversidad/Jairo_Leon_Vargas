import Link from "next/link";
import {
  ArrowRight,
  Users,
  HeartHandshake,
  Vote,
  Sparkles,
  Scale,
  Leaf,
  Building2,
  MapPin,
  CalendarDays,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPerfilPublico } from "@/lib/settings";

const ENFOQUES = [
  { icon: MapPin, titulo: "Territorio y comunidad", desc: "Trabajo en barrios y localidades, con la gente y para la gente." },
  { icon: HeartHandshake, titulo: "Gestión social", desc: "Articulación de oferta social y respuesta a necesidades reales." },
  { icon: Vote, titulo: "Participación ciudadana", desc: "Decisiones construidas con la comunidad, no a sus espaldas." },
  { icon: Sparkles, titulo: "Juventud y oportunidades", desc: "Educación, empleo y futuro para las nuevas generaciones." },
  { icon: Scale, titulo: "Mujeres y derechos", desc: "Igualdad, no violencia y garantía de derechos." },
  { icon: Leaf, titulo: "Ambiente y vida digna", desc: "Territorios sostenibles y calidad de vida." },
  { icon: Building2, titulo: "Bogotá popular y democrática", desc: "Una ciudad para todas y todos." },
];

const TRAYECTORIA = [
  { titulo: "Alcalde Local de San Cristóbal", desc: "Gestión territorial y social en la localidad.", tag: "Gestión territorial" },
  { titulo: "Prosperidad Social", desc: "Director de Oferta Social / Gestión y Articulación de la Oferta Social.", tag: "Articulación institucional" },
  { titulo: "Candidato a Cámara por Bogotá D.C.", desc: "Entorno del Pacto Histórico · Renglón 106.", tag: "Participación" },
];

export default async function HomePage() {
  const perfil = await getPerfilPublico();

  return (
    <>
      {/* ───────────── HERO ───────────── */}
      <section className="relative overflow-hidden bg-marca-hero text-white">
        <div className="container grid gap-10 py-16 md:grid-cols-2 md:py-24 md:items-center">
          <div>
            <Badge variant="accent" className="mb-4">
              {perfil.cargo_aspiracion} · Renglón {perfil.renglon}
            </Badge>
            <h1 className="text-balance text-4xl font-black leading-tight sm:text-5xl">
              {perfil.nombre}
            </h1>
            <p className="mt-3 text-balance text-xl font-semibold text-accent">
              {perfil.lema}
            </p>
            <p className="mt-4 max-w-xl text-white/85">{perfil.subtitulo}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="accent">
                <Link href="/participa">
                  Cuéntanos tu necesidad <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/40 bg-white/5 text-white hover:bg-white/15">
                <Link href="/trayectoria">Conoce la trayectoria</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/10">
                <Link href="/registro">Únete a la comunidad</Link>
              </Button>
            </div>

            <p className="mt-6 text-xs text-white/60">
              {perfil.movimiento}
            </p>
          </div>

          <div className="relative">
            <div className="mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 shadow-2xl">
              {perfil.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={perfil.foto_url} alt={perfil.nombre} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center">
                  <span className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-3xl font-black">
                    JLV
                  </span>
                  <p className="text-sm text-white/70">
                    [Foto oficial pendiente · editable desde el panel]
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── ENFOQUES ───────────── */}
      <section className="bg-muted/40 py-16">
        <div className="container">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-bold">Nuestros enfoques</h2>
            <p className="mt-2 text-muted-foreground">
              Líneas de trabajo construidas desde la experiencia territorial y social.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ENFOQUES.map(({ icon: Icon, titulo, desc }) => (
              <Card key={titulo} className="transition-shadow hover:shadow-md">
                <CardContent className="p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-6" />
                  </div>
                  <h3 className="text-lg font-semibold">{titulo}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── TRAYECTORIA ───────────── */}
      <section className="py-16">
        <div className="container grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <Badge variant="secondary" className="mb-4">Trayectoria verificada</Badge>
            <h2 className="text-3xl font-bold">Hechos, no promesas</h2>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Presentamos una trayectoria pública basada en experiencia
              territorial, social y comunitaria. La información se prioriza por
              hechos verificables.
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link href="/trayectoria">Ver trayectoria completa <ArrowRight className="size-4" /></Link>
            </Button>
          </div>
          <ol className="relative space-y-6 border-l-2 border-primary/20 pl-6">
            {TRAYECTORIA.map((item) => (
              <li key={item.titulo} className="relative">
                <span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full border-2 border-primary bg-background">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                </span>
                <Card>
                  <CardContent className="p-5">
                    <Badge variant="muted" className="mb-2">{item.tag}</Badge>
                    <h3 className="font-semibold">{item.titulo}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{item.desc}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────────── PARTICIPA (CTA) ───────────── */}
      <section className="bg-secondary py-16 text-white">
        <div className="container grid gap-8 md:grid-cols-3">
          <div className="md:col-span-1">
            <h2 className="text-3xl font-bold">Participa</h2>
            <p className="mt-2 text-white/80">
              Tu voz organiza el trabajo en el territorio. Elige cómo sumarte.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:col-span-2">
            {[
              { href: "/participa", label: "Cuéntanos tu necesidad", icon: Users },
              { href: "/solicitudes", label: "Radicar una solicitud", icon: CheckCircle2 },
              { href: "/participa#propuesta", label: "Proponer para mi barrio", icon: MapPin },
              { href: "/agenda", label: "Inscribirme a un evento", icon: CalendarDays },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className="group flex items-center justify-between rounded-2xl border border-white/15 bg-white/5 p-5 transition-colors hover:bg-white/10"
              >
                <span className="flex items-center gap-3 font-medium">
                  <Icon className="size-5 text-accent" /> {label}
                </span>
                <ArrowRight className="size-4 opacity-60 transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── CIERRE ───────────── */}
      <section className="py-16">
        <div className="container">
          <Card className="overflow-hidden border-0 bg-marca-gradient text-white">
            <CardContent className="flex flex-col items-center gap-4 p-10 text-center md:p-14">
              <h2 className="text-balance text-3xl font-bold">
                Construyamos juntos, desde el territorio
              </h2>
              <p className="max-w-xl text-white/90">
                Recibe novedades por WhatsApp o correo y participa de las
                actividades en tu localidad.
              </p>
              <Button asChild size="lg" variant="accent">
                <Link href="/registro">Recibir novedades</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
