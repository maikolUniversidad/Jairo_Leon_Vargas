import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { findModule } from "./nav";

/**
 * Índice de un módulo: renderiza sus submódulos como tarjetas.
 * La fuente de verdad son los `submodules` definidos en nav.ts.
 * `counts` (opcional) muestra un contador por submódulo, indexado por su href.
 */
export function ModuleLanding({
  moduleHref,
  counts,
}: {
  moduleHref: string;
  counts?: Record<string, number>;
}) {
  const mod = findModule(moduleHref);
  const subs = mod?.submodules ?? [];

  if (subs.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {subs.map((s) => (
        <Link key={s.href} href={s.href}>
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardContent className="flex h-full flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <s.icon className="size-5" />
                </span>
                {counts?.[s.href] !== undefined && (
                  <Badge variant="muted">{counts[s.href]}</Badge>
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{s.label}</p>
                {s.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                )}
              </div>
              <span className="flex items-center gap-1 text-sm font-medium text-primary">
                Gestionar <ArrowRight className="size-4" />
              </span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
