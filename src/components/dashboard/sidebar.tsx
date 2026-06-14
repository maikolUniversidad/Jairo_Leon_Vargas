"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { DASHBOARD_NAV } from "./nav";
import { canAccessModule, type AppRole } from "@/types/roles";

export function Sidebar({ role }: { role: AppRole | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items = DASHBOARD_NAV.filter((i) => canAccessModule(role, i.module));

  const nav = (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-white/80 hover:bg-white/10 hover:text-white",
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </Link>
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
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-5 font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-black">
            JLV
          </span>
          UTL 360
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
      </aside>

      {/* Drawer móvil */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-secondary text-white">
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-5 font-bold">
              <span>UTL 360</span>
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
