import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, Sparkles, Search, Wand2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateRubricFn, generateMissingRubricsFn } from "@/lib/rubrics.functions";
import { showError, toast } from "@/lib/errors/feedback";
import { PROCESS_LABEL } from "@/lib/pirls";

export const Route = createFileRoute("/app/teacher/rubricas")({
  head: () => ({
    meta: [
      { title: "Rubricas de correção | Lecto" },
      {
        name: "description",
        content: "Revise e edite as rubricas usadas pela correção automática com IA.",
      },
    ],
  }),
  component: RubricsPage,
});

const DEFAULT_RUBRIC =
  "Avalie precisão da resposta, uso de evidências do texto e clareza. Pontuação total quando a resposta identifica a informação correta e a justifica com trecho do texto; pontuação parcial quando falta justificativa; zero quando não há relação com o texto.";

function RubricsPage() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const [processFilter, setProcessFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [genId, setGenId] = useState<string | null>(null);
  const generateRubric = useServerFn(generateRubricFn);
  const generateMissing = useServerFn(generateMissingRubricsFn);

  const regenMut = useMutation({
    mutationFn: async (questionId: string) => {
      setGenId(questionId);
      return generateRubric({ data: { questionId, force: true } });
    },
    onSuccess: (_d, questionId) => {
      toast.success("Rubrica gerada pela IA");
      setDrafts((d) => {
        const n = { ...d };
        delete n[questionId];
        return n;
      });
      qc.invalidateQueries({ queryKey: ["rubric-questions"] });
    },
    onError: () => showError("Não foi possível gerar a rubrica"),
    onSettled: () => setGenId(null),
  });

  const missingMut = useMutation({
    mutationFn: async (schoolId: string) =>
      generateMissing({ data: { schoolId } }) as Promise<{ generated: number }>,
    onSuccess: (res) => {
      toast.success(`${res.generated} rubrica(s) gerada(s) pela IA`);
      qc.invalidateQueries({ queryKey: ["rubric-questions"] });
    },
    onError: () => showError("Não foi possível gerar as rubricas pendentes"),
  });

  const { data: questions, isLoading } = useQuery({
    queryKey: ["rubric-questions", user?.schoolId],
    enabled: !!user?.schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id, statement, points, pirls_process, updated_at, texts(title)")
        .eq("school_id", user!.schoolId!)
        .eq("q_type", "open")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const ids = (data ?? []).map((q) => q.id);
      const { data: keys } = await supabase
        .from("question_keys")
        .select("question_id, rubric")
        .in("question_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const rubricById = new Map((keys ?? []).map((k) => [k.question_id, k.rubric]));
      return (data ?? []).map((q) => ({ ...q, rubric: rubricById.get(q.id) ?? null }));
    },
  });

  const saveMut = useMutation({
    mutationFn: async (v: { id: string; rubric: string }) => {
      const { error } = await supabase
        .from("question_keys")
        .update({ rubric: v.rubric })
        .eq("question_id", v.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success("Rubrica salva");
      setDrafts((d) => {
        const n = { ...d };
        delete n[v.id];
        return n;
      });
      qc.invalidateQueries({ queryKey: ["rubric-questions"] });
    },
    onError: () => showError("Não foi possível salvar a rubrica"),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (questions ?? []).filter((q) => {
      const okProcess = processFilter === "all" || q.pirls_process === processFilter;
      const okTerm = !term || q.statement.toLowerCase().includes(term);
      return okProcess && okTerm;
    });
  }, [questions, processFilter, search]);

  const missing = (questions ?? []).filter((q) => !q.rubric?.trim()).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Rubricas de correção</h1>
          <p className="text-muted-foreground">
            A IA cria a rubrica de cada questão aberta automaticamente. Você pode revisar, ajustar o
            texto e salvar — a correção passa a usar a sua versão.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={!user?.schoolId || missingMut.isPending}
          onClick={() => user?.schoolId && missingMut.mutate(user.schoolId)}
        >
          {missingMut.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Wand2 className="size-4" />
          )}
          Gerar pendentes com IA
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Questões abertas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl sm:text-4xl">{questions?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Sem rubrica</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl sm:text-4xl">{missing}</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Exibindo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl sm:text-4xl">{filtered.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por enunciado…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={processFilter} onValueChange={setProcessFilter}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Todos os processos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os processos PIRLS</SelectItem>
            {Object.entries(PROCESS_LABEL).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="p-10 text-center">
          <Loader2 className="mx-auto size-5 animate-spin text-primary" />
        </div>
      )}
      {!isLoading && filtered.length === 0 && (
        <Card className="shadow-soft">
          <CardContent className="p-10 text-center text-muted-foreground">
            Nenhuma questão aberta encontrada.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {filtered.map((q) => {
          const draft = drafts[q.id] ?? q.rubric ?? "";
          const dirty = draft !== (q.rubric ?? "");
          return (
            <Card key={q.id} className="shadow-soft">
              <CardContent className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium">{q.statement}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {PROCESS_LABEL[q.pirls_process] ?? q.pirls_process}
                    </Badge>
                    <Badge variant="secondary">{q.points} pt</Badge>
                  </div>
                </div>
                {q.texts?.title && (
                  <p className="text-xs text-muted-foreground">Texto: {q.texts.title}</p>
                )}
                <Textarea
                  rows={4}
                  placeholder="Descreva os critérios de pontuação usados pela IA…"
                  value={draft}
                  onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDrafts((d) => ({ ...d, [q.id]: DEFAULT_RUBRIC }))}
                  >
                    <Sparkles className="size-4" /> Usar rubrica sugerida
                  </Button>
                  <Button
                    size="sm"
                    disabled={!dirty || saveMut.isPending}
                    onClick={() => saveMut.mutate({ id: q.id, rubric: draft })}
                  >
                    {saveMut.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Salvar rubrica
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={genId === q.id}
                    onClick={() => regenMut.mutate(q.id)}
                  >
                    {genId === q.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    Gerar com IA
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
