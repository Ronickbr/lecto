import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatCard, ChartCard } from "@/components/admin/stat-card";
import { MetricArea } from "@/components/charts";
import { useAdminActivity, useAdminSchools } from "@/lib/admin/queries";
import { fullDate, lastDays, num, relative } from "@/lib/admin/format";
import { Activity, CheckCircle2, Database, Server, Zap } from "lucide-react";

export const Route = createFileRoute("/app/admin/monitoring")({
  head: () => ({ meta: [{ title: "Monitoramento — Super Admin | Lecto" }] }),
  component: MonitoringPage,
});

function MonitoringPage() {
  const { data: activity, isLoading } = useAdminActivity();
  const { data: schools } = useAdminSchools();
  const attempts = useMemo(() => activity?.attempts ?? [], [activity]);

  const live = attempts.filter(
    (a) => !a.submitted_at && Date.now() - new Date(a.started_at).getTime() < 3 * 3_600_000,
  );
  const pendingGrading = attempts.filter((a) => a.submitted_at && !a.graded_at);

  const series = useMemo(() => {
    const days = lastDays(14);
    const m = new Map(days.map((d) => [d.key, 0]));
    attempts.forEach((a) => {
      const k = a.started_at.slice(0, 10);
      if (m.has(k)) m.set(k, (m.get(k) ?? 0) + 1);
    });
    return days.map((d) => ({ name: d.label, value: m.get(d.key) ?? 0 }));
  }, [attempts]);

  const services = [
    { name: "API da aplicação", icon: Server, ok: true, detail: "Respondendo normalmente" },
    {
      name: "Banco de dados",
      icon: Database,
      ok: !isLoading,
      detail: isLoading ? "Consultando…" : "Consultas concluídas",
    },
    {
      name: "Correção com IA",
      icon: Zap,
      ok: pendingGrading.length < 50,
      detail: `${num(pendingGrading.length)} correções pendentes`,
    },
    {
      name: "Sessões de simulado",
      icon: Activity,
      ok: true,
      detail: `${num(live.length)} em andamento`,
    },
  ];

  const busiest = [...(schools ?? [])].sort((a, b) => b.attempts30d - a.attempts30d).slice(0, 6);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Monitoramento"
        description="Saúde operacional da plataforma em tempo quase real."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sessões ativas" value={num(live.length)} icon={Activity} />
        <StatCard label="Correções pendentes" value={num(pendingGrading.length)} icon={Zap} />
        <StatCard label="Tentativas (180d)" value={num(attempts.length)} icon={Database} />
        <StatCard
          label="Escolas ativas hoje"
          value={num(new Set(live.map((a) => a.school_id)).size)}
          icon={Server}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <ChartCard
          title="Carga da plataforma"
          description="Tentativas iniciadas nos últimos 14 dias"
        >
          <MetricArea data={series} />
        </ChartCard>

        <Card className="rounded-2xl border-border/70 shadow-soft">
          <CardContent className="space-y-3 p-5">
            <h3 className="text-sm font-semibold">Status dos serviços</h3>
            {services.map((s) => (
              <div
                key={s.name}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/60 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <s.icon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.detail}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="rounded-lg">
                  <CheckCircle2
                    className={s.ok ? "size-3 text-emerald-500" : "size-3 text-amber-500"}
                  />
                  {s.ok ? "OK" : "Atenção"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/70 shadow-soft">
        <CardContent className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Escolas com maior uso (30 dias)</h3>
          <div className="divide-y divide-border/60">
            {busiest.map((s) => (
              <div
                key={s.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Último acesso {relative(s.lastAccess)}
                  </p>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {num(s.attempts30d)} tentativas
                </span>
              </div>
            ))}
            {busiest.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Sem dados de uso ainda.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Atualizado em {fullDate(new Date().toISOString())}
      </p>
    </div>
  );
}
