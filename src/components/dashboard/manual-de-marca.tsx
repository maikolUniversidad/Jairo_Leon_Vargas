"use client";

import { useState } from "react";
import { Check, Copy, Download, X } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { LogoJLV, MarcaBar, MARCA_PUNTOS, type LogoVariant } from "@/components/marca";
import { cn } from "@/lib/utils";

/** Un color de la paleta, con su rol dentro del sistema. */
interface Tono {
  nombre: string;
  hex: string;
  rol: string;
  /** Texto legible encima del color (para las fichas). */
  sobre: "claro" | "oscuro";
}

const PALETA: Tono[] = [
  { nombre: "Morado", hex: "#8e378e", rol: "Principal · botones y enlaces", sobre: "claro" },
  { nombre: "Azul", hex: "#2a3883", rol: "Estructura · header, sidebar, footer", sobre: "claro" },
  { nombre: "Amarillo", hex: "#f49a20", rol: "Acento · llamados a la acción", sobre: "oscuro" },
  { nombre: "Rojo", hex: "#e92025", rol: "Alertas y estados críticos", sobre: "claro" },
  { nombre: "Verde", hex: "#35a74a", rol: "Confirmaciones y éxito", sobre: "claro" },
  { nombre: "Vinotinto", hex: "#921b4c", rol: "Apoyo · data-viz y franja", sobre: "claro" },
];

const VISTAS: { variant: LogoVariant; titulo: string; uso: string; alto: string }[] = [
  {
    variant: "full",
    titulo: "Lockup completo",
    uso: "Uso principal: portadas, login, pie de página y espacios amplios. Incluye la bajada «Congresista» y los puntos.",
    alto: "h-16",
  },
  {
    variant: "compact",
    titulo: "Compacto",
    uso: "Encabezados y barras estrechas (sidebar, menú superior). Mantiene el nombre y los puntos, sin bajada.",
    alto: "h-10",
  },
  {
    variant: "isotipo",
    titulo: "Isotipo (puntos)",
    uso: "Espacios mínimos: favicon, avatar, apps y sellos. Solo los cinco puntos, la firma reconocible de la marca.",
    alto: "h-6",
  },
];

function CopyHex({ hex }: { hex: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(hex);
          setCopied(true);
          toast.success(`Copiado ${hex}`);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          toast.error("No se pudo copiar");
        }
      }}
      className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wide opacity-90 transition hover:opacity-100"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {hex}
    </button>
  );
}

/** Muestra una vista del logo sobre fondo claro y sobre fondo oscuro. */
function VistaLogo({ variant, titulo, uso, alto }: (typeof VISTAS)[number]) {
  return (
    <div className="overflow-hidden rounded-2xl border">
      <div className="grid grid-cols-2 divide-x">
        <div className="flex min-h-[112px] items-center justify-center bg-white p-6 text-neutral-900">
          <LogoJLV variant={variant} className={alto} />
        </div>
        <div className="flex min-h-[112px] items-center justify-center bg-secondary p-6 text-white">
          <LogoJLV variant={variant} className={alto} />
        </div>
      </div>
      <div className="border-t bg-muted/40 p-4">
        <p className="text-sm font-semibold">{titulo}</p>
        <p className="mt-1 text-xs text-muted-foreground">{uso}</p>
      </div>
    </div>
  );
}

function Regla({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
          ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700",
        )}
      >
        {ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}
      </span>
      <span className="text-muted-foreground">{children}</span>
    </li>
  );
}

export function ManualDeMarca() {
  return (
    <div className="space-y-8">
      {/* Portada del manual */}
      <Card className="overflow-hidden">
        <div className="h-1.5 w-full bg-franja" />
        <CardContent className="grid gap-6 p-8 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Manual de marca</p>
            <h2 className="mt-2 text-2xl font-bold">Identidad visual · Jairo León</h2>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">
              El logo, los colores y la tipografía que representan a Jairo León Congresista.
              Todo el color de la plataforma nace de estos tokens, así que ajustar aquí propaga
              a la landing y a la plataforma. El texto del logo hereda el color del fondo: se ve
              negro sobre claros y blanco sobre oscuros; los cinco puntos siempre conservan su color.
            </p>
          </div>
          <div className="flex items-center justify-center rounded-2xl bg-secondary p-8 text-white">
            <LogoJLV variant="full" className="h-20" />
          </div>
        </CardContent>
      </Card>

      {/* Vistas del logo */}
      <section>
        <h3 className="text-lg font-semibold">Vistas del logo</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Tres versiones para cada contexto y tamaño de pantalla. Cada una se muestra sobre fondo claro y oscuro.
        </p>
        <div className="mt-4 grid gap-5 lg:grid-cols-3">
          {VISTAS.map((v) => (
            <VistaLogo key={v.variant} {...v} />
          ))}
        </div>
      </section>

      {/* Los cinco puntos */}
      <section>
        <h3 className="text-lg font-semibold">Los cinco puntos</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          La firma de la marca. El orden es fijo: amarillo · azul · rojo · verde · morado.
        </p>
        <Card className="mt-4">
          <CardContent className="flex flex-wrap items-center justify-center gap-6 p-8">
            {MARCA_PUNTOS.map((p) => (
              <div key={p.nombre} className="flex flex-col items-center gap-2">
                <span className="size-12 rounded-full shadow-sm" style={{ backgroundColor: p.hex }} />
                <span className="text-xs font-medium">{p.nombre}</span>
                <CopyHex hex={p.hex} />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* Paleta */}
      <section>
        <h3 className="text-lg font-semibold">Paleta y roles</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada color tiene una función. Toca el código para copiarlo.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PALETA.map((t) => (
            <div key={t.nombre} className="overflow-hidden rounded-2xl border">
              <div
                className={cn(
                  "flex items-end justify-between p-4",
                  t.sobre === "claro" ? "text-white" : "text-neutral-900",
                )}
                style={{ backgroundColor: t.hex, minHeight: 92 }}
              >
                <span className="text-sm font-bold">{t.nombre}</span>
                <CopyHex hex={t.hex} />
              </div>
              <div className="bg-card p-3">
                <p className="text-xs text-muted-foreground">{t.rol}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Franja */}
      <section>
        <h3 className="text-lg font-semibold">Franja multicolor</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          El acento de marca sobre las estructuras oscuras (parte superior de header, sidebar y footer).
          En CSS es la utilidad <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.bg-franja</code>.
        </p>
        <Card className="mt-4">
          <CardContent className="space-y-4 p-6">
            <MarcaBar className="h-2" />
            <MarcaBar className="h-1 w-1/2" />
            <MarcaBar className="h-3 rounded-lg" />
          </CardContent>
        </Card>
      </section>

      {/* Tipografía */}
      <section>
        <h3 className="text-lg font-semibold">Tipografía</h3>
        <Card className="mt-4">
          <CardContent className="grid gap-6 p-6 sm:grid-cols-2">
            <div>
              <p className="text-5xl font-black leading-none">Aa</p>
              <p className="mt-3 text-sm font-semibold">Inter</p>
              <p className="text-xs text-muted-foreground">Familia única para títulos y texto.</p>
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-black">Negra 900 — «JAIRO»</p>
              <p className="text-2xl font-light">Fina 300 — «LEÓN»</p>
              <p className="text-xs font-medium uppercase tracking-[0.34em]">Medium — «Congresista»</p>
              <p className="text-sm text-muted-foreground">
                El contraste de pesos (negra + fina) es lo que distingue el logotipo.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Usos */}
      <section>
        <h3 className="text-lg font-semibold">Usos correctos e incorrectos</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="p-6">
              <p className="mb-3 text-sm font-semibold text-emerald-700">Sí</p>
              <ul className="space-y-2.5">
                <Regla ok>Dejar aire alrededor del logo (mínimo la altura de un punto).</Regla>
                <Regla ok>Usar el logo blanco sobre fondos oscuros y negro sobre claros.</Regla>
                <Regla ok>Escalar siempre desde una versión SVG para que no pixele.</Regla>
                <Regla ok>Mantener el orden de los puntos: amarillo, azul, rojo, verde, morado.</Regla>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="mb-3 text-sm font-semibold text-red-700">No</p>
              <ul className="space-y-2.5">
                <Regla ok={false}>Cambiar los colores o el orden de los puntos.</Regla>
                <Regla ok={false}>Deformar, rotar o inclinar el logotipo.</Regla>
                <Regla ok={false}>Ponerlo sobre fondos de bajo contraste que lo hagan ilegible.</Regla>
                <Regla ok={false}>Recrear el texto con otra tipografía distinta a Inter.</Regla>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Download className="size-3.5" />
        ¿Necesitas el logo en un archivo? El componente vive en{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono">src/components/marca.tsx</code> — pídelo exportado a PNG/SVG cuando lo requieras.
      </p>
    </div>
  );
}
