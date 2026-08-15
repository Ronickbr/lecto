import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, LogIn, Save } from "lucide-react";
import { toast } from "sonner";
import { HealthBadge, PlanBadge, StatusBadge } from "@/components/admin/badges";
import { StatCard, ChartCard } from "@/components/admin/stat-card";
import { MetricBars } from "@/components/charts";
import { useAdminSchools } from "@/lib/admin/queries";
import { brl, fullDate, lastMonths, monthKey, num, relative, shortDate } from "@/lib/admin/format";
import { startImpersonation } from "@/lib/admin/impersonation";

type Tab = "overview" | "users" | "activity" | "subscription" | "settings";

export const Route = createFileRoute("/app/admin/schools/$id")({
  head: () => ({ meta: [{ title: "Detalhe da escola — Super Admin | Lecto" }] }),
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => ({
    tab: (s.tab as Tab) || undefined,
  }),
  component: SchoolDetail,
});

function SchoolDetail() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const { data: schools, isLoading } = useAdminSchools();
  const school = (schools ?? []).find((s) => s.id === id);

  const { data: detail } = useQuery({
    queryKey: ["admin-school-detail", id],
    queryFn: async () => {
      const [teachers, students, classes, simulados, attempts, plans] = await Promise.all([
        supabase
          .from("teachers")
          .select("id, full_name, email, subjects, created_at")
          .eq("school_id", id),
        supabase
          .from("students")
          .select("id, full_name, student_code, created_at")
          .eq("school_id", id),
        supabase.from("classes").select("id, name, grade, class_code").eq("school_id", id),
        supabase
          .from("simulados")
          .select("id, title, status, created_at")
          .eq("school_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("simulado_attempts")
          .select("id, started_at, submitted_at, total_score, max_score")
          .eq("school_id", id),
        supabase.from("plans").select("id, name").eq("active", true).order("price_cents"),
      ]);
      return {
        teachers: teachers.data ?? [],
        students: students.data ?? [],
        classes: classes.data ?? [],
        simulados: simulados.data ?? [],
        attempts: attempts.data ?? [],
        plans: plans.data ?? [],
      };
    },
  });

  const [form, setForm] = useState<{
    name?: string;
    city?: string;
    state?: string;
    plan_id?: string | null;
    subscription_status?: string;
  }>({});
  const value = <K extends keyof typeof form>(k: K, fallback: unknown) =>
    (form[k] ?? fallback ?? "") as string;

  const months = lastMonths(6);
  const attemptSeries = useMemo(() => {
    const m = new Map(months.map((k) => [k.key, 0]));
    (detail?.attempts ?? []).forEach((a) => {
      const k = monthKey(a.started_at);
      if (m.has(k)) m.set(k, (m.get(k) ?? 0) + 1);
    });
    return months.map((k) => ({ name: k.label, value: m.get(k.key) ?? 0 }));
  }, [detail, months]);

  const avgScore = useMemo(() => {
    const graded = (detail?.attempts ?? []).filter((a) => a.total_score != null && a.max_score);
    if (!graded.length) return 0;
    return Math.round(
      (graded.reduce((acc, a) => acc + Number(a.total_score) / Number(a.max_score), 0) /
        graded.length) *
        100,
    );
  }, [detail]);

  async function save() {
    const { error } = await supabase
      .from("schools")
      .update({
        ...(form.name !== undefined ? { name: form.name } : {}),
        ...(form.city !== undefined ? { city: form.city } : {}),
        ...(form.state !== undefined ? { state: form.state } : {}),
        ...(form.plan_id !== undefined ? { plan_id: form.plan_id } : {}),
        ...(form.subscription_status !== undefined
          ? { subscription_status: form.subscription_status as "active" }
          : {}),
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Alterações salvas");
    qc.invalidateQueries({ queryKey: ["admin-schools-full"] });
  }

  if (isLoading) return <Skeleton className="h-72 w-full rounded-2xl" />;
  if (!school) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <p className="text-lg font-medium">Escola não encontrada</p>
        <Button className="mt-4 rounded-xl" asChild>
          <Link to="/app/admin/schools">Voltar para escolas</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2 rounded-xl" asChild>
        <Link to="/app/admin/schools">
          <ArrowLeft className="size-4" /> Escolas
        </Link>
      </Button>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary">
            {school.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl sm:text-2xl">{school.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusBadge status={school.subscription_status} />
              <PlanBadge tier={school.planTier} name={school.planName} />
              <HealthBadge health={school.health} />
            </div>
          </div>
        </div>
        <Button
          className="rounded-xl"
          onClick={() => {
            startImpersonation({ schoolId: school.id, schoolName: school.name });
            qc.invalidateQueries();
            navigate({ to: "/app/school" });
          }}
        >
          <LogIn className="size-4" /> Entrar como administrador
        </Button>
      </div>

      <Tabs
        value={tab ?? "overview"}
        onValueChange={(v) => navigate({ search: { tab: v as Tab } })}
      >
        <TabsList className="w-full justify-start overflow-x-auto rounded-xl">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="activity">Atividades</TabsTrigger>
          <TabsTrigger value="subscription">Assinatura</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Alunos" value={num(school.students)} />
            <StatCard label="Professores" value={num(school.teachers)} />
            <StatCard label="Turmas" value={num(school.classes)} />
            <StatCard label="Simulados" value={num(school.simulados)} />
            <StatCard label="Tentativas (30d)" value={num(school.attempts30d)} />
            <StatCard label="Desempenho médio" value={`${avgScore}%`} />
            <StatCard label="Último acesso" value={relative(school.lastAccess)} />
            <StatCard label="Cliente desde" value={shortDate(school.created_at)} />
          </div>
          <ChartCard title="Uso nos últimos 6 meses" description="Tentativas de simulado iniciadas">
            <MetricBars data={attemptSeries} />
          </ChartCard>
        </TabsContent>

        <TabsContent value="users" className="space-y-4 pt-4">
          <Card className="overflow-hidden rounded-2xl border-border/70 shadow-soft">
            <div className="border-b border-border/60 px-4 py-3 text-sm font-semibold">
              Professores
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Desde</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(detail?.teachers ?? []).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{t.email}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {shortDate(t.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!detail?.teachers.length && (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                        Nenhum professor cadastrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-border/70 shadow-soft">
            <div className="border-b border-border/60 px-4 py-3 text-sm font-semibold">Alunos</div>
            <div className="overflow-x-auto">
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Desde</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(detail?.students ?? []).slice(0, 25).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.student_code}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {shortDate(s.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!detail?.students.length && (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                        Nenhum aluno cadastrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="pt-4">
          <Card className="overflow-hidden rounded-2xl border-border/70 shadow-soft">
            <div className="overflow-x-auto">
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Simulado</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(detail?.simulados ?? []).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.title}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{s.status}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {fullDate(s.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!detail?.simulados.length && (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                        Nenhuma atividade registrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="subscription" className="space-y-4 pt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Plano atual" value={school.planName ?? "Sem plano"} />
            <StatCard label="Mensalidade" value={brl(school.planPriceCents)} />
            <StatCard label="Vence em" value={shortDate(school.subscription_expires_at)} />
          </div>
          <Card className="rounded-2xl border-border/70 shadow-soft">
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select
                  value={value("plan_id", school.plan_id)}
                  onValueChange={(v) => setForm({ ...form, plan_id: v })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {(detail?.plans ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={value("subscription_status", school.subscription_status)}
                  onValueChange={(v) => setForm({ ...form, subscription_status: v })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="suspended">Suspensa</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Button className="rounded-xl" onClick={save}>
                  <Save className="size-4" /> Salvar assinatura
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="pt-4">
          <Card className="rounded-2xl border-border/70 shadow-soft">
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Nome da escola</Label>
                <Input
                  className="rounded-xl"
                  value={value("name", school.name)}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input
                  className="rounded-xl"
                  value={value("city", school.city)}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                <Input
                  maxLength={2}
                  className="rounded-xl"
                  value={value("state", school.state)}
                  onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="sm:col-span-2">
                <Button className="rounded-xl" onClick={save}>
                  <Save className="size-4" /> Salvar alterações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
