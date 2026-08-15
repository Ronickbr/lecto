import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  BookOpenText,
  LayoutDashboard,
  Building2,
  Users,
  GraduationCap,
  FileText,
  LogOut,
  School,
  UserRound,
  Package,
  Library,
  BarChart3,
  RotateCcw,
  ClipboardList,
  CreditCard,
  Wallet,
  Activity,
  ShieldCheck,
  ScrollText,
  Settings,
  PieChart,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { stopImpersonation } from "@/lib/admin/impersonation";
import { useCurrentUser, type AppRole } from "@/hooks/use-current-user";
import { useQueryClient } from "@tanstack/react-query";

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV: Record<AppRole, { label: string; items: NavItem[] }[]> = {
  super_admin: [
    {
      label: "Plataforma",
      items: [
        { label: "Dashboard", to: "/app/admin", icon: LayoutDashboard },
        { label: "Escolas", to: "/app/admin/schools", icon: Building2 },
        { label: "Assinaturas", to: "/app/admin/subscriptions", icon: CreditCard },
        { label: "Planos", to: "/app/admin/plans", icon: Package },
        { label: "Usuários globais", to: "/app/admin/users", icon: Users },
      ],
    },
    {
      label: "Negócio",
      items: [
        { label: "Financeiro", to: "/app/admin/finance", icon: Wallet },
        { label: "Relatórios", to: "/app/admin/reports", icon: PieChart },
      ],
    },
    {
      label: "Operação",
      items: [
        { label: "Monitoramento", to: "/app/admin/monitoring", icon: Activity },
        { label: "Auditoria", to: "/app/admin/audit", icon: ShieldCheck },
        { label: "Logs", to: "/app/admin/logs", icon: ScrollText },
        { label: "Configurações", to: "/app/admin/settings", icon: Settings },
        { label: "Perfil", to: "/app/profile", icon: UserRound },
      ],
    },
  ],
  school_admin: [
    {
      label: "Escola",
      items: [
        { label: "Visão geral", to: "/app/school", icon: LayoutDashboard },
        { label: "Professores", to: "/app/school/teachers", icon: UserRound },
        { label: "Turmas", to: "/app/school/classes", icon: School },
        { label: "Alunos", to: "/app/school/students", icon: Users },
        { label: "Meu perfil", to: "/app/profile", icon: UserRound },
      ],
    },
    {
      label: "Conteúdo",
      items: [
        { label: "Banco de textos", to: "/app/school/texts", icon: Library },
        { label: "Simulados", to: "/app/school/simulados", icon: FileText },
        { label: "Resultados", to: "/app/teacher/resultados", icon: BarChart3 },
        { label: "Tentativas", to: "/app/teacher/tentativas", icon: RotateCcw },
        { label: "Rubricas", to: "/app/teacher/rubricas", icon: ClipboardList },
      ],
    },
  ],
  teacher: [
    {
      label: "Professor",
      items: [
        { label: "Painel", to: "/app/teacher", icon: LayoutDashboard },
        { label: "Meus alunos", to: "/app/school/students", icon: Users },
        { label: "Resultados", to: "/app/teacher/resultados", icon: BarChart3 },
        { label: "Tentativas", to: "/app/teacher/tentativas", icon: RotateCcw },
        { label: "Rubricas", to: "/app/teacher/rubricas", icon: ClipboardList },
        { label: "Banco de textos", to: "/app/school/texts", icon: Library },
        { label: "Simulados", to: "/app/school/simulados", icon: FileText },
        { label: "Meu perfil", to: "/app/profile", icon: UserRound },
      ],
    },
  ],

  student: [
    {
      label: "Aluno",
      items: [
        { label: "Meu painel", to: "/app/student", icon: LayoutDashboard },
        { label: "Simulados", to: "/app/student/simulados", icon: GraduationCap },
        { label: "Meu progresso", to: "/app/student/progresso", icon: BarChart3 },
        { label: "Meu perfil", to: "/app/profile", icon: UserRound },
      ],
    },
  ],
};

export function AppSidebar() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isActive = (path: string) =>
    currentPath === path ||
    (path !== "/app" && path !== "/app/admin" && currentPath.startsWith(path + "/"));

  async function handleSignOut() {
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      stopImpersonation();
      await supabase.auth.signOut();
    } catch (err) {
      console.error("signOut", err);
    } finally {
      navigate({ to: "/auth", replace: true });
    }
  }

  const role = user?.primaryRole;
  const groups = role ? NAV[role] : [];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/" className="flex items-center gap-2 px-2 py-2">
          <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <BookOpenText className="size-4" />
          </div>
          <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="font-display text-lg leading-none">Lecto</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {role === "super_admin" && "Super Admin"}
              {role === "school_admin" && "Escola"}
              {role === "teacher" && "Professor"}
              {role === "student" && "Aluno"}
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {userLoading && groups.length === 0 ? (
          <div className="space-y-2 p-3 group-data-[collapsible=icon]:hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-xl" />
            ))}
          </div>
        ) : null}
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.to)}
                      tooltip={item.label}
                      className="rounded-xl transition-all duration-200 data-[active=true]:bg-primary/10 data-[active=true]:font-medium data-[active=true]:text-primary"
                    >
                      <Link to={item.to}>
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-2 group-data-[collapsible=icon]:hidden">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
            <UserRound className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.profile?.full_name ?? "—"}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="w-full justify-start gap-2 rounded-xl"
        >
          <LogOut className="size-4" />
          <span className="group-data-[collapsible=icon]:hidden">Sair</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
