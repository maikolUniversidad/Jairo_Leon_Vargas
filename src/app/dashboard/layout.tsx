import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { LocationTracker } from "@/components/dashboard/location-tracker";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // requireUser redirige a /login si no hay sesión (defensa además del middleware).
  const user = await requireUser();

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar viewableModules={user.viewableModules} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          name={user.profile?.full_name ?? null}
          email={user.email}
          role={user.primaryRole}
          avatarUrl={user.profile?.avatar_url ?? null}
        />
        <main className="flex-1 p-4 pb-24 lg:p-6 lg:pb-6">{children}</main>
      </div>
      <LocationTracker />
    </div>
  );
}
