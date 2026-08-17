import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  School,
  Users,
  UserRound,
  FileText,
  Library,
  BarChart3,
  Plus,
  ArrowRight,
  CheckCircle2,
  Package,
} from "lucide-react";

export const Route = createFileRoute("/app/school/")({
  head: () => ({
    meta: [
      { title: "Escola — Visão geral | Lecto" },
      {
        name: "description",
        content:
          "Painel da instituição: turmas, alunos, professores, simulados e atividade recente.",
      },
    ],
  }),
  component: SchoolOverview,
});

function SchoolOverview() {
  const { data: user } = useCurrentUser();
  const schoolId = user?.schoolId;

  const { data } = useQuery({
    queryKey: ["school-overview", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const [school, teachers, classes, students, simulados, recent, attempts, simuladosMonth] =
        await Promise.all([
          supabase
            .from("schools")
            .select(
              "name, slug, city, state, plan_id, plans(name, max_teachers, max_students, max_simulados_month)",
            )
            .eq("id", schoolId!)
            .maybeSingle(),
          supabase
            .from("teachers")
            .select("id", { count: "exact", head: true })
            .eq("school_id", schoolId!),
          supabase
            .from("classes")
            .select("id", { count: "exact", head: true })
            .eq("school_id", schoolId!),
          supabase
            .from("students")
            .select("id", { count: "exact", head: true })
            .eq("school_id", schoolId!),
          supabase
            .from("simulados")
            .select("id, title, status, time_limit_minutes")
            .eq("school_id", schoolId!)
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("simulado_attempts")
            .select("id, started_at, submitted_at, total_score, max_score")
            .eq("school_id", schoolId!)
            .order("started_at", { ascending: false })
            .limit(8),
          supabase
            .from("simulado_attempts")
            .select("id", { count: "exact", head: true })
            .eq("school_id", schoolId!)
            .gte("started_at", since),
          supabase
            .from("simulados")
            .select("id", { count: "exact", head: true })
            .eq("school_id", schoolId!)
            .gte("created_at", monthStart.toISOString()),
        ]);
      return {
        school: school.data,
        teachers: teachers.count ?? 0,
        classes: classes.count ?? 0,
        students: students.count ?? 0,
        simulados: simulados.data ?? [],
        recent: recent.data ?? [],
        attempts30d: attempts.count ?? 0,
        simuladosMonth: simuladosMonth.count ?? 0,
      };
    },
  });

  const stats = [
    {
      label: "Professores",
      value: data?.teachers ?? 0,
      icon: UserRound,
      to: "/app/school/teachers" as const,
    },
    {
      label: "Turmas",
      value: data?.classes ?? 0,
      icon: School,
      to: "/app/school/classes" as const,
    },
    {
      label: "Alunos",
      value: data?.students ?? 0,
      icon: Users,
      to: "/app/school/students" as const,
    },
    {
      label: "Tentativas (30d)",
      value: data?.attempts30d ?? 0,
      icon: BarChart3,
      to: "/app/teacher/resultados" as const,
    },
  ];

  const actions = [
    {
      label: "Profissionais (Pedagogos/Diretoria)",
      to: "/app/school/teachers" as const,
      icon: UserRound,
    },
    { label: "Turmas", to: "/app/school/classes" as const, icon: School },
    { label: "Cadastrar alunos", to: "/app/school/students" as const, icon: Users },
    { label: "Novo simulado", to: "/app/school/simulados" as const, icon: FileText },
    { label: "Banco de textos", to: "/app/school/texts" as const, icon: Library },
    { label: "Rubricas da IA", to: "/app/teacher/rubricas" as const, icon: CheckCircle2 },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl">
          {data?.school?.name ?? "Minha escola"}
        </h1>
        <p className="text-muted-foreground">
          {data?.school?.city
            ? `${data.school.city}${data.school.state ? ` / ${data.school.state}` : ""}`
            : "Visão geral da escola."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} to={s.to}>
            <Card className="h-full shadow-soft transition-colors hover:border-primary/40">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {s.label}
                </CardTitle>
                <s.icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="font-display text-2xl sm:text-3xl">{s.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {data?.school?.plans && (
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="size-5 text-primary" /> Plano e limites
            </CardTitle>
            <Badge variant="outline">{data.school.plans.name}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Professores", used: data.teachers, max: data.school.plans.max_teachers },
              { label: "Alunos", used: data.students, max: data.school.plans.max_students },
              {
                label: "Simulados neste mês",
                used: data.simuladosMonth,
                max: data.school.plans.max_simulados_month,
              },
            ].map((row) => {
              const pct = row.max ? Math.min(100, Math.round((row.used / row.max) * 100)) : 0;
              const over = row.max > 0 && row.used >= row.max;
              return (
                <div key={row.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className={cn("font-medium tabular-nums", over && "text-destructive")}>
                      {row.used}
                      {row.max > 0 ? ` / ${row.max}` : ""}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-accent">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        over ? "bg-destructive" : "bg-primary",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="size-5 text-primary" /> Ações rápidas
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {actions.map((a) => (
            <Button key={a.label} asChild variant="outline" className="justify-start">
              <Link to={a.to}>
                <a.icon className="size-4" /> {a.label}
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5 text-primary" /> Simulados recentes
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/school/simulados">
                Ver todos <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.simulados ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum simulado criado ainda.</p>
            )}
            {(data?.simulados ?? []).map((s) => (
              <Link
                key={s.id}
                to="/app/school/simulados/$id"
                params={{ id: s.id }}
                className="flex items-center justify-between rounded-md border border-border p-3 hover:bg-accent/40"
              >
                <span className="min-w-0 truncate font-medium">{s.title}</span>
                <Badge variant={s.status === "published" ? "default" : "outline"}>{s.status}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-5 text-primary" /> Atividade recente
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/teacher/tentativas">
                Tentativas <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {(data?.recent ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma tentativa registrada ainda.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {(data?.recent ?? []).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-muted-foreground">
                      {new Date(a.started_at).toLocaleString("pt-BR")}
                    </span>
                    {a.submitted_at ? (
                      <Badge variant="secondary">
                        {a.total_score != null && a.max_score
                          ? `${Math.round((Number(a.total_score) / Number(a.max_score)) * 100)}%`
                          : "Enviado"}
                      </Badge>
                    ) : (
                      <Badge>Em andamento</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
