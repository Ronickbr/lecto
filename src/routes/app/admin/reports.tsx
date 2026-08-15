import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, ChartCard, StatCard } from "@/components/admin/stat-card";
import { MetricArea, MetricBars, MetricPie } from "@/components/charts";
import { useAdminActivity, useAdminSchools } from "@/lib/admin/queries";
import { brl, downloadCsv, lastDays, lastMonths, monthKey, num, toCsv } from "@/lib/admin/format";
import { Download, FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/app/admin/reports")({
  head: () => ({ meta: [{ title: "Relatórios — Super Admin | Lecto" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data: schools } = useAdminSchools();
  const { data: activity } = useAdminActivity();
  const rows = useMemo(() => schools ?? [], [schools]);
  const [range, setRange] = useState("90");

  const days = Number(range);
  const cutoff = Date.now() - days * 86_400_000;
  const attempts = (activity?.attempts ?? []).filter(
    (a) => new Date(a.started_at).getTime() >= cutoff,
  );

  const months = lastMonths(6);
  const attemptsByMonth = useMemo(() => {
    const m = new Map(months.map((k) => [k.key, 0]));
    attempts.forEach((a) => {
      const k = monthKey(a.started_at);
      if (m.has(k)) m.set(k, (m.get(k) ?? 0) + 1);
    });
    return months.map((k) => ({ name: k.label, value: m.get(k.key) ?? 0 }));
  }, [attempts, months]);

  const dailySeries = useMemo(() => {
    const d = lastDays(Math.min(days, 60));
    const m = new Map(d.map((x) => [x.key, 0]));
    attempts.forEach((a) => {
      const k = a.started_at.slice(0, 10);
      if (m.has(k)) m.set(k, (m.get(k) ?? 0) + 1);
    });
    return d.map((x) => ({ name: x.label, value: m.get(x.key) ?? 0 }));
  }, [attempts, days]);

  const engagement = useMemo(() => {
    const byStatus = new Map<string, number>();
    rows.forEach((s) => byStatus.set(s.health, (byStatus.get(s.health) ?? 0) + 1));
    return [
      { name: "Saudáveis", value: byStatus.get("healthy") ?? 0 },
      { name: "Uso baixo", value: byStatus.get("low") ?? 0 },
      { name: "Inativas", value: byStatus.get("inactive") ?? 0 },
    ];
  }, [rows]);

  const conclusion = attempts.length
    ? Math.round((attempts.filter((a) => a.submitted_at).length / attempts.length) * 100)
    : 0;

  const reports = [
    {
      title: "Escolas e uso",
      description: "Cadastro, plano, volume de alunos e engajamento por instituição.",
      run: () =>
        downloadCsv(
          "relatorio-escolas.csv",
          toCsv(rows, [
            { key: "name", label: "Escola" },
            { key: "planName", label: "Plano" },
            { key: "subscription_status", label: "Status" },
            { key: "students", label: "Alunos" },
            { key: "teachers", label: "Professores" },
            { key: "simulados", label: "Simulados" },
            { key: "attempts30d", label: "Tentativas 30d" },
            { key: "health", label: "Saúde" },
          ]),
        ),
    },
    {
      title: "Receita por escola",
      description: "Mensalidade contratada e receita anual projetada.",
      run: () =>
        downloadCsv(
          "relatorio-receita.csv",
          toCsv(
            rows.map((s) => ({
              ...s,
              mensal: brl(s.planPriceCents),
              anual: brl(s.planPriceCents * 12),
            })),
            [
              { key: "name", label: "Escola" },
              { key: "planName", label: "Plano" },
              { key: "mensal", label: "Mensalidade" },
              { key: "anual", label: "Anual" },
            ],
          ),
        ),
    },
    {
      title: "Tentativas de simulado",
      description: "Registro bruto das tentativas do período selecionado.",
      run: () =>
        downloadCsv(
          "relatorio-tentativas.csv",
          toCsv(attempts, [
            { key: "id", label: "Tentativa" },
            { key: "school_id", label: "Escola" },
            { key: "started_at", label: "Início" },
            { key: "submitted_at", label: "Envio" },
            { key: "graded_at", label: "Correção" },
          ]),
        ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Relatórios"
        description="Exporte dados consolidados de uso, engajamento e receita."
        actions={
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-40 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="180">Últimos 180 dias</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tentativas no período" value={num(attempts.length)} />
        <StatCard label="Taxa de conclusão" value={`${conclusion}%`} />
        <StatCard
          label="Escolas com uso"
          value={num(new Set(attempts.map((a) => a.school_id)).size)}
        />
        <StatCard label="Escolas cadastradas" value={num(rows.length)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Tentativas por dia" description="Volume diário no período">
          <MetricArea data={dailySeries} />
        </ChartCard>
        <ChartCard title="Tentativas por mês" description="Últimos 6 meses">
          <MetricBars data={attemptsByMonth} />
        </ChartCard>
        <ChartCard title="Engajamento das escolas" description="Distribuição por saúde de uso">
          <MetricPie data={engagement} />
        </ChartCard>
        <Card className="rounded-2xl border-border/70 shadow-soft">
          <CardContent className="space-y-3 p-5">
            <h3 className="text-sm font-semibold">Exportações</h3>
            {reports.map((r) => (
              <div
                key={r.title}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/60 p-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-medium">
                    <FileSpreadsheet className="size-4 shrink-0 text-primary" /> {r.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>
                </div>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={r.run}>
                  <Download className="size-4" /> CSV
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
