import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { gradeAttemptFn } from "@/lib/grading.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, ArrowLeft, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { ProcessRadar } from "@/components/charts";
import { PROCESS_LABEL } from "@/lib/pirls";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ErrorState } from "@/lib/errors/feedback";

export const Route = createFileRoute("/app/student/resultado/$attemptId")({
  head: () => ({ meta: [{ title: "Resultado do simulado | Lecto" }] }),
  component: ResultPage,
});

function ResultPage() {
  const { attemptId } = Route.useParams();
  const qc = useQueryClient();
  const grade = useServerFn(gradeAttemptFn);
  const { data: me } = useCurrentUser();
  const isStaff = !!me?.roles.some((r) => r === "teacher" || r === "school_admin");

  const { data: attempt, isLoading } = useQuery({
    queryKey: ["attempt-result", attemptId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simulado_attempts")
        .select(
          "id, submitted_at, graded_at, total_score, max_score, process_scores, simulados(title)",
        )
        .eq("id", attemptId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => (q.state.data && !q.state.data.graded_at ? 3000 : false),
  });

  const { data: answers } = useQuery({
    queryKey: ["attempt-answers", attemptId, attempt?.graded_at],
    enabled: !!attempt?.graded_at,
    queryFn: async () => {
      const { data } = await supabase
        .from("simulado_answers")
        .select(
          "id, answer, score, max_points, is_correct, ai_feedback, questions:questions_safe(statement, pirls_process, q_type)",
        )
        .eq("attempt_id", attemptId);
      return data ?? [];
    },
  });

  const gradeMut = useMutation({
    mutationFn: () => grade({ data: { attemptId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attempt-result", attemptId] }),
  });

  useEffect(() => {
    if (
      attempt &&
      attempt.submitted_at &&
      !attempt.graded_at &&
      !gradeMut.isPending &&
      !gradeMut.isSuccess
    ) {
      gradeMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.id, attempt?.graded_at]);

  const radarData = useMemo(() => {
    const scores = (attempt?.process_scores ?? {}) as Record<string, number>;
    return Object.keys(PROCESS_LABEL).map((k) => ({
      process: PROCESS_LABEL[k],
      value: scores[k] ?? 0,
    }));
  }, [attempt?.process_scores]);

  if (isLoading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!attempt) {
    return <p className="text-muted-foreground">Resultado não encontrado.</p>;
  }

  const pct = attempt.max_score
    ? Math.round((Number(attempt.total_score) / Number(attempt.max_score)) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to={isStaff ? "/app/teacher/resultados" : "/app/student"}>
            <ArrowLeft className="size-4" /> Voltar
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="font-display text-2xl sm:text-3xl">
          {attempt.simulados?.title ?? "Simulado"}
        </h1>
        <p className="text-muted-foreground">Resultado e feedback por competência de leitura.</p>
      </div>

      {!attempt.graded_at ? (
        <Card className="shadow-soft">
          <CardContent className="p-10">
            {gradeMut.isError ? (
              <div className="space-y-3">
                <ErrorState error={gradeMut.error} retry={() => gradeMut.mutate()} />
                <p className="text-sm text-muted-foreground">Suas respostas estão salvas.</p>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="size-5 animate-spin text-primary" />
                Corrigindo suas respostas com IA…
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="shadow-soft">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Aproveitamento</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-3xl sm:text-4xl">{pct}%</p>
                <Progress value={pct} className="mt-3" />
              </CardContent>
            </Card>
            <Card className="shadow-soft">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Pontuação</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-3xl sm:text-4xl">
                  {Number(attempt.total_score ?? 0)}
                  <span className="text-lg text-muted-foreground">
                    /{Number(attempt.max_score ?? 0)}
                  </span>
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-soft">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Questões</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-3xl sm:text-4xl">{answers?.length ?? 0}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Desempenho por processo PIRLS</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ProcessRadar data={radarData} />
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h2 className="font-display text-xl sm:text-2xl">Correção detalhada</h2>
            {answers?.map((a) => (
              <Card key={a.id} className="shadow-soft">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{a.questions?.statement}</p>
                    <Badge
                      variant={
                        Number(a.score ?? 0) >= Number(a.max_points ?? 1) ? "default" : "secondary"
                      }
                    >
                      {Number(a.score ?? 0)}/{Number(a.max_points ?? 0)}
                    </Badge>
                  </div>
                  {a.questions?.pirls_process && (
                    <Badge variant="outline" className="text-[10px]">
                      {PROCESS_LABEL[a.questions.pirls_process] ?? a.questions.pirls_process}
                    </Badge>
                  )}
                  <p className="rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap">
                    {a.answer || <span className="text-muted-foreground">Sem resposta</span>}
                  </p>
                  {a.ai_feedback && (
                    <p className="flex items-start gap-2 text-sm text-muted-foreground">
                      {a.is_correct === true ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                      ) : a.is_correct === false ? (
                        <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                      ) : (
                        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                      )}
                      {a.ai_feedback}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
