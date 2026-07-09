"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Menu, X, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { LogoJLV } from "@/components/marca";
import { DASHBOARD_NAV, type NavItem, type SubNavItem } from "./nav";

export function Sidebar({ viewableModules }: { viewableModules: string[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const items = DASHBOARD_NAV.filter((i) => viewableModules.includes(i.module));

  const moduleActive = (item: NavItem) =>
    item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);

  // Abre automáticamente el módulo cuya ruta está activa.
  useEffect(() => {
    const current = items.find((i) => i.submodules && moduleActive(i));
    if (current) setExpanded((e) => (e[current.href] ? e : { ...e, [current.href]: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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

  const nav = (
    <nav className="flex flex-col gap-0.5 p-3">
      {items.map((item) => {
        const active = moduleActive(item);
        const hasSubs = !!item.submodules?.length;
        const isOpen = expanded[item.href] ?? false;

        return (
          <div key={item.href}>
            <div
              className={cn(
                "flex items-center rounded-lg transition-colors",
                active && !hasSubs
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : active
                    ? "bg-white/10 text-white"
                    : "text-white/80 hover:bg-white/10 hover:text-white",
              )}
            >
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex flex-1 items-center gap-3 px-3 py-2.5 text-sm font-medium"
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </Link>
              {hasSubs && (
                <button
                  type="button"
                  aria-label={isOpen ? "Contraer" : "Expandir"}
                  onClick={() => setExpanded((e) => ({ ...e, [item.href]: !isOpen }))}
                  className="px-2.5 py-2.5 text-white/70 hover:text-white"
                >
                  <ChevronDown
                    className={cn("size-4 transition-transform", isOpen && "rotate-180")}
                  />
                </button>
              )}
            </div>

            {/* Submódulos */}
            {hasSubs && isOpen && (
              <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-white/10 pl-3">
                {item.submodules!.map((sub) => {
                  const on = subActive(sub);
                  return (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors",
                        on
                          ? "bg-primary text-primary-foreground"
                          : "text-white/70 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <sub.icon className="size-3.5 shrink-0" />
                      {sub.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Botón móvil */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-4 top-3 z-30 rounded-md bg-secondary p-2 text-white lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="size-5" />
      </button>

      {/* Sidebar fijo desktop */}
      <aside className="hidden w-64 shrink-0 flex-col bg-secondary text-white lg:flex">
        <div className="h-1 w-full bg-franja" />
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <LogoJLV className="h-9" />
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white/80">
            UTL 360
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
      </aside>

      {/* Drawer móvil */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-secondary text-white">
            <div className="h-1 w-full bg-franja" />
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
              <LogoJLV className="h-9" />
              <button onClick={() => setOpen(false)} aria-label="Cerrar">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
          </aside>
        </div>
      )}
    </>
  );
}
