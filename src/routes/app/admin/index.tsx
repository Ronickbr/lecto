import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { StatCard, ChartCard, PageHeader } from "@/components/admin/stat-card";
import { MetricArea, MetricBars, MetricLine, MetricPie } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  useAdminSchools,
  useAdminActivity,
  computeFinance,
  groupByMonth,
} from "@/lib/admin/queries";
import { brl, lastDays, lastMonths, num, relative, TIER_LABEL } from "@/lib/admin/format";
import { StatusBadge } from "@/components/admin/badges";
import {
  Building2,
  CheckCircle2,
  Clock,
  PauseCircle,
  Users,
  GraduationCap,
  FileText,
  MessageSquare,
  DollarSign,
  CalendarRange,
  TrendingUp,
  XCircle,
  Sparkles,
  Radio,
  Timer,
  ArrowUpRight,
} from "lucide-react";

export const Route = createFileRoute("/app/admin/")({
  head: () => ({ meta: [{ title: "Dashboard executivo — Super Admin | Lecto" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: schools, isLoading } = useAdminSchools();
  const { data: activity } = useAdminActivity();

  const rows = useMemo(() => schools ?? [], [schools]);
  const fin = useMemo(() => computeFinance(rows), [rows]);

  const totals = useMemo(() => {
    const students = rows.reduce((a, s) => a + s.students, 0);
    const teachers = rows.reduce((a, s) => a + s.teachers, 0);
    const simulados = rows.reduce((a, s) => a + s.simulados, 0);
    const today = new Date().toISOString().slice(0, 10);
    const answersToday = (activity?.answers ?? []).filter(
      (a) => a.created_at.slice(0, 10) === today,
    ).length;
    const online = (activity?.attempts ?? []).filter(
      (a) => !a.submitted_at && Date.now() - new Date(a.started_at).getTime() < 2 * 3_600_000,
    );
    const schoolsOnline = new Set(online.map((a) => a.school_id)).size;
    const durations = (activity?.attempts ?? [])
      .filter((a) => a.submitted_at)
      .map((a) => new Date(a.submitted_at!).getTime() - new Date(a.started_at).getTime());
    const avgMin = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60_000)
      : 0;
    const cutoff = Date.now() - 30 * 86_400_000;
    const newSubs = rows.filter((s) => new Date(s.created_at).getTime() >= cutoff).length;
    return {
      students,
      teachers,
      simulados,
      answersToday,
      online: online.length,
      schoolsOnline,
      avgMin,
      newSubs,
    };
  }, [rows, activity]);

  const months = lastMonths(12);
  const schoolGrowth = useMemo(() => {
    const m = groupByMonth(rows, months);
    let acc = 0;
    return months.map((k) => {
      acc += m.get(k.key) ?? 0;
      return { name: k.label, value: acc };
    });
  }, [rows, months]);

  const revenueSeries = useMemo(() => {
    // Receita reconhecida por mês: escolas ativas criadas até aquele mês × preço do plano.
    return months.map((k) => {
      const limit = new Date(`${k.key}-01T00:00:00`).getTime() + 31 * 86_400_000;
      const value = rows
        .filter(
          (s) => s.subscription_status === "active" && new Date(s.created_at).getTime() <= limit,
        )
        .reduce((a, s) => a + s.planPriceCents, 0);
      return { name: k.label, value: Math.round(value / 100) };
    });
  }, [rows, months]);

  const attemptsByMonth = useMemo(() => {
    const m = groupByMonth(activity?.attempts ?? [], months);
    return months.map((k) => ({ name: k.label, value: m.get(k.key) ?? 0 }));
  }, [activity, months]);

  const planDistribution = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((s) => {
      const key = s.planTier ? TIER_LABEL[s.planTier] : "Sem plano";
      m.set(key, (m.get(key) ?? 0) + 1);
    });
    return [...m.entries()].map(([name, value]) => ({ name, value }));
  }, [rows]);

  const dailyUsers = useMemo(() => {
    const days = lastDays(30);
    const m = new Map(days.map((d) => [d.key, new Set<string>()]));
    (activity?.attempts ?? []).forEach((a) => {
      const k = a.started_at.slice(0, 10);
      m.get(k)?.add(a.id);
    });
    return days.map((d) => ({ name: d.label, value: m.get(d.key)?.size ?? 0 }));
  }, [activity]);

  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    (activity?.attempts ?? []).forEach((a) => {
      const d = new Date(a.started_at);
      grid[d.getDay()][d.getHours()] += 1;
    });
    const max = Math.max(1, ...grid.flat());
    return { grid, max };
  }, [activity]);

  const cards = [
    { label: "Total de escolas", value: num(rows.length), icon: Building2 },
    { label: "Escolas ativas", value: num(fin.activeCount), icon: CheckCircle2 },
    { label: "Trials ativos", value: num(fin.trials), icon: Clock },
    { label: "Escolas suspensas", value: num(fin.suspended), icon: PauseCircle },
    { label: "Total de alunos", value: num(totals.students), icon: Users },
    { label: "Total de professores", value: num(totals.teachers), icon: GraduationCap },
    { label: "Total de simulados", value: num(totals.simulados), icon: FileText },
    { label: "Questões respondidas hoje", value: num(totals.answersToday), icon: MessageSquare },
    { label: "MRR", value: brl(fin.mrrCents), icon: DollarSign, hint: "Receita recorrente mensal" },
    { label: "ARR", value: brl(fin.arrCents), icon: CalendarRange, hint: "MRR × 12" },
    { label: "Receita mensal", value: brl(fin.mrrCents), icon: TrendingUp, hint: "Mês corrente" },
    { label: "Receita anual", value: brl(fin.arrCents), icon: TrendingUp, hint: "Projeção" },
    { label: "Cancelamentos", value: num(fin.cancelled), icon: XCircle },
    {
      label: "Novas assinaturas",
      value: num(totals.newSubs),
      icon: Sparkles,
      hint: "Últimos 30 dias",
    },
    {
      label: "Usuários online",
      value: num(totals.online),
      icon: Radio,
      hint: "Tentativas em andamento",
    },
    { label: "Escolas online", value: num(totals.schoolsOnline), icon: Building2 },
    {
      label: "Tempo médio de uso",
      value: `${totals.avgMin} min`,
      icon: Timer,
      hint: "Por simulado concluído",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Dashboard executivo"
        description="Visão consolidada da operação, do uso e da receita da plataforma."
        actions={
          <>
            <Button variant="outline" className="rounded-xl" asChild>
              <Link to="/app/admin/reports">Relatórios</Link>
            </Button>
            <Button className="rounded-xl" asChild>
              <Link to="/app/admin/schools" search={{ new: true }}>
                Nova escola
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} loading={isLoading} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Crescimento de escolas" description="Acumulado nos últimos 12 meses">
          <MetricLine data={schoolGrowth} />
        </ChartCard>
        <ChartCard title="Receita mensal" description="MRR reconhecido por mês (R$)">
          <MetricLine data={revenueSeries} formatter={(v) => `R$ ${num(v)}`} />
        </ChartCard>
        <ChartCard title="Simulados realizados" description="Tentativas iniciadas por mês">
          <MetricBars data={attemptsByMonth} />
        </ChartCard>
        <ChartCard title="Distribuição dos planos" description="Escolas por plano contratado">
          <MetricPie data={planDistribution} />
        </ChartCard>
        <ChartCard title="Usuários ativos por dia" description="Últimos 30 dias" height={240}>
          <MetricArea data={dailyUsers} />
        </ChartCard>

        <Card className="rounded-2xl border-border/70 shadow-soft">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold">Acessos da plataforma</h3>
            <p className="mb-4 mt-0.5 text-xs text-muted-foreground">
              Heatmap por dia da semana e hora
            </p>
            <div className="overflow-x-auto">
              <div className="min-w-[520px] space-y-1">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day, di) => (
                  <div key={day} className="flex items-center gap-1">
                    <span className="w-8 shrink-0 text-[10px] text-muted-foreground">{day}</span>
                    {heatmap.grid[di].map((v, hi) => (
                      <span
                        key={hi}
                        title={`${day} ${hi}h — ${v} acessos`}
                        className="h-4 flex-1 rounded-[3px] bg-primary transition-transform hover:scale-125"
                        style={{ opacity: v === 0 ? 0.06 : 0.2 + (v / heatmap.max) * 0.8 }}
                      />
                    ))}
                  </div>
                ))}
                <div className="flex items-center gap-1 pt-1 text-[10px] text-muted-foreground">
                  <span className="w-8" />
                  <span>0h</span>
                  <span className="ml-auto">23h</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/70 shadow-soft">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Escolas recentes</h3>
            <Button variant="ghost" size="sm" className="rounded-xl" asChild>
              <Link to="/app/admin/schools">
                Ver todas <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="divide-y divide-border/60">
            {rows.slice(0, 5).map((s) => (
              <Link
                key={s.id}
                to="/app/admin/schools/$id"
                params={{ id: s.id }}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[s.city, s.state].filter(Boolean).join("/") || "—"} · último acesso{" "}
                    {relative(s.lastAccess)}
                  </p>
                </div>
                <StatusBadge status={s.subscription_status} />
              </Link>
            ))}
            {rows.length === 0 && !isLoading && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma escola cadastrada ainda.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
