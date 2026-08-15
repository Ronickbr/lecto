import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { downloadCsv, fullDate, num, toCsv } from "@/lib/admin/format";
import { Download, Search } from "lucide-react";

export const Route = createFileRoute("/app/admin/audit")({
  head: () => ({ meta: [{ title: "Auditoria — Super Admin | Lecto" }] }),
  component: AuditPage,
});

function AuditPage() {
  const { data: schools } = useAdminSchools();
  const [q, setQ] = useState("");
  const [action, setAction] = useState("all");

  const { data: logs } = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("logs")
        .select("id, action, entity, entity_id, school_id, actor_user_id, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
  });

  const schoolName = useMemo(() => new Map((schools ?? []).map((s) => [s.id, s.name])), [schools]);
  const actions = useMemo(() => [...new Set((logs ?? []).map((l) => l.action))], [logs]);

  const list = (logs ?? []).filter(
    (l) =>
      (action === "all" || l.action === action) &&
      [l.action, l.entity ?? "", l.school_id ? (schoolName.get(l.school_id) ?? "") : ""].some((v) =>
        v.toLowerCase().includes(q.trim().toLowerCase()),
      ),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Auditoria"
        description="Trilha de ações sensíveis registradas pela plataforma."
        actions={
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() =>
              downloadCsv(
                "auditoria-lecto.csv",
                toCsv(list, [
                  { key: "created_at", label: "Data" },
                  { key: "action", label: "Ação" },
                  { key: "entity", label: "Entidade" },
                  { key: "school_id", label: "Escola" },
                ]),
              )
            }
          >
            <Download className="size-4" /> Exportar
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Eventos registrados" value={num(logs?.length ?? 0)} />
        <StatCard label="Tipos de ação" value={num(actions.length)} />
        <StatCard
          label="Escolas envolvidas"
          value={num(new Set((logs ?? []).map((l) => l.school_id)).size)}
        />
      </div>

      <Card className="rounded-2xl border-border/70 p-4 shadow-soft">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="rounded-xl pl-9"
              placeholder="Buscar por ação, entidade ou escola…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              {actions.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-2xl border-border/70 shadow-soft">
        <div className="overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Data</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>Escola</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-muted-foreground">{fullDate(l.created_at)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="rounded-lg">
                      {l.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{l.entity ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.school_id ? (schoolName.get(l.school_id) ?? "—") : "Plataforma"}
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                    Nenhum evento de auditoria registrado até o momento.
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
