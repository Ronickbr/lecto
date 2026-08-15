import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { RichTextBody } from "@/components/rich-text";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  ArrowRight,
  X,
  Plus,
  Clock,
  Loader2,
  Send,
  Home,
  RefreshCw,
  Lock,
  ChevronLeft,
  ChevronRight,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/student/simulado/$id")({
  head: () => ({ meta: [{ title: "Simulado | Lecto" }] }),
  component: SimuladoPlayer,
});

type PageRow = {
  id: string;
  position: number;
  title: string | null;
  instructions: string | null;
  text_id: string | null;
  texts: { id: string; title: string; body: string; text_type: string | null } | null;
  simulado_blocks: Array<{
    id: string;
    position: number;
    b_type: "instruction" | "text" | "question";
    content: string | null;
    question_id: string | null;
    questions: {
      id: string;
      statement: string;
      q_type: "multiple_choice" | "open";
      options: unknown;
      pirls_process: string;
    } | null;
  }>;
};

function SimuladoPlayer() {
  const { id: simuladoId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();

  const { data: student } = useQuery({
    queryKey: ["student-self", user?.userId],
    enabled: !!user?.userId,
    queryFn: async () =>
      (
        await supabase
          .from("students")
          .select("id, school_id, class_id")
          .eq("user_id", user!.userId)
          .maybeSingle()
      ).data,
  });

  const { data: simulado } = useQuery({
    queryKey: ["sim-play", simuladoId],
    queryFn: async () =>
      (
        await supabase
          .from("simulados")
          .select("id, title, time_limit_minutes, status, max_attempts")
          .eq("id", simuladoId)
          .maybeSingle()
      ).data,
  });

  const { data: pages } = useQuery({
    queryKey: ["sim-play-pages", simuladoId],
    queryFn: async (): Promise<PageRow[]> => {
      const { data } = await supabase
        .from("simulado_pages")
        .select(
          `id, position, title, instructions, text_id,
                 texts(id, title, body, text_type),
                 simulado_blocks(id, position, b_type, content, question_id,
                   questions:questions_safe(id, statement, q_type, options, pirls_process))`,
        )
        .eq("simulado_id", simuladoId)
        .order("position");
      const rows = (data ?? []) as unknown as PageRow[];
      rows.forEach((p) => p.simulado_blocks?.sort((a, b) => a.position - b.position));
      return rows;
    },
  });

  const [blocked, setBlocked] = useState(false);

  const { data: attempt, refetch: refetchAttempt } = useQuery({
    queryKey: ["sim-attempt", simuladoId, student?.id],
    enabled: !!student?.id && !!simulado,
    queryFn: async () => {
      const { data: existing } = await supabase
        .from("simulado_attempts")
        .select("*")
        .eq("simulado_id", simuladoId)
        .eq("student_id", student!.id)
        .is("submitted_at", null)
        .maybeSingle();
      if (existing && new Date(existing.expires_at).getTime() > Date.now()) return existing;
      if (existing) {
        // expired — mark as submitted so a fresh start is not blocked
        await supabase
          .from("simulado_attempts")
          .update({ submitted_at: new Date().toISOString() })
          .eq("id", existing.id);
      }

      // Attempt control: max_attempts (0 = unlimited) plus teacher-granted retakes.
      const [{ count: usedCount }, { data: grants }] = await Promise.all([
        supabase
          .from("simulado_attempts")
          .select("id", { count: "exact", head: true })
          .eq("simulado_id", simuladoId)
          .eq("student_id", student!.id),
        supabase
          .from("simulado_retakes")
          .select("id")
          .eq("simulado_id", simuladoId)
          .eq("student_id", student!.id)
          .is("consumed_at", null),
      ]);
      const maxAttempts = simulado?.max_attempts ?? 1;
      const used = usedCount ?? 0;
      const grant = (grants ?? [])[0];
      if (maxAttempts > 0 && used >= maxAttempts && !grant) {
        setBlocked(true);
        return null;
      }
      if (maxAttempts > 0 && used >= maxAttempts && grant) {
        await supabase
          .from("simulado_retakes")
          .update({ consumed_at: new Date().toISOString() })
          .eq("id", grant.id);
      }

      const expiresAt = new Date(
        Date.now() + (simulado?.time_limit_minutes ?? 60) * 60_000,
      ).toISOString();
      const firstPage = pages?.[0]?.id ?? null;
      const { data: created, error } = await supabase
        .from("simulado_attempts")
        .insert({
          simulado_id: simuladoId,
          student_id: student!.id,
          user_id: user!.userId,
          school_id: student!.school_id,
          expires_at: expiresAt,
          active_page_id: firstPage,
          opened_page_ids: firstPage ? [firstPage] : [],
        })
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return created;
    },
  });

  const { data: answers } = useQuery({
    queryKey: ["sim-answers", attempt?.id],
    enabled: !!attempt?.id,
    queryFn: async () =>
      (
        await supabase
          .from("simulado_answers")
          .select("question_id, answer")
          .eq("attempt_id", attempt!.id)
      ).data ?? [],
  });

  const answersMap = useMemo(() => {
    const m: Record<string, string> = {};
    (answers ?? []).forEach((a) => {
      if (a.question_id) m[a.question_id] = a.answer ?? "";
    });
    return m;
  }, [answers]);

  const openedIds = (attempt?.opened_page_ids as string[] | undefined) ?? [];
  const activeId = attempt?.active_page_id ?? openedIds[0] ?? pages?.[0]?.id ?? null;
  const activePage = pages?.find((p) => p.id === activeId);

  const patchAttempt = useMutation({
    mutationFn: async (patch: { opened_page_ids?: string[]; active_page_id?: string | null }) => {
      if (!attempt) return;
      await supabase.from("simulado_attempts").update(patch).eq("id", attempt.id);
    },
    onSuccess: () => refetchAttempt(),
  });

  function openTab(pageId: string) {
    const next = openedIds.includes(pageId) ? openedIds : [...openedIds, pageId];
    patchAttempt.mutate({ opened_page_ids: next, active_page_id: pageId });
  }
  function closeTab(pageId: string) {
    const next = openedIds.filter((p) => p !== pageId);
    const nextActive = activeId === pageId ? (next[next.length - 1] ?? null) : activeId;
    patchAttempt.mutate({ opened_page_ids: next, active_page_id: nextActive });
  }
  function switchTab(pageId: string) {
    patchAttempt.mutate({ active_page_id: pageId });
  }

  // Timer
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!attempt?.expires_at) {
      setRemaining(null);
      return;
    }
    const tick = () =>
      setRemaining(Math.max(0, new Date(attempt.expires_at).getTime() - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [attempt?.expires_at]);

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!attempt) return;
      // Garante que a última resposta digitada chegue ao banco antes do envio.
      await Promise.allSettled([...pendingFlushes].map((f) => f()));
      const { error } = await supabase
        .from("simulado_attempts")
        .update({ submitted_at: new Date().toISOString() })
        .eq("id", attempt.id);
      if (error) throw error;
    },
    onError: () => toast.error("Não foi possível enviar o simulado. Tente novamente."),
    onSuccess: () => {
      toast.success("Simulado enviado! Corrigindo suas respostas…");
      qc.invalidateQueries();
      if (attempt)
        navigate({ to: "/app/student/resultado/$attemptId", params: { attemptId: attempt.id } });
      else navigate({ to: "/app/student" });
    },
  });

  const autoSubmittedRef = useRef(false);
  useEffect(() => {
    if (!attempt?.expires_at || attempt.submitted_at || autoSubmittedRef.current) return;
    if (remaining === null || remaining > 0) return;
    // double-check against the clock to avoid submitting on the first render
    if (new Date(attempt.expires_at).getTime() > Date.now()) return;
    autoSubmittedRef.current = true;
    submitMut.mutate();
  }, [remaining, attempt, submitMut]);

  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [pageIndexOpen, setPageIndexOpen] = useState(false);

  if (blocked && !attempt) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-6">
        <Card className="max-w-md space-y-4 p-8 text-center shadow-soft">
          <Lock className="mx-auto size-8 text-muted-foreground" />
          <h2 className="font-display text-xl sm:text-2xl">Limite de tentativas atingido</h2>
          <p className="text-sm text-muted-foreground">
            Você já usou todas as tentativas permitidas neste simulado. Peça ao seu professor para
            liberar uma nova tentativa.
          </p>
          <Button asChild variant="outline">
            <Link to="/app/student">
              <Home className="size-4" /> Voltar ao painel
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  if (!simulado || !pages || !student || !attempt) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const remainingMs = remaining ?? Math.max(0, new Date(attempt.expires_at).getTime() - Date.now());
  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000);
  const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const lowTime = remainingMs < 5 * 60_000;

  const activeIdx = pages.findIndex((p) => p.id === activeId);
  const prevPage = pages[activeIdx - 1];
  const nextPage = pages[activeIdx + 1];

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-x-hidden bg-slate-100 dark:bg-slate-950">
      {/* Browser-style chrome */}
      <div className="border-b border-slate-300 dark:border-slate-800 bg-slate-200 dark:bg-slate-900">
        <div className="flex items-center gap-1 overflow-x-auto px-2 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {openedIds.map((pid) => {
            const p = pages.find((x) => x.id === pid);
            if (!p) return null;
            const isActive = pid === activeId;
            return (
              <div
                key={pid}
                className={`group flex min-w-[120px] max-w-[180px] shrink-0 items-center gap-2 rounded-t-lg border border-b-0 px-3 py-2 cursor-pointer text-sm sm:min-w-[140px] sm:max-w-[220px] ${
                  isActive
                    ? "bg-background border-slate-300 dark:border-slate-800 font-medium"
                    : "bg-slate-300/40 dark:bg-slate-800/40 border-transparent hover:bg-slate-300/70"
                }`}
                onClick={() => switchTab(pid)}
              >
                <span className="truncate flex-1">
                  {p.title ?? p.texts?.title ?? `Página ${p.position + 1}`}
                </span>
                {openedIds.length > 1 && (
                  <button
                    className="opacity-60 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(pid);
                    }}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            );
          })}
          <Button size="sm" variant="ghost" className="mt-1" onClick={() => setPageIndexOpen(true)}>
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-300/60 px-2 py-2 sm:px-3 dark:border-slate-800/60">
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            disabled={!prevPage}
            onClick={() => prevPage && openTab(prevPage.id)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            disabled={!nextPage}
            onClick={() => nextPage && openTab(nextPage.id)}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" className="size-8" onClick={() => refetchAttempt()}>
            <RefreshCw className="size-4" />
          </Button>
          <div className="hidden min-w-0 flex-1 items-center gap-2 truncate rounded-full border border-slate-300 bg-background px-4 py-1.5 text-xs text-muted-foreground md:flex dark:border-slate-800">
            <Lock className="size-3" /> lecto://{simulado.title.toLowerCase().replace(/\s+/g, "-")}/
            {activePage?.title?.toLowerCase().replace(/\s+/g, "-") ?? "pagina"}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto md:ml-0"
            onClick={() => setPageIndexOpen(true)}
          >
            <ListChecks className="size-4" /> <span className="hidden sm:inline">Índice</span>
          </Button>
          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-mono font-medium ${
              lowTime
                ? "border-destructive text-destructive animate-pulse"
                : "border-primary text-primary"
            }`}
          >
            <Clock className="size-4" /> {timeStr}
          </div>
          <Button size="sm" onClick={() => setConfirmSubmit(true)}>
            <Send className="size-4" /> <span className="hidden sm:inline">Enviar</span>
          </Button>
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        {activePage ? (
          <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24 sm:p-6 sm:pb-24">
            {activePage.title && (
              <h2 className="font-display text-xl sm:text-2xl">{activePage.title}</h2>
            )}
            {activePage.instructions && (
              <Card className="p-4 bg-primary/5 border-primary/20">
                <p className="text-sm">{activePage.instructions}</p>
              </Card>
            )}
            <div
              className={`grid gap-6 ${activePage.texts?.text_type === "magazine" ? "grid-cols-1" : "lg:grid-cols-2"} [&>*]:min-w-0`}
            >
              {activePage.texts && (
                <Card
                  className={`${activePage.texts.text_type === "magazine" ? "w-full" : "max-h-[45vh] overflow-y-auto p-4 sm:p-6 lg:max-h-none lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto"}`}
                >
                  {activePage.texts.text_type !== "magazine" && (
                    <h3 className="font-display text-xl mb-3">{activePage.texts.title}</h3>
                  )}
                  <RichTextBody
                    body={activePage.texts.body}
                    className={
                      activePage.texts.text_type === "magazine"
                        ? "w-full"
                        : "text-sm leading-relaxed"
                    }
                  />
                </Card>
              )}
              <div className={`space-y-4 ${!activePage.texts ? "lg:col-span-2" : ""}`}>
                {activePage.simulado_blocks?.map((b, i) => (
                  <BlockView
                    key={b.id}
                    block={b}
                    index={i}
                    attemptId={attempt.id}
                    currentAnswer={b.question_id ? (answersMap[b.question_id] ?? "") : ""}
                  />
                ))}
                {!activePage.simulado_blocks?.length && (
                  <p className="text-sm text-muted-foreground">Esta página não tem questões.</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap justify-between gap-3 pt-6">
              <Button
                variant="outline"
                disabled={!prevPage}
                onClick={() => prevPage && openTab(prevPage.id)}
              >
                <ArrowLeft className="size-4" /> Anterior
              </Button>
              {nextPage ? (
                <Button onClick={() => openTab(nextPage.id)}>
                  Próxima <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button onClick={() => setConfirmSubmit(true)}>
                  <Send className="size-4" /> Finalizar
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-10 text-center text-muted-foreground">
            Selecione uma página no índice.
          </div>
        )}
      </div>

      <Dialog open={pageIndexOpen} onOpenChange={setPageIndexOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Índice do simulado</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {pages.map((p, i) => (
              <button
                key={p.id}
                onClick={() => {
                  openTab(p.id);
                  setPageIndexOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-md border text-sm hover:bg-accent ${
                  p.id === activeId ? "border-primary bg-primary/5" : "border-transparent"
                }`}
              >
                <span className="text-muted-foreground mr-2">{i + 1}.</span>
                {p.title ?? p.texts?.title ?? "Página"}
                {openedIds.includes(p.id) && (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    Aberta
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar simulado?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Depois de enviar, você não poderá alterar suas respostas.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSubmit(false)}>
              Cancelar
            </Button>
            <Button onClick={() => submitMut.mutate()} disabled={submitMut.isPending}>
              {submitMut.isPending && <Loader2 className="size-4 animate-spin" />} Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button
        asChild
        variant="ghost"
        size="sm"
        className="fixed bottom-3 left-3 z-10 bg-background/80 text-xs backdrop-blur"
      >
        <Link to="/app/student">
          <Home className="size-3" /> Sair (progresso salvo)
        </Link>
      </Button>
    </div>
  );
}

/** Respostas ainda não gravadas; esvaziadas antes de finalizar o simulado. */
const pendingFlushes = new Set<() => Promise<unknown>>();

function BlockView({
  block,
  index,
  attemptId,
  currentAnswer,
}: {
  block: PageRow["simulado_blocks"][number];
  index: number;
  attemptId: string;
  currentAnswer: string;
}) {
  const qc = useQueryClient();
  const [value, setValue] = useState(currentAnswer);
  const dirtyRef = useRef(false);
  const valueRef = useRef(currentAnswer);
  valueRef.current = value;

  // Só reidrata do servidor quando não há edição local pendente,
  // senão um refetch apaga o que o aluno acabou de digitar.
  useEffect(() => {
    if (!dirtyRef.current) setValue(currentAnswer);
  }, [currentAnswer]);

  const persist = useCallback(
    async (answer: string) => {
      if (!block.question_id) return;
      const { error } = await supabase.from("simulado_answers").upsert(
        {
          attempt_id: attemptId,
          question_id: block.question_id,
          answer,
        },
        { onConflict: "attempt_id,question_id" },
      );
      if (error) throw error;
      dirtyRef.current = false;
    },
    [attemptId, block.question_id],
  );

  const save = useMutation({
    mutationFn: persist,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sim-answers", attemptId] }),
    onError: () => toast.error("Não foi possível salvar esta resposta. Tente novamente."),
  });

  // Autosave: grava sozinho enquanto o aluno digita e no envio/fechamento da aba.
  useEffect(() => {
    if (!dirtyRef.current) return;
    const t = setTimeout(() => {
      void persist(valueRef.current).catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [value, persist]);

  useEffect(() => {
    const flush = () => (dirtyRef.current ? persist(valueRef.current) : Promise.resolve());
    pendingFlushes.add(flush);
    const onUnload = () => {
      void flush();
    };
    window.addEventListener("pagehide", onUnload);
    return () => {
      pendingFlushes.delete(flush);
      window.removeEventListener("pagehide", onUnload);
      void flush().catch(() => {});
    };
  }, [persist]);

  if (block.b_type === "instruction") {
    return (
      <Card className="p-4 bg-muted/40">
        <p className="text-sm">{block.content}</p>
      </Card>
    );
  }
  if (block.b_type === "text" && block.content) {
    return (
      <Card className="p-4">
        <div className="whitespace-pre-wrap text-sm">{block.content}</div>
      </Card>
    );
  }
  if (block.b_type !== "question" || !block.questions) return null;
  const q = block.questions;
  const options = Array.isArray(q.options) ? (q.options as unknown[]) : [];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-sm font-medium">
          <span className="text-muted-foreground mr-2">Q{index + 1}.</span>
          {q.statement}
        </p>
      </div>
      {q.q_type === "multiple_choice" ? (
        <div className="space-y-2">
          {options.map((opt, i) => {
            const label =
              typeof opt === "string"
                ? opt
                : ((opt as { text?: string })?.text ?? JSON.stringify(opt));
            const key =
              typeof opt === "string"
                ? opt
                : ((opt as { id?: string; key?: string })?.id ??
                  (opt as { key?: string })?.key ??
                  String(i));
            const selected = value === key;
            return (
              <label
                key={i}
                className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition ${
                  selected ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                }`}
              >
                <input
                  type="radio"
                  name={`q-${block.id}`}
                  className="mt-1"
                  checked={selected}
                  onChange={() => {
                    dirtyRef.current = true;
                    setValue(key);
                    save.mutate(key);
                  }}
                />
                <span className="text-sm">{label}</span>
              </label>
            );
          })}
        </div>
      ) : (
        <Textarea
          rows={5}
          placeholder="Escreva sua resposta…"
          aria-label={`Resposta da questão ${index + 1}`}
          value={value}
          onChange={(e) => {
            dirtyRef.current = true;
            setValue(e.target.value);
          }}
          onBlur={() => {
            if (dirtyRef.current) save.mutate(value);
          }}
        />
      )}
    </Card>
  );
}
