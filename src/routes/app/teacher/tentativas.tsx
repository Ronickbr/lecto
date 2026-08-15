import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  RotateCcw,
  Save,
  Undo2,
  BarChart3,
  Clock,
  CheckCircle2,
  Send,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/teacher/tentativas")({
  head: () => ({
    meta: [
      { title: "Controle de tentativas | Lecto" },
      {
        name: "description",
        content: "Acompanhe o status das tentativas dos alunos e libere novas tentativas.",
      },
    ],
  }),
  component: AttemptsControl,
});

type AttemptStatus = "in_progress" | "expired" | "submitted" | "graded";

function statusOf(a: {
  submitted_at: string | null;
  graded_at: string | null;
  expires_at: string;
}): AttemptStatus {
  if (a.graded_at) return "graded";
  if (a.submitted_at) return "submitted";
  if (new Date(a.expires_at).getTime() < Date.now()) return "expired";
  return "in_progress";
}

const STATUS_META: Record<
  AttemptStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  in_progress: { label: "Em andamento", variant: "default" },
  expired: { label: "Expirado", variant: "destructive" },
  submitted: { label: "Enviado (pendente de correção)", variant: "outline" },
  graded: { label: "Corrigido", variant: "secondary" },
};

function AttemptsControl() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const [simuladoId, setSimuladoId] = useState<string>("all");
  const [maxDraft, setMaxDraft] = useState<string>("");

  const { data: simulados } = useQuery({
    queryKey: ["attempts-simulados", user?.schoolId],
    enabled: !!user?.schoolId,
    queryFn: async () =>
      (
        await supabase
          .from("simulados")
          .select("id, title, max_attempts")
          .eq("school_id", user!.schoolId!)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const selected = useMemo(
    () => simulados?.find((s) => s.id === simuladoId) ?? null,
    [simulados, simuladoId],
  );

  // Antes, digitar algo inválido virava silenciosamente 0 (= tentativas ilimitadas).
  const maxRaw = maxDraft === "" ? String(selected?.max_attempts ?? 1) : maxDraft;
  const maxValue = Number(maxRaw);
  const maxValid =
    /^\d+$/.test(maxRaw) && Number.isInteger(maxValue) && maxValue >= 0 && maxValue <= 20;

  const { data: attempts, isLoading } = useQuery({
    queryKey: ["attempts-control", user?.schoolId, simuladoId],
    enabled: !!user?.schoolId,
    queryFn: async () => {
      let q = supabase
        .from("simulado_attempts")
        .select(
          "id, simulado_id, student_id, started_at, expires_at, submitted_at, graded_at, total_score, max_score, students(full_name, classes(name)), simulados(title)",
        )
        .eq("school_id", user!.schoolId!)
        .order("started_at", { ascending: false });
      if (simuladoId !== "all") q = q.eq("simulado_id", simuladoId);
      return (await q).data ?? [];
    },
  });

  const { data: retakes } = useQuery({
    queryKey: ["attempts-retakes", user?.schoolId, simuladoId],
    enabled: !!user?.schoolId,
    queryFn: async () => {
      let q = supabase
        .from("simulado_retakes")
        .select("id, simulado_id, student_id, consumed_at, created_at")
        .eq("school_id", user!.schoolId!)
        .is("consumed_at", null);
      if (simuladoId !== "all") q = q.eq("simulado_id", simuladoId);
      return (await q).data ?? [];
    },
  });

  const grantMut = useMutation({
    mutationFn: async (a: { simulado_id: string; student_id: string }) => {
      const { error } = await supabase.from("simulado_retakes").insert({
        simulado_id: a.simulado_id,
        student_id: a.student_id,
        school_id: user!.schoolId!,
        granted_by: user!.userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nova tentativa liberada para o aluno");
      qc.invalidateQueries({ queryKey: ["attempts-retakes"] });
    },
    onError: () => toast.error("Não foi possível liberar a tentativa"),
  });

  const revokeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("simulado_retakes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Liberação cancelada");
      qc.invalidateQueries({ queryKey: ["attempts-retakes"] });
    },
    onError: () => toast.error("Não foi possível cancelar a liberação"),
  });

  const maxMut = useMutation({
    mutationFn: async (value: number) => {
      const { error } = await supabase
        .from("simulados")
        .update({ max_attempts: value })
        .eq("id", simuladoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Limite de tentativas atualizado");
      qc.invalidateQueries({ queryKey: ["attempts-simulados"] });
    },
    onError: () => toast.error("Não foi possível atualizar o limite"),
  });

  const pendingRetake = (simId: string, studentId: string) =>
    (retakes ?? []).find((r) => r.simulado_id === simId && r.student_id === studentId);

  const counts = {
    total: attempts?.length ?? 0,
    submitted: (attempts ?? []).filter((a) => statusOf(a) === "submitted").length,
    graded: (attempts ?? []).filter((a) => statusOf(a) === "graded").length,
    running: (attempts ?? []).filter((a) => statusOf(a) === "in_progress").length,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Controle de tentativas</h1>
          <p className="text-muted-foreground">
            Acompanhe o status de cada entrega e libere novas tentativas quando necessário.
          </p>
        </div>
        <Select
          value={simuladoId}
          onValueChange={(v) => {
            setSimuladoId(v);
            setMaxDraft("");
          }}
        >
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

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Tentativas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl sm:text-4xl">{counts.total}</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Em andamento</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl sm:text-4xl">{counts.running}</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl sm:text-4xl">{counts.submitted}</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Corrigidas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl sm:text-4xl">{counts.graded}</p>
          </CardContent>
        </Card>
      </div>

      {selected && (
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Limite de tentativas · {selected.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Label htmlFor="max-attempts">Tentativas permitidas</Label>
              <Input
                id="max-attempts"
                type="number"
                min={0}
                max={20}
                step={1}
                value={maxDraft === "" ? String(selected.max_attempts) : maxDraft}
                onChange={(e) => setMaxDraft(e.target.value.replace(/[^\d]/g, ""))}
                aria-invalid={!maxValid}
              />
              {!maxValid && (
                <p className="mt-1 text-xs text-destructive">
                  Informe um número inteiro entre 0 e 20.
                </p>
              )}
            </div>
            <p className="flex-1 text-xs text-muted-foreground">
              Use <strong>0</strong> para tentativas ilimitadas. Liberações individuais abaixo dão
              uma tentativa extra a um aluno específico, sem alterar o limite geral.
            </p>
            <Button
              onClick={() => maxMut.mutate(maxValue)}
              disabled={maxMut.isPending || !maxValid}
            >
              {maxMut.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Salvar limite
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Tentativas dos alunos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && (
            <div className="p-6 text-center">
              <Loader2 className="mx-auto size-5 animate-spin text-primary" />
            </div>
          )}
          {!isLoading && counts.total === 0 && (
            <p className="p-6 text-center text-muted-foreground">
              Nenhuma tentativa registrada ainda.
            </p>
          )}
          {attempts?.map((a) => {
            const status = statusOf(a);
            const meta = STATUS_META[status];
            const grant = pendingRetake(a.simulado_id, a.student_id);
            return (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.students?.full_name ?? "Aluno"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.simulados?.title} · {a.students?.classes?.name ?? "Sem turma"} ·{" "}
                    {new Date(a.started_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={meta.variant} className="gap-1">
                    {status === "graded" ? (
                      <CheckCircle2 className="size-3" />
                    ) : status === "submitted" ? (
                      <Send className="size-3" />
                    ) : (
                      <Clock className="size-3" />
                    )}
                    {meta.label}
                  </Badge>
                  {status === "graded" && a.max_score ? (
                    <Badge variant="secondary">
                      {Math.round((Number(a.total_score) / Number(a.max_score)) * 100)}%
                    </Badge>
                  ) : null}
                  {a.graded_at && (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/app/student/resultado/$attemptId" params={{ attemptId: a.id }}>
                        <BarChart3 className="size-4" /> Detalhes
                      </Link>
                    </Button>
                  )}
                  {grant ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => revokeMut.mutate(grant.id)}
                      disabled={revokeMut.isPending}
                    >
                      <Undo2 className="size-4" /> Cancelar liberação
                    </Button>
                  ) : (
                    a.submitted_at && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          grantMut.mutate({ simulado_id: a.simulado_id, student_id: a.student_id })
                        }
                        disabled={grantMut.isPending}
                      >
                        <RotateCcw className="size-4" /> Liberar nova tentativa
                      </Button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
