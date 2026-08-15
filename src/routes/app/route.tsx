import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/admin/top-bar";
import { RoleGuard } from "@/components/role-guard";

export const Route = createFileRoute("/app")({
  ssr: false,
  beforeLoad: async () => {
    // getSession reads the local (already validated) session — no network
    // round-trip on every navigation inside /app. RLS still guards all data.
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full min-w-0 bg-surface">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="w-full min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6">
            <div className="animate-in fade-in slide-in-from-bottom-1 duration-300">
              <RoleGuard>
                <Outlet />
              </RoleGuard>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
