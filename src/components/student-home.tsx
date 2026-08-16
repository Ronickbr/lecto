import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  FileText,
  PlayCircle,
  RotateCcw,
  CheckCircle2,
  BarChart3,
  Loader2,
} from "lucide-react";

export function StudentHome() {
  const { data: user } = useCurrentUser();

  const { data: student } = useQuery({
    queryKey: ["student-self", user?.userId],
    enabled: !!user?.userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, full_name, class_id, school_id, classes(name)")
        .eq("user_id", user!.userId)
        .maybeSingle();
      return data;
    },
  });

  const { data: simulados, isLoading: isLoadingSimulados } = useQuery({
    queryKey: ["student-simulados", student?.id, student?.class_id],
    enabled: !!student?.id,
    staleTime: 1000 * 60 * 5, // 5 minutos de cache
    queryFn: async () => {
      const { data } = await supabase
        .from("simulados")
        .select("id, title, description, time_limit_minutes, class_id, published_at, max_attempts")
        .eq("status", "published")
        .or(`class_id.eq.${student!.class_id},class_id.is.null`)
        .order("published_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: attempts } = useQuery({
    queryKey: ["student-attempts", student?.id],
    enabled: !!student?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("simulado_attempts")
        .select("id, simulado_id, started_at, expires_at, submitted_at, graded_at")
        .eq("student_id", student!.id)
        .order("started_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: retakes } = useQuery({
    queryKey: ["student-retakes", student?.id],
    enabled: !!student?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("simulado_retakes")
        .select("id, simulado_id")
        .eq("student_id", student!.id)
        .is("consumed_at", null);
      return data ?? [];
    },
  });

  const now = Date.now();
  const stateFor = (sim: { id: string; max_attempts: number }) => {
    const list = (attempts ?? []).filter((a) => a.simulado_id === sim.id);
    const submitted = list.find((a) => a.submitted_at);
    const active = list.find((a) => !a.submitted_at && new Date(a.expires_at).getTime() > now);
    const hasRetake = (retakes ?? []).some((r) => r.simulado_id === sim.id);
    const canRetake = sim.max_attempts === 0 || list.length < sim.max_attempts || hasRetake;
    if (active)
      return { kind: "active" as const, attempt: active, canRetake: false, used: list.length };
    if (submitted)
      return { kind: "done" as const, attempt: submitted, canRetake, used: list.length };
    return { kind: "new" as const, canRetake, used: list.length };
  };
  const done = (attempts ?? []).filter((a) => a.submitted_at).length;
  const pending = (simulados ?? []).filter((s) => stateFor(s).kind !== "done").length;
  const inProgress = (attempts ?? []).filter(
    (a) => !a.submitted_at && new Date(a.expires_at).getTime() > now,
  ).length;

  const summary = [
    { label: "Disponíveis", value: pending, icon: FileText },
    { label: "Em andamento", value: inProgress, icon: Clock },
    { label: "Concluídos", value: done, icon: CheckCircle2 },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">
            Olá, {student?.full_name?.split(" ")[0] ?? "aluno(a)"} 👋
          </h1>
          <p className="text-muted-foreground">
            {student?.classes?.name
              ? `Turma ${student.classes.name}`
              : "Seus simulados aparecerão aqui."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/app/student/progresso">
              <BarChart3 className="size-4" /> Meu progresso
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/profile">
              <FileText className="size-4" /> Meu perfil
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {summary.map((s) => (
          <Card key={s.label} className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4">
        {isLoadingSimulados ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : !simulados || simulados.length === 0 ? (
          <Card className="shadow-soft">
            <CardContent className="p-10 text-center text-muted-foreground">
              Nenhum simulado disponível no momento.
            </CardContent>
          </Card>
        ) : null}
        {simulados?.map((s) => {
          const st = stateFor(s);

          return (
            <Card key={s.id} className="shadow-soft">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="size-4 text-primary" />
                      {s.title}
                    </CardTitle>
                    {s.description && (
                      <p className="text-sm text-muted-foreground mt-1">{s.description}</p>
                    )}
                  </div>
                  {st.kind === "done" && (
                    <div className="flex items-center gap-2">
                      {st.attempt.graded_at ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="size-3" /> Corrigido
                        </Badge>
                      ) : (
                        <Badge variant="outline">Aguardando correção</Badge>
                      )}
                    </div>
                  )}
                  {st.kind === "active" && <Badge>Em andamento</Badge>}
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="size-3" /> {s.time_limit_minutes} min ·{" "}
                  {s.max_attempts === 0
                    ? "tentativas ilimitadas"
                    : `tentativa ${Math.min(st.used + (st.kind === "active" ? 0 : 1), Math.max(s.max_attempts, st.used))} de ${s.max_attempts}`}
                </p>
                {st.kind === "new" && (
                  <Button asChild size="sm">
                    <Link to="/app/student/simulado/$id" params={{ id: s.id }}>
                      <PlayCircle className="size-4" /> Iniciar
                    </Link>
                  </Button>
                )}
                {st.kind === "active" && (
                  <Button asChild size="sm">
                    <Link to="/app/student/simulado/$id" params={{ id: s.id }}>
                      <RotateCcw className="size-4" /> Retomar
                    </Link>
                  </Button>
                )}
                {st.kind === "done" && (
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link
                        to="/app/student/resultado/$attemptId"
                        params={{ attemptId: st.attempt.id }}
                      >
                        <BarChart3 className="size-4" /> Ver resultado
                      </Link>
                    </Button>
                    {st.canRetake && (
                      <Button asChild size="sm">
                        <Link to="/app/student/simulado/$id" params={{ id: s.id }}>
                          <RotateCcw className="size-4" /> Nova tentativa
                        </Link>
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
