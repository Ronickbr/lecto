import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, StatCard } from "@/components/admin/stat-card";
import { PlanBadge, StatusBadge } from "@/components/admin/badges";
import { useAdminSchools, computeFinance } from "@/lib/admin/queries";
import { brl, downloadCsv, num, shortDate, toCsv } from "@/lib/admin/format";
import { Download, Search } from "lucide-react";

export const Route = createFileRoute("/app/admin/subscriptions")({
  head: () => ({ meta: [{ title: "Assinaturas — Super Admin | Lecto" }] }),
  component: SubscriptionsPage,
});

function SubscriptionsPage() {
  const { data: schools } = useAdminSchools();
  const rows = useMemo(() => schools ?? [], [schools]);
  const fin = useMemo(() => computeFinance(rows), [rows]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const list = rows.filter(
    (s) =>
      (status === "all" || s.subscription_status === status) &&
      s.name.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Assinaturas"
        description="Contratos ativos, trials e renovações da plataforma."
        actions={
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() =>
              downloadCsv(
                "assinaturas-lecto.csv",
                toCsv(list, [
                  { key: "name", label: "Escola" },
                  { key: "planName", label: "Plano" },
                  { key: "subscription_status", label: "Status" },
                  { key: "subscription_expires_at", label: "Vence em" },
                ]),
              )
            }
          >
            <Download className="size-4" /> Exportar
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Assinaturas ativas" value={num(fin.activeCount)} />
        <StatCard label="Em trial" value={num(fin.trials)} />
        <StatCard label="Suspensas" value={num(fin.suspended)} />
        <StatCard label="Receita mensal" value={brl(fin.mrrCents)} />
      </div>

      <Card className="rounded-2xl border-border/70 p-4 shadow-soft">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="rounded-xl pl-9"
              placeholder="Buscar escola…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="active">Ativa</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="suspended">Suspensa</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-2xl border-border/70 shadow-soft">
        <div className="overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Escola</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Mensalidade</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Vencimento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link
                      to="/app/admin/schools/$id"
                      params={{ id: s.id }}
                      className="hover:text-primary"
                    >
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <PlanBadge tier={s.planTier} name={s.planName} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={s.subscription_status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{brl(s.planPriceCents)}</TableCell>
                  <TableCell className="text-muted-foreground">{shortDate(s.created_at)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {shortDate(s.subscription_expires_at)}
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    Nenhuma assinatura encontrada.
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
