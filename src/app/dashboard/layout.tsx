import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // requireUser redirige a /login si no hay sesión (defensa además del middleware).
  const user = await requireUser();

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar role={user.primaryRole} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          name={user.profile?.full_name ?? null}
          email={user.email}
          role={user.primaryRole}
        />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
