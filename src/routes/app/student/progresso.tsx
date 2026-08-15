import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PROCESS_LABEL } from "@/lib/pirls";
import { ProcessRadar, TrendLine } from "@/components/charts";

export const Route = createFileRoute("/app/student/progresso")({
  head: () => ({ meta: [{ title: "Meu progresso | Lecto" }] }),
  component: ProgressPage,
});

function ProgressPage() {
  const { data: user } = useCurrentUser();

  const { data: student } = useQuery({
    queryKey: ["student-self", user?.userId],
    enabled: !!user?.userId,
    queryFn: async () =>
      (
        await supabase
          .from("students")
          .select("id, full_name")
          .eq("user_id", user!.userId)
          .maybeSingle()
      ).data,
  });

  const { data: attempts } = useQuery({
    queryKey: ["student-graded-attempts", student?.id],
    enabled: !!student?.id,
    queryFn: async () =>
      (
        await supabase
          .from("simulado_attempts")
          .select("id, submitted_at, total_score, max_score, process_scores, simulados(title)")
          .eq("student_id", student!.id)
          .not("graded_at", "is", null)
          .order("submitted_at")
      ).data ?? [],
  });

  const lineData = useMemo(
    () =>
      (attempts ?? []).map((a, i) => ({
        name: a.simulados?.title?.slice(0, 18) ?? `Simulado ${i + 1}`,
        pct: a.max_score ? Math.round((Number(a.total_score) / Number(a.max_score)) * 100) : 0,
      })),
    [attempts],
  );

  const radarData = useMemo(() => {
    const totals: Record<string, { sum: number; n: number }> = {};
    (attempts ?? []).forEach((a) => {
      const scores = (a.process_scores ?? {}) as Record<string, number>;
      Object.entries(scores).forEach(([k, v]) => {
        totals[k] = totals[k] ?? { sum: 0, n: 0 };
        totals[k].sum += Number(v);
        totals[k].n += 1;
      });
    });
    return Object.keys(PROCESS_LABEL).map((k) => ({
      process: PROCESS_LABEL[k],
      value: totals[k]?.n ? Math.round(totals[k].sum / totals[k].n) : 0,
    }));
  }, [attempts]);

  const avg = lineData.length
    ? Math.round(lineData.reduce((s, d) => s + d.pct, 0) / lineData.length)
    : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl">Meu progresso</h1>
        <p className="text-muted-foreground">
          Evolução dos seus simulados e competências de leitura.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Simulados corrigidos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl sm:text-4xl">{attempts?.length ?? 0}</p>
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
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Último resultado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl sm:text-4xl">{lineData.at(-1)?.pct ?? 0}%</p>
          </CardContent>
        </Card>
      </div>

      {(attempts?.length ?? 0) === 0 ? (
        <Card className="shadow-soft">
          <CardContent className="p-10 text-center text-muted-foreground">
            Você ainda não tem simulados corrigidos.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Evolução</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <TrendLine data={lineData} />
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Competências PIRLS (média)</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ProcessRadar data={radarData} />
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Histórico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {attempts?.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{a.simulados?.title ?? "Simulado"}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString("pt-BR") : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {a.max_score
                        ? Math.round((Number(a.total_score) / Number(a.max_score)) * 100)
                        : 0}
                      %
                    </Badge>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/app/student/resultado/$attemptId" params={{ attemptId: a.id }}>
                        Detalhes
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
