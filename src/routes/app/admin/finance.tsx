import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, StatCard, ChartCard } from "@/components/admin/stat-card";
import { MetricLine, MetricPie } from "@/components/charts";
import { useAdminSchools, computeFinance } from "@/lib/admin/queries";
import { brl, lastMonths, num, TIER_LABEL } from "@/lib/admin/format";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { downloadCsv, toCsv } from "@/lib/admin/format";

export const Route = createFileRoute("/app/admin/finance")({
  head: () => ({ meta: [{ title: "Financeiro — Super Admin | Lecto" }] }),
  component: FinancePage,
});

function FinancePage() {
  const { data: schools } = useAdminSchools();
  const rows = useMemo(() => schools ?? [], [schools]);
  const fin = useMemo(() => computeFinance(rows), [rows]);
  const months = lastMonths(12);

  const { data: plans } = useQuery({
    queryKey: ["finance-plans"],
    queryFn: async () =>
      (await supabase.from("plans").select("id, name, tier, price_cents")).data ?? [],
  });

  const mrrSeries = months.map((k) => {
    const limit = new Date(`${k.key}-01T00:00:00`).getTime() + 31 * 86_400_000;
    const cents = rows
      .filter(
        (s) => s.subscription_status === "active" && new Date(s.created_at).getTime() <= limit,
      )
      .reduce((a, s) => a + s.planPriceCents, 0);
    return { name: k.label, value: Math.round(cents / 100) };
  });

  const revenueByPlan = (plans ?? []).map((p) => ({
    name: p.name,
    value: Math.round(
      rows.filter((s) => s.plan_id === p.id && s.subscription_status === "active").length *
        (p.price_cents / 100),
    ),
  }));

  const topSchools = [...rows]
    .filter((s) => s.subscription_status === "active")
    .sort((a, b) => b.planPriceCents - a.planPriceCents)
    .slice(0, 10);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Financeiro"
        description="Receita recorrente, retenção e projeções da plataforma."
        actions={
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() =>
              downloadCsv(
                "financeiro-lecto.csv",
                toCsv(topSchools, [
                  { key: "name", label: "Escola" },
                  { key: "planName", label: "Plano" },
                  { key: "planPriceCents", label: "Mensalidade (centavos)" },
                ]),
              )
            }
          >
            <Download className="size-4" /> Exportar
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="MRR" value={brl(fin.mrrCents)} hint="Receita recorrente mensal" />
        <StatCard label="ARR" value={brl(fin.arrCents)} hint="Projeção anual" />
        <StatCard label="Ticket médio" value={brl(fin.arpaCents)} hint="Por escola ativa" />
        <StatCard label="LTV estimado" value={brl(fin.ltvCents)} />
        <StatCard label="Churn" value={`${fin.churn.toFixed(1)}%`} />
        <StatCard label="Conversão de trials" value={`${fin.conversion.toFixed(1)}%`} />
        <StatCard label="Escolas ativas" value={num(fin.activeCount)} />
        <StatCard label="Cancelamentos" value={num(fin.cancelled)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Evolução do MRR" description="Últimos 12 meses (R$)">
          <MetricLine data={mrrSeries} formatter={(v) => `R$ ${num(v)}`} />
        </ChartCard>
        <ChartCard title="Receita por plano" description="Distribuição da receita ativa">
          <MetricPie data={revenueByPlan} />
        </ChartCard>
      </div>

      <Card className="overflow-hidden rounded-2xl border-border/70 shadow-soft">
        <div className="border-b border-border/60 px-4 py-3 text-sm font-semibold">
          Maiores contratos
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Escola</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead className="text-right">Mensalidade</TableHead>
                <TableHead className="text-right">Anual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topSchools.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.planName ?? TIER_LABEL.free}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{brl(s.planPriceCents)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {brl(s.planPriceCents * 12)}
                  </TableCell>
                </TableRow>
              ))}
              {topSchools.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                    Nenhum contrato ativo.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
