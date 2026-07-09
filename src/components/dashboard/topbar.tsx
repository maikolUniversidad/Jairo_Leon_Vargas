import Link from "next/link";
import Image from "next/image";
import { LogOut } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { signOut } from "@/actions/auth";
import { ROLE_LABELS, type AppRole } from "@/types/roles";
import { initials } from "@/lib/utils";

export function Topbar({
  name,
  email,
  role,
  avatarUrl,
}: {
  name: string | null;
  email: string | null;
  role: AppRole | null;
  avatarUrl?: string | null;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:px-6">
      <div>
        <p className="text-sm font-semibold leading-tight">{name ?? "Equipo UTL"}</p>
        {role && (
          <Badge variant="muted" className="mt-0.5">{ROLE_LABELS[role]}</Badge>
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <NotificationBell />
        <div className="hidden text-right sm:block">
          <p className="text-xs text-muted-foreground">{email}</p>
        </div>
        <Link
          href="/dashboard/perfil"
          title="Mi perfil"
          className="rounded-full ring-offset-background transition hover:ring-2 hover:ring-primary/40 hover:ring-offset-2"
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={name ?? "Mi perfil"}
              width={36}
              height={36}
              unoptimized
              className="size-9 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
              {initials(name)}
            </span>
          )}
        </Link>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            <LogOut className="size-4" /> Salir
          </Button>
        </form>
      </div>
    </header>
  );
}
