import Link from "next/link";
import {
  ArrowRight,
  ArrowDown,
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
import { MarcaBar } from "@/components/marca";
import { HeroMedia } from "@/components/landing/hero-media";
import { getPerfilPublico } from "@/lib/settings";
import { cn } from "@/lib/utils";

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

// Colores de marca para las fichas de enfoque (movimiento diverso y humano).
const ENFOQUE_TONO = [
  "bg-marca-morado",
  "bg-marca-naranja",
  "bg-marca-verde",
  "bg-marca-azul",
  "bg-marca-rojo",
  "bg-marca-vinotinto",
];

/** Antetítulo de sección con la franja de marca. */
function Eyebrow({
  children,
  tone = "light",
}: {
  children: React.ReactNode;
  tone?: "light" | "dark";
}) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <MarcaBar className="h-1 w-10" />
      <span
        className={cn(
          "text-xs font-bold uppercase tracking-[0.2em]",
          tone === "dark" ? "text-accent" : "text-primary",
        )}
      >
        {children}
      </span>
    </div>
  );
}

export default async function HomePage() {
  const perfil = await getPerfilPublico();

  return (
    <>
      {/* ───────────── HERO ───────────── */}
      <section className="relative isolate overflow-hidden text-white">
        <HeroMedia videoUrl={perfil.hero_video_url || "/hero.mp4"} />

        <div className="container relative z-10 flex min-h-[86vh] flex-col justify-center py-24 md:min-h-[90vh]">
          <div className="max-w-3xl motion-safe:animate-fade-up">
            <Badge variant="accent" className="mb-5">
              {perfil.cargo_aspiracion} · Renglón {perfil.renglon}
            </Badge>

            <h1 className="text-balance text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl md:text-7xl">
              {perfil.nombre}
            </h1>

            <MarcaBar className="mt-6 h-1.5 w-56 max-w-full" />

            <p className="mt-7 max-w-2xl text-balance text-2xl font-bold text-accent sm:text-3xl">
              {perfil.lema}
            </p>
            <p className="mt-4 max-w-xl text-lg text-white/85">{perfil.subtitulo}</p>

            <div className="mt-9 flex flex-wrap gap-3">
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

            <p className="mt-7 text-xs uppercase tracking-[0.2em] text-white/60">
              {perfil.movimiento}
            </p>
          </div>
        </div>

        {/* Indicador de scroll */}
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center">
          <span className="motion-safe:animate-bounce text-white/50">
            <ArrowDown className="size-5" />
          </span>
        </div>
      </section>

      {/* Transición: franja de marca */}
      <div className="h-1.5 w-full bg-franja" />

      {/* ───────────── ENFOQUES ───────────── */}
      <section className="bg-muted/40 py-20">
        <div className="container">
          <div className="mb-12 max-w-2xl">
            <Eyebrow>Líneas de trabajo</Eyebrow>
            <h2 className="text-3xl font-black sm:text-4xl">Nuestros enfoques</h2>
            <p className="mt-3 text-muted-foreground">
              Construidos desde la experiencia territorial y social: con la gente
              y para la gente.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ENFOQUES.map(({ icon: Icon, titulo, desc }, i) => (
              <Card
                key={titulo}
                className="group border-transparent shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <CardContent className="p-6">
                  <div
                    className={cn(
                      "mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-sm transition-transform duration-300 group-hover:scale-110",
                      ENFOQUE_TONO[i % ENFOQUE_TONO.length],
                    )}
                  >
                    <Icon className="size-6" />
                  </div>
                  <h3 className="text-lg font-bold">{titulo}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── TRAYECTORIA ───────────── */}
      <section className="py-20">
        <div className="container grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <Eyebrow>Trayectoria verificada</Eyebrow>
            <h2 className="text-3xl font-black sm:text-4xl">Hechos, no promesas</h2>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Una trayectoria pública basada en experiencia territorial, social y
              comunitaria. La información se prioriza por hechos verificables.
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link href="/trayectoria">Ver trayectoria completa <ArrowRight className="size-4" /></Link>
            </Button>
          </div>
          <ol className="relative space-y-5 border-l-2 border-primary/20 pl-8">
            {TRAYECTORIA.map((item, i) => (
              <li key={item.titulo} className="relative">
                <span className="absolute -left-[41px] flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground shadow-sm">
                  {i + 1}
                </span>
                <Card className="shadow-sm transition-shadow hover:shadow-md">
                  <CardContent className="p-5">
                    <Badge variant="muted" className="mb-2">{item.tag}</Badge>
                    <h3 className="font-bold">{item.titulo}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{item.desc}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────────── PARTICIPA (CTA) ───────────── */}
      <section className="relative overflow-hidden bg-secondary py-20 text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-marca-morado/30 blur-3xl" />
        <div className="container relative grid gap-8 md:grid-cols-3">
          <div className="md:col-span-1">
            <Eyebrow tone="dark">Suma tu voz</Eyebrow>
            <h2 className="text-3xl font-black sm:text-4xl">Participa</h2>
            <p className="mt-3 text-white/80">
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
                className="group flex items-center justify-between rounded-2xl border border-white/15 bg-white/5 p-5 transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10"
              >
                <span className="flex items-center gap-3 font-medium">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                    <Icon className="size-5" />
                  </span>
                  {label}
                </span>
                <ArrowRight className="size-4 opacity-60 transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── CIERRE ───────────── */}
      <section className="py-20">
        <div className="container">
          <Card className="overflow-hidden border-0 bg-marca-gradient text-white shadow-lg">
            <CardContent className="flex flex-col items-center gap-5 p-10 text-center md:p-16">
              <span className="h-1.5 w-24 rounded-full bg-white/70" />
              <h2 className="text-balance text-3xl font-black sm:text-4xl">
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
