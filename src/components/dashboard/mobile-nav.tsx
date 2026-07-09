"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { DASHBOARD_NAV, type NavItem, type SubNavItem } from "./nav";

/**
 * Navegación en móvil (< lg). Se renderiza DENTRO de la columna de contenido
 * (después del Topbar), no como hermano flex del layout, para que la franja de
 * submódulos ocupe todo el ancho y no se vuelva una columna lateral.
 *
 * - Franja de submódulos del módulo activo: sticky bajo el Topbar, scroll lateral.
 * - Barra de módulos: fija abajo, scroll lateral.
 */
export function MobileNav({ viewableModules }: { viewableModules: string[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const items = DASHBOARD_NAV.filter((i) => viewableModules.includes(i.module));

  const moduleActive = (item: NavItem) =>
    item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);

  const subActive = (sub: SubNavItem) => {
    const qIdx = sub.href.indexOf("?");
    const subPath = qIdx === -1 ? sub.href : sub.href.slice(0, qIdx);
    const subQuery = qIdx === -1 ? "" : sub.href.slice(qIdx + 1);
    if (pathname !== subPath && !pathname.startsWith(subPath + "/")) return false;
    if (!subQuery) return true;
    const key = subQuery.split("=")[0] ?? "";
    const val = subQuery.split("=")[1] ?? "";
    return searchParams.get(key) === val;
  };

  const activeModule = items.find((i) => moduleActive(i));
  const noScrollbar =
    "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

  return (
    <>
      {/* Franja de submódulos del módulo activo (scroll lateral) */}
      {activeModule?.submodules?.length ? (
        <div className="sticky top-16 z-10 border-b bg-background/95 backdrop-blur lg:hidden">
          <div className={cn("flex items-center gap-2 overflow-x-auto px-3 py-2", noScrollbar)}>
            <span className="shrink-0 pr-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {activeModule.label}
            </span>
            {activeModule.submodules.map((sub) => {
              const on = subActive(sub);
              return (
                <Link
                  key={sub.href}
                  href={sub.href}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                    on
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-background text-foreground/70 hover:bg-muted",
                  )}
                >
                  <sub.icon className="size-3.5 shrink-0" />
                  <span className="whitespace-nowrap">{sub.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Barra de módulos inferior (scroll lateral) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-secondary text-white lg:hidden">
        <div className="h-0.5 w-full bg-franja" />
        <div className={cn("flex items-stretch gap-1 overflow-x-auto px-2 py-1.5", noScrollbar)}>
          {items.map((item) => {
            const active = moduleActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-w-[68px] shrink-0 flex-col items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-white/80 hover:bg-white/10 hover:text-white",
                )}
              >
                <item.icon className="size-5 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
