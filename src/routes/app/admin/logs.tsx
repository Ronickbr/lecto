import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, StatCard } from "@/components/admin/stat-card";
import { useAdminSchools } from "@/lib/admin/queries";
import { fullDate, num } from "@/lib/admin/format";
import { Search } from "lucide-react";

export const Route = createFileRoute("/app/admin/logs")({
  head: () => ({ meta: [{ title: "Logs do sistema — Super Admin | Lecto" }] }),
  component: LogsPage,
});

/** Linha do tempo operacional derivada dos eventos reais da plataforma. */
function LogsPage() {
  const { data: schools } = useAdminSchools();
  const [q, setQ] = useState("");

  const { data } = useQuery({
    queryKey: ["admin-system-logs"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const [logs, attempts, simulados] = await Promise.all([
        supabase
          .from("logs")
          .select("id, action, entity, school_id, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("simulado_attempts")
          .select("id, school_id, started_at, submitted_at, graded_at")
          .gte("started_at", since)
          .order("started_at", { ascending: false })
          .limit(200),
        supabase
          .from("simulados")
          .select("id, title, school_id, created_at, published_at")
          .gte("created_at", since)
          .limit(200),
      ]);
      return {
        logs: logs.data ?? [],
        attempts: attempts.data ?? [],
        simulados: simulados.data ?? [],
      };
    },
  });

  const schoolName = useMemo(() => new Map((schools ?? []).map((s) => [s.id, s.name])), [schools]);

  const events = useMemo(() => {
    if (!data) return [];
    const out: {
      id: string;
      at: string;
      level: "info" | "success" | "warn";
      message: string;
      school: string;
    }[] = [];
    data.logs.forEach((l) =>
      out.push({
        id: `log-${l.id}`,
        at: l.created_at,
        level: "info",
        message: `${l.action}${l.entity ? ` · ${l.entity}` : ""}`,
        school: l.school_id ? (schoolName.get(l.school_id) ?? "—") : "Plataforma",
      }),
    );
    data.simulados.forEach((s) =>
      out.push({
        id: `sim-${s.id}`,
        at: s.published_at ?? s.created_at,
        level: s.published_at ? "success" : "info",
        message: s.published_at ? `Simulado publicado: ${s.title}` : `Simulado criado: ${s.title}`,
        school: schoolName.get(s.school_id) ?? "—",
      }),
    );
    data.attempts.forEach((a) =>
      out.push({
        id: `att-${a.id}`,
        at: a.graded_at ?? a.submitted_at ?? a.started_at,
        level: a.graded_at ? "success" : a.submitted_at ? "info" : "warn",
        message: a.graded_at
          ? "Tentativa corrigida pela IA"
          : a.submitted_at
            ? "Tentativa enviada"
            : "Tentativa em andamento",
        school: schoolName.get(a.school_id) ?? "—",
      }),
    );
    return out.sort((a, b) => b.at.localeCompare(a.at));
  }, [data, schoolName]);

  const list = events.filter((e) =>
    [e.message, e.school].some((v) => v.toLowerCase().includes(q.trim().toLowerCase())),
  );

  const LEVEL: Record<string, string> = {
    info: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Logs do sistema"
        description="Eventos recentes de todas as escolas (últimos 30 dias)."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Eventos" value={num(events.length)} />
        <StatCard
          label="Correções concluídas"
          value={num(events.filter((e) => e.level === "success").length)}
        />
        <StatCard
          label="Sessões em andamento"
          value={num(events.filter((e) => e.level === "warn").length)}
        />
      </div>

      <Card className="rounded-2xl border-border/70 p-4 shadow-soft">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="rounded-xl pl-9"
            placeholder="Filtrar eventos…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </Card>

      <Card className="overflow-hidden rounded-2xl border-border/70 shadow-soft">
        <div className="overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Quando</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Escola</TableHead>
                <TableHead>Nível</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.slice(0, 150).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {fullDate(e.at)}
                  </TableCell>
                  <TableCell className="font-medium">{e.message}</TableCell>
                  <TableCell className="text-muted-foreground">{e.school}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`rounded-lg ${LEVEL[e.level]}`}>
                      {e.level}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                    Nenhum evento no período.
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
