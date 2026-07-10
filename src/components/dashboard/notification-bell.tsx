"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";

import { cn, formatDate } from "@/lib/utils";
import {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllRead,
  type NotificationRow,
} from "@/actions/notificaciones";

const TIPO_DOT: Record<string, string> = {
  info: "bg-sky-500",
  exito: "bg-emerald-500",
  advertencia: "bg-amber-500",
  alerta: "bg-red-500",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  async function refresh() {
    const [list, count] = await Promise.all([getMyNotifications(), getUnreadCount()]);
    setItems(list);
    setUnread(count);
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000); // sondeo ligero cada minuto
    return () => clearInterval(id);
  }, []);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function handleOpen() {
    setOpen((v) => !v);
    if (!open) refresh();
  }

  function onItemClick(n: NotificationRow) {
    if (!n.leida) {
      start(async () => {
        await markAsRead(n.id);
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, leida: true } : x)));
        setUnread((u) => Math.max(0, u - 1));
      });
    }
  }

  function onMarkAll() {
    start(async () => {
      await markAllRead();
      setItems((prev) => prev.map((x) => ({ ...x, leida: true })));
      setUnread(0);
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
        aria-label="Notificaciones"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-2 top-16 z-50 overflow-hidden rounded-xl border bg-popover shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem]">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-semibold">Notificaciones</span>
            {unread > 0 && (
              <button
                onClick={onMarkAll}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <CheckCheck className="size-3.5" /> Marcar todo
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No tienes notificaciones.
              </p>
            ) : (
              items.map((n) => {
                const content = (
                  <div
                    className={cn(
                      "flex gap-3 px-4 py-3 transition-colors hover:bg-muted/60",
                      !n.leida && "bg-primary/5",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        TIPO_DOT[n.tipo] ?? "bg-slate-400",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm leading-snug", !n.leida && "font-semibold")}>
                        {n.titulo}
                      </p>
                      {n.cuerpo && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {n.cuerpo}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatDate(n.created_at, { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                    </div>
                  </div>
                );
                return n.url ? (
                  <Link key={n.id} href={n.url} onClick={() => onItemClick(n)} className="block">
                    {content}
                  </Link>
                ) : (
                  <button
                    key={n.id}
                    onClick={() => onItemClick(n)}
                    className="block w-full text-left"
                  >
                    {content}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
