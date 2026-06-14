import { LogOut } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { signOut } from "@/actions/auth";
import { ROLE_LABELS, type AppRole } from "@/types/roles";
import { initials } from "@/lib/utils";

export function Topbar({
  name,
  email,
  role,
}: {
  name: string | null;
  email: string | null;
  role: AppRole | null;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-4 pl-16 backdrop-blur lg:px-6 lg:pl-6">
      <div>
        <p className="text-sm font-semibold leading-tight">{name ?? "Equipo UTL"}</p>
        {role && (
          <Badge variant="muted" className="mt-0.5">{ROLE_LABELS[role]}</Badge>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-xs text-muted-foreground">{email}</p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
          {initials(name)}
        </span>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            <LogOut className="size-4" /> Salir
          </Button>
        </form>
      </div>
    </header>
  );
}
