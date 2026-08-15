import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useImpersonation, stopImpersonation } from "@/lib/admin/impersonation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, Building2, LogOut, Plus, Search, ShieldCheck, UserRound } from "lucide-react";
import { relative } from "@/lib/admin/format";

const LABELS: Record<string, string> = {
  app: "Início",
  admin: "Administração",
  schools: "Escolas",
  subscriptions: "Assinaturas",
  plans: "Planos",
  users: "Usuários globais",
  finance: "Financeiro",
  reports: "Relatórios",
  monitoring: "Monitoramento",
  audit: "Auditoria",
  logs: "Logs",
  settings: "Configurações",
  profile: "Perfil",
  school: "Escola",
  teacher: "Professor",
  student: "Aluno",
  teachers: "Professores",
  students: "Alunos",
  classes: "Turmas",
  texts: "Banco de textos",
  simulados: "Simulados",
  resultados: "Resultados",
  tentativas: "Tentativas",
  rubricas: "Rubricas",
  progresso: "Progresso",
};

const ENV_IS_PROD =
  typeof window !== "undefined" &&
  !/preview|localhost|127\.0\.0\.1|-dev\./.test(window.location.hostname);

function useBreadcrumbs() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    return parts.map((part, i) => ({
      label: LABELS[part] ?? decodeURIComponent(part).slice(0, 18),
      href: "/" + parts.slice(0, i + 1).join("/"),
      last: i === parts.length - 1,
    }));
  }, [pathname]);
}

function GlobalSearch({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data: schools } = useQuery({
    queryKey: ["global-search-schools", term],
    enabled: open && isAdmin,
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase.from("schools").select("id, name, slug, city, state").limit(8);
      if (term.trim()) q = q.or(`name.ilike.%${term}%,slug.ilike.%${term}%,city.ilike.%${term}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const go = (to: string) => {
    setOpen(false);
    navigate({ to });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full min-w-0 items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted sm:max-w-xs"
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate">Pesquisar…</span>
        <kbd className="ml-auto hidden shrink-0 rounded border border-border bg-background px-1.5 text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar escolas, páginas…" value={term} onValueChange={setTerm} />
        <CommandList>
          <CommandEmpty>Nada encontrado.</CommandEmpty>
          {isAdmin && (
            <CommandGroup heading="Escolas">
              {schools?.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`${s.name} ${s.slug}`}
                  onSelect={() => go(`/app/admin/schools/${s.id}`)}
                >
                  <Building2 className="size-4" />
                  <span className="truncate">{s.name}</span>
                  <span className="ml-auto truncate text-xs text-muted-foreground">
                    {[s.city, s.state].filter(Boolean).join("/")}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading="Navegação">
            {Object.entries({
              "/app/admin": "Dashboard",
              "/app/admin/schools": "Escolas",
              "/app/admin/subscriptions": "Assinaturas",
              "/app/admin/plans": "Planos",
              "/app/admin/users": "Usuários globais",
              "/app/admin/finance": "Financeiro",
              "/app/admin/reports": "Relatórios",
              "/app/admin/monitoring": "Monitoramento",
              "/app/admin/audit": "Auditoria",
              "/app/admin/logs": "Logs",
              "/app/admin/settings": "Configurações",
              "/app/profile": "Perfil",
            }).map(([to, label]) => (
              <CommandItem key={to} value={label} onSelect={() => go(to)}>
                <Search className="size-4" />
                {label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

function Notifications({ isAdmin }: { isAdmin: boolean }) {
  const { data } = useQuery({
    queryKey: ["admin-notifications"],
    enabled: isAdmin,
    staleTime: 60_000,
    queryFn: async () => {
      const soon = new Date(Date.now() + 7 * 86_400_000).toISOString();
      const [trials, suspended, recent] = await Promise.all([
        supabase
          .from("schools")
          .select("id, name, subscription_expires_at")
          .eq("subscription_status", "trial")
          .lte("subscription_expires_at", soon)
          .limit(5),
        supabase.from("schools").select("id, name").eq("subscription_status", "suspended").limit(5),
        supabase
          .from("schools")
          .select("id, name, created_at")
          .order("created_at", { ascending: false })
          .limit(3),
      ]);
      const items: { id: string; title: string; detail: string; tone: string }[] = [];
      (trials.data ?? []).forEach((s) =>
        items.push({
          id: `t-${s.id}`,
          title: "Trial vencendo",
          detail: `${s.name} — expira ${relative(s.subscription_expires_at)}`,
          tone: "text-amber-600",
        }),
      );
      (suspended.data ?? []).forEach((s) =>
        items.push({
          id: `s-${s.id}`,
          title: "Escola suspensa",
          detail: s.name,
          tone: "text-destructive",
        }),
      );
      (recent.data ?? []).forEach((s) =>
        items.push({
          id: `n-${s.id}`,
          title: "Nova escola",
          detail: `${s.name} — criada ${relative(s.created_at)}`,
          tone: "text-emerald-600",
        }),
      );
      return items;
    },
  });

  const count = data?.length ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-xl"
          aria-label="Notificações"
        >
          <Bell className="size-4" />
          {count > 0 && (
            <span className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-2xl p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notificações</p>
          <p className="text-xs text-muted-foreground">Eventos que exigem atenção</p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {count === 0 && <p className="p-4 text-sm text-muted-foreground">Nada por aqui.</p>}
          {data?.map((n) => (
            <div
              key={n.id}
              className="border-b border-border/60 px-4 py-3 last:border-0 hover:bg-muted/50"
            >
              <p className={`text-sm font-medium ${n.tone}`}>{n.title}</p>
              <p className="truncate text-xs text-muted-foreground">{n.detail}</p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function TopBar() {
  const { data: user } = useCurrentUser();
  const crumbs = useBreadcrumbs();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isAdmin = user?.primaryRole === "super_admin";
  const impersonation = useImpersonation();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="sticky top-0 z-20">
      <header className="flex h-14 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-xl sm:px-4">
        <SidebarTrigger className="shrink-0" />
        <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" />

        <Breadcrumb className="hidden min-w-0 flex-1 md:block">
          <BreadcrumbList>
            {crumbs.map((c) => (
              <Fragment key={c.href}>
                <BreadcrumbItem>
                  {c.last ? (
                    <BreadcrumbPage className="truncate">{c.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link to={c.href}>{c.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!c.last && <BreadcrumbSeparator />}
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
          <div className="w-32 min-w-0 sm:w-64">
            <GlobalSearch isAdmin={!!isAdmin} />
          </div>

          <span
            className={`hidden shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium lg:inline-flex ${
              ENV_IS_PROD
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${ENV_IS_PROD ? "bg-emerald-500" : "bg-amber-500"}`}
            />
            {ENV_IS_PROD ? "Produção" : "Homologação"}
          </span>

          {isAdmin && (
            <Button asChild size="sm" className="hidden rounded-xl sm:inline-flex">
              <Link to="/app/admin/schools" search={{ new: true }}>
                <Plus className="size-4" /> Nova escola
              </Link>
            </Button>
          )}

          <Notifications isAdmin={!!isAdmin} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl" aria-label="Perfil">
                <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-primary">
                  <UserRound className="size-4" />
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl">
              <DropdownMenuLabel className="truncate">
                {user?.profile?.full_name ?? "Usuário"}
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {user?.email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/app/profile">
                  <UserRound className="size-4" /> Perfil
                </Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link to="/app/admin/settings">
                    <ShieldCheck className="size-4" /> Configurações
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={signOut}>
                <LogOut className="size-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {impersonation && (
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
          <ShieldCheck className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            Você está utilizando a conta da escola <strong>{impersonation.schoolName}</strong> em
            modo administrador.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              stopImpersonation();
              qc.invalidateQueries();
              navigate({ to: "/app/admin/schools" });
            }}
          >
            Voltar ao Super Admin
          </Button>
        </div>
      )}
    </div>
  );
}
