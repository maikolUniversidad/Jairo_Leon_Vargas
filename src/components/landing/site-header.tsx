"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/marca";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Inicio" },
  { href: "/trayectoria", label: "Trayectoria" },
  { href: "/agenda", label: "Agenda" },
  { href: "/territorio", label: "Territorio" },
  { href: "/noticias", label: "Noticias" },
  { href: "/participa", label: "Participa" },
  { href: "/contacto", label: "Contacto" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-secondary/95 text-white backdrop-blur supports-[backdrop-filter]:bg-secondary/80">
      <div className="h-1 w-full bg-franja" />
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center" aria-label="Inicio — Jairo León Vargas">
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Button asChild variant="accent" size="sm">
            <Link href="/participa">Participa</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10 hover:text-white"
          >
            <Link href="/login">
              <LogIn className="size-4" /> Ingresar equipo
            </Link>
          </Button>
        </div>

        <button
          type="button"
          className="rounded-md p-2 lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menú"
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      <div
        className={cn(
          "border-t border-white/10 lg:hidden",
          open ? "block" : "hidden",
        )}
      >
        <nav className="container flex flex-col py-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-2 flex gap-2 px-3">
            <Button asChild variant="accent" size="sm" className="flex-1">
              <Link href="/participa">Participa</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="flex-1 border-white/30 text-white">
              <Link href="/login">Ingresar</Link>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}
