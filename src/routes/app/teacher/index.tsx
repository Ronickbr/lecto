import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Users,
  GraduationCap,
  FileText,
  Library,
  Clock,
  CheckCircle2,
  Loader2,
  ClipboardList,
  BarChart3,
  RotateCcw,
} from "lucide-react";

export const Route = createFileRoute("/app/teacher/")({
  head: () => ({ meta: [{ title: "Professor | Lecto" }] }),
  component: TeacherHome,
});

function TeacherHome() {
  const { data: user } = useCurrentUser();

  const { data, isLoading } = useQuery({
    queryKey: ["teacher-overview", user?.userId],
    enabled: !!user?.userId,
    queryFn: async () => {
      const { data: teacher } = await supabase
        .from("teachers")
        .select("id, school_id, full_name")
        .eq("user_id", user!.userId)
        .maybeSingle();

      if (!teacher) {
        return { teacher: null, classes: [], students: 0, simulados: [], attempts: [] };
      }

      const [classesRes, studentsRes, simuladosRes, attemptsRes] = await Promise.all([
        supabase.from("classes").select("id, name, grade, class_code").eq("teacher_id", teacher.id),
        supabase
          .from("students")
          .select("id", { count: "exact", head: true })
          .eq("school_id", teacher.school_id),
        supabase
          .from("simulados")
          .select("id, title, status, time_limit_minutes, published_at, class_id")
          .eq("school_id", teacher.school_id)
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("simulado_attempts")
          .select("id, simulado_id, student_id, submitted_at, started_at")
          .eq("school_id", teacher.school_id)
          .order("started_at", { ascending: false })
          .limit(8),
      ]);

      return {
        teacher,
        classes: classesRes.data ?? [],
        students: studentsRes.count ?? 0,
        simulados: simuladosRes.data ?? [],
        attempts: attemptsRes.data ?? [],
      };
    },
  });

  if (isLoading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.teacher) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Vínculo docente não encontrado</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Peça ao administrador da sua escola para vincular seu usuário como professor.
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = [
    { label: "Minhas turmas", value: data.classes.length, icon: Building2 },
    { label: "Alunos na escola", value: data.students, icon: Users },
    { label: "Simulados", value: data.simulados.length, icon: FileText },
    { label: "Tentativas recentes", value: data.attempts.length, icon: GraduationCap },
  ];

  const submitted = data.attempts.filter((a) => a.submitted_at).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">
            Olá, {data.teacher.full_name?.split(" ")[0]} 👋
          </h1>
          <p className="text-muted-foreground">
            Acompanhe suas turmas, simulados e a evolução dos alunos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/app/school/texts">
              <Library className="size-4" /> Banco de textos
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/app/school/simulados">
              <FileText className="size-4" /> Simulados
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl sm:text-3xl">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="size-5 text-primary" /> Ações rápidas
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Button asChild variant="outline" className="justify-start">
            <Link to="/app/school/simulados">
              <FileText className="size-4" /> Criar simulado
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <Link to="/app/school/texts">
              <Library className="size-4" /> Adicionar texto
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <Link to="/app/teacher/resultados">
              <BarChart3 className="size-4" /> Ver resultados
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <Link to="/app/teacher/tentativas">
              <RotateCcw className="size-4" /> Liberar nova tentativa
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <Link to="/app/teacher/rubricas">
              <ClipboardList className="size-4" /> Editar rubricas da IA
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <Link to="/app/school/students">
              <Users className="size-4" /> Ver alunos
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-5 text-primary" /> Minhas turmas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.classes.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma turma vinculada a você ainda.</p>
            )}
            {data.classes.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-md border border-border p-3"
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.grade ?? "—"} · Código {c.class_code}
                  </p>
                </div>
                <Badge variant="secondary">{c.class_code}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5 text-primary" /> Simulados recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.simulados.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum simulado criado ainda.</p>
            )}
            {data.simulados.map((s) => (
              <Link
                key={s.id}
                to="/app/school/simulados/$id"
                params={{ id: s.id }}
                className="flex items-center justify-between rounded-md border border-border p-3 hover:bg-accent/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3" /> {s.time_limit_minutes} min
                  </p>
                </div>
                <Badge variant={s.status === "published" ? "default" : "outline"}>{s.status}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-primary" /> Atividade recente dos alunos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.attempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma tentativa registrada ainda.</p>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                {submitted} de {data.attempts.length} tentativas foram enviadas.
              </p>
              <ul className="divide-y divide-border">
                {data.attempts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground">
                      {new Date(a.started_at).toLocaleString("pt-BR")}
                    </span>
                    {a.submitted_at ? (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="size-3" /> Enviado
                      </Badge>
                    ) : (
                      <Badge>Em andamento</Badge>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
