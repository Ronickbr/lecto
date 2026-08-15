import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { gradeAttemptFn } from "@/lib/grading.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { PROCESS_LABEL } from "@/lib/pirls";
import { ProcessRadar, ScoreBars } from "@/components/charts";

export const Route = createFileRoute("/app/teacher/resultados")({
  head: () => ({ meta: [{ title: "Resultados | Lecto" }] }),
  component: TeacherResults,
});

function TeacherResults() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const grade = useServerFn(gradeAttemptFn);
  const [simuladoId, setSimuladoId] = useState<string>("all");

  const { data: simulados } = useQuery({
    queryKey: ["results-simulados", user?.schoolId],
    enabled: !!user?.schoolId,
    queryFn: async () =>
      (
        await supabase
          .from("simulados")
          .select("id, title")
          .eq("school_id", user!.schoolId!)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const { data: attempts, isLoading } = useQuery({
    queryKey: ["results-attempts", user?.schoolId, simuladoId],
    enabled: !!user?.schoolId,
    queryFn: async () => {
      let q = supabase
        .from("simulado_attempts")
        .select(
          "id, simulado_id, submitted_at, graded_at, total_score, max_score, process_scores, students(full_name, classes(name)), simulados(title)",
        )
        .eq("school_id", user!.schoolId!)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false });
      if (simuladoId !== "all") q = q.eq("simulado_id", simuladoId);
      return (await q).data ?? [];
    },
  });

  // Sem o id em andamento, um clique congelava o botão de todas as linhas.
  const [gradingId, setGradingId] = useState<string | null>(null);
  const gradeMut = useMutation({
    mutationFn: async (attemptId: string) => {
      setGradingId(attemptId);
      return grade({ data: { attemptId } });
    },
    onSettled: () => setGradingId(null),
    onSuccess: () => {
      toast.success("Correção concluída");
      qc.invalidateQueries({ queryKey: ["results-attempts"] });
    },
    onError: () => toast.error("Não foi possível corrigir agora"),
  });

  const graded = useMemo(() => (attempts ?? []).filter((a) => a.graded_at), [attempts]);

  const avg = graded.length
    ? Math.round(
        graded.reduce(
          (s, a) => s + (a.max_score ? (Number(a.total_score) / Number(a.max_score)) * 100 : 0),
          0,
        ) / graded.length,
      )
    : 0;

  const radarData = useMemo(() => {
    const totals: Record<string, { sum: number; n: number }> = {};
    graded.forEach((a) => {
      Object.entries((a.process_scores ?? {}) as Record<string, number>).forEach(([k, v]) => {
        totals[k] = totals[k] ?? { sum: 0, n: 0 };
        totals[k].sum += Number(v);
        totals[k].n += 1;
      });
    });
    return Object.keys(PROCESS_LABEL).map((k) => ({
      process: PROCESS_LABEL[k],
      value: totals[k]?.n ? Math.round(totals[k].sum / totals[k].n) : 0,
    }));
  }, [graded]);

  const barData = useMemo(() => {
    const byClass: Record<string, { sum: number; n: number }> = {};
    graded.forEach((a) => {
      const c = a.students?.classes?.name ?? "Sem turma";
      const pct = a.max_score ? (Number(a.total_score) / Number(a.max_score)) * 100 : 0;
      byClass[c] = byClass[c] ?? { sum: 0, n: 0 };
      byClass[c].sum += pct;
      byClass[c].n += 1;
    });
    return Object.entries(byClass).map(([name, v]) => ({ name, pct: Math.round(v.sum / v.n) }));
  }, [graded]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Resultados</h1>
          <p className="text-muted-foreground">
            Desempenho dos alunos por simulado e competência PIRLS.
          </p>
        </div>
        <Select value={simuladoId} onValueChange={setSimuladoId}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Todos os simulados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os simulados</SelectItem>
            {simulados?.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Entregas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl sm:text-4xl">{attempts?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Corrigidas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl sm:text-4xl">{graded.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Média geral</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl sm:text-4xl">{avg}%</p>
          </CardContent>
        </Card>
      </div>

      {graded.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Competências PIRLS (média)</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ProcessRadar data={radarData} />
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Média por turma</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ScoreBars data={barData} />
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Entregas dos alunos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && (
            <div className="p-6 text-center">
              <Loader2 className="mx-auto size-5 animate-spin text-primary" />
            </div>
          )}
          {!isLoading && (attempts?.length ?? 0) === 0 && (
            <p className="p-6 text-center text-muted-foreground">Nenhuma entrega ainda.</p>
          )}
          {attempts?.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{a.students?.full_name ?? "Aluno"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.simulados?.title} · {a.students?.classes?.name ?? "Sem turma"} ·{" "}
                  {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString("pt-BR") : "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {a.graded_at ? (
                  <>
                    <Badge variant="secondary">Corrigido</Badge>
                    <Badge variant="secondary">
                      {a.max_score
                        ? Math.round((Number(a.total_score) / Number(a.max_score)) * 100)
                        : 0}
                      %
                    </Badge>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/app/student/resultado/$attemptId" params={{ attemptId: a.id }}>
                        <BarChart3 className="size-4" /> Detalhes
                      </Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge variant="outline">Enviado · pendente</Badge>
                    <Button
                      size="sm"
                      onClick={() => gradeMut.mutate(a.id)}
                      disabled={gradingId !== null}
                    >
                      {gradingId === a.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4" />
                      )}
                      Corrigir com IA
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
