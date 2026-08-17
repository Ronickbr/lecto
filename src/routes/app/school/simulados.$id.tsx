import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RichTextBody } from "@/components/rich-text";
import { useServerFn } from "@tanstack/react-start";
import {
  generateTextAndQuestionsFn,
  saveGeneratedPageFn,
  reorderFn,
} from "@/lib/simulados.functions";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Plus,
  Sparkles,
  Loader2,
  GripVertical,
  Trash2,
  FileText,
  Clock,
  Send,
  RefreshCw,
  Check,
  ListChecks,
  BookOpen,
  HelpCircle,
} from "lucide-react";
import { showError, toast } from "@/lib/errors/feedback";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/school/simulados/$id")({
  head: () => ({ meta: [{ title: "Editor de simulado | Lecto" }] }),
  component: SimuladoEditor,
});

const PROCESS_LABEL: Record<string, string> = {
  locate_information: "Localizar",
  straightforward_inference: "Inferência direta",
  interpret_integrate: "Interpretar/integrar",
  evaluate_critique: "Avaliar/criticar",
};

const CATEGORY_LABEL: Record<string, string> = {
  literary: "Literário",
  informational: "Informativo",
  mixed: "Misto",
};

const LEVEL_LABEL: Record<string, string> = {
  easy: "Fácil",
  medium: "Médio",
  hard: "Difícil",
};

const SUGGESTED_TOPICS = [
  "A descoberta do fogo",
  "O ciclo da água",
  "Vida no fundo do mar",
  "Dia de feira na cidade",
  "A primeira viagem de avião",
  "Animais em extinção",
  "A lenda do curupira",
  "Como se faz um livro",
];

const GENERATION_STEPS = [
  "Planejando o texto de leitura…",
  "Escrevendo o texto…",
  "Elaborando as questões…",
  "Distribuindo os processos PIRLS…",
  "Revisando o gabarito…",
];

function SimuladoEditor() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<"choose" | "ai" | "manual" | null>(null);
  const reorder = useServerFn(reorderFn);

  const { data: simulado } = useQuery({
    queryKey: ["simulado", id],
    queryFn: async () =>
      (await supabase.from("simulados").select("*, classes(name)").eq("id", id).maybeSingle()).data,
  });

  const { data: pages } = useQuery({
    queryKey: ["simulado-pages", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("simulado_pages")
        .select("*, texts(title), simulado_blocks(id)")
        .eq("simulado_id", id)
        .order("position");
      return data ?? [];
    },
  });

  const currentPageId = selectedPage ?? pages?.[0]?.id ?? null;

  const publishMut = useMutation({
    mutationFn: async () => {
      const newStatus = simulado?.status === "published" ? "draft" : "published";
      const { error } = await supabase
        .from("simulados")
        .update({
          status: newStatus,
          published_at: newStatus === "published" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["simulado", id] });
    },
    onError: (e: Error) => showError(e),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  async function handlePagesDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id || !pages) return;
    const oldIdx = pages.findIndex((p) => p.id === e.active.id);
    const newIdx = pages.findIndex((p) => p.id === e.over!.id);
    const next = arrayMove(pages, oldIdx, newIdx);
    qc.setQueryData(["simulado-pages", id], next);
    await reorder({ data: { type: "page", ids: next.map((p) => p.id) } });
    qc.invalidateQueries({ queryKey: ["simulado-pages", id] });
  }

  const deletePageMut = useMutation({
    mutationFn: async (pageId: string) => {
      const { error } = await supabase.from("simulado_pages").delete().eq("id", pageId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["simulado-pages", id] });
    },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/school/simulados">
              <ArrowLeft className="size-4" /> Voltar
            </Link>
          </Button>
          <div>
            <h1 className="font-display text-xl sm:text-2xl">{simulado?.title ?? "…"}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              {simulado?.classes?.name && <span>{simulado.classes.name}</span>}
              <Clock className="size-3" /> {simulado?.time_limit_minutes} min
              <Badge
                variant={simulado?.status === "published" ? "default" : "outline"}
                className="ml-1"
              >
                {simulado?.status === "published" ? "Publicado" : "Rascunho"}
              </Badge>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAddMode("choose")}>
            <Plus className="size-4" /> Nova página
          </Button>
          <Button onClick={() => publishMut.mutate()} disabled={publishMut.isPending}>
            <Send className="size-4" />{" "}
            {simulado?.status === "published" ? "Despublicar" : "Publicar"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] [&>*]:min-w-0">
        <Card className="h-fit p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <h3 className="text-sm font-medium text-muted-foreground">
              Páginas ({pages?.length ?? 0})
            </h3>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={() => setAddMode("choose")}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          {!pages?.length && (
            <div className="rounded-md border border-dashed border-border p-3 text-center">
              <p className="text-sm text-muted-foreground">Este simulado ainda não tem páginas.</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => setAddMode("choose")}
              >
                <Plus className="size-3.5" /> Nova página
              </Button>
            </div>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handlePagesDragEnd}
          >
            <SortableContext
              items={pages?.map((p) => p.id) ?? []}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {pages?.map((p, i) => (
                  <SortablePageItem
                    key={p.id}
                    id={p.id}
                    active={p.id === currentPageId}
                    onSelect={() => setSelectedPage(p.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        Página {i + 1}: {p.title ?? p.texts?.title ?? "Sem título"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.simulado_blocks?.length ?? 0} blocos
                      </p>
                    </div>
                    <button
                      className="opacity-0 group-hover:opacity-100 transition"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Excluir página?")) deletePageMut.mutate(p.id);
                      }}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </button>
                  </SortablePageItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </Card>

        <div>
          {currentPageId ? (
            <PageDetail pageId={currentPageId} simuladoId={id} />
          ) : (
            <Card className="p-10 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10">
                <FileText className="size-6 text-primary" />
              </div>
              <p className="mt-3 font-medium text-foreground">Comece criando uma página</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Cada página de um simulado contém um texto de leitura e suas questões. Use a IA para
                gerar tudo automaticamente a partir de um tema ou crie manualmente.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button variant="outline" onClick={() => setAddMode("manual")}>
                  <Plus className="size-4" /> Criar manualmente
                </Button>
                <Button onClick={() => setAddMode("ai")}>
                  <Sparkles className="size-4" /> Gerar com IA
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {addMode && (
        <AddPageDialog simuladoId={id} initialMode={addMode} onClose={() => setAddMode(null)} />
      )}
    </div>
  );
}

function SortablePageItem({
  id,
  active,
  onSelect,
  children,
}: {
  id: string;
  active: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 rounded-md border px-2 py-2 cursor-pointer transition ${active ? "border-primary bg-primary/5" : "border-transparent hover:bg-accent"}`}
      onClick={onSelect}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="size-4 text-muted-foreground" />
      </button>
      {children}
    </div>
  );
}

function PageDetail({ pageId, simuladoId }: { pageId: string; simuladoId: string }) {
  const qc = useQueryClient();
  const reorder = useServerFn(reorderFn);
  const [addBlockOpen, setAddBlockOpen] = useState(false);

  const { data: page } = useQuery({
    queryKey: ["page", pageId],
    queryFn: async () =>
      (
        await supabase
          .from("simulado_pages")
          .select("*, texts(id, title, body)")
          .eq("id", pageId)
          .maybeSingle()
      ).data,
  });

  const { data: blocks } = useQuery({
    queryKey: ["page-blocks", pageId],
    queryFn: async () => {
      const { data } = await supabase
        .from("simulado_blocks")
        .select("*, questions(statement, q_type, pirls_process, options)")
        .eq("page_id", pageId)
        .order("position");
      return data ?? [];
    },
  });

  const updatePageMut = useMutation({
    mutationFn: async (patch: { title?: string; instructions?: string }) => {
      const { error } = await supabase.from("simulado_pages").update(patch).eq("id", pageId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["page", pageId] }),
  });

  const deleteBlockMut = useMutation({
    mutationFn: async (bid: string) => {
      const { error } = await supabase.from("simulado_blocks").delete().eq("id", bid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["page-blocks", pageId] }),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  async function handleBlocksDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id || !blocks) return;
    const oldIdx = blocks.findIndex((b) => b.id === e.active.id);
    const newIdx = blocks.findIndex((b) => b.id === e.over!.id);
    const next = arrayMove(blocks, oldIdx, newIdx);
    qc.setQueryData(["page-blocks", pageId], next);
    await reorder({ data: { type: "block", ids: next.map((b) => b.id) } });
    qc.invalidateQueries({ queryKey: ["page-blocks", pageId] });
  }

  if (!page)
    return (
      <Card className="p-10 text-center">
        <Loader2 className="mx-auto size-5 animate-spin" />
      </Card>
    );

  return (
    <Card className="p-5 space-y-5">
      <div className="grid gap-3">
        <div>
          <Label>Título da página</Label>
          <Input
            defaultValue={page.title ?? ""}
            onBlur={(e) => updatePageMut.mutate({ title: e.target.value })}
          />
        </div>
        <div>
          <Label>Instruções ao aluno</Label>
          <Textarea
            rows={2}
            defaultValue={page.instructions ?? ""}
            onBlur={(e) => updatePageMut.mutate({ instructions: e.target.value })}
          />
        </div>
      </div>

      {page.texts && (
        <div className="rounded-md border border-border bg-muted/30 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="size-3.5" /> Texto: {page.texts.title}
          </div>
          <RichTextBody
            body={page.texts.body}
            className="max-h-48 overflow-y-auto text-sm leading-relaxed"
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="font-medium">Blocos ({blocks?.length ?? 0})</h3>
        <Button size="sm" variant="outline" onClick={() => setAddBlockOpen(true)}>
          <Plus className="size-3.5" /> Adicionar bloco
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleBlocksDragEnd}
      >
        <SortableContext
          items={blocks?.map((b) => b.id) ?? []}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {blocks?.map((b, i) => (
              <SortableBlockItem key={b.id} id={b.id}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">
                      Bloco {i + 1}
                    </Badge>
                    {b.b_type === "question" && b.questions && (
                      <Badge variant="secondary" className="text-[10px]">
                        {PROCESS_LABEL[b.questions.pirls_process]}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {b.b_type}
                    </Badge>
                  </div>
                  {b.b_type === "instruction" && <p className="text-sm">{b.content}</p>}
                  {b.b_type === "question" && b.questions && (
                    <div>
                      <p className="text-sm">{b.questions.statement}</p>
                      {b.questions.q_type === "multiple_choice" &&
                        ((b.questions.options as string[]) ?? []).length > 0 && (
                          <div className="mt-2 grid gap-1 sm:grid-cols-2">
                            {((b.questions.options as string[]) ?? []).map((opt, j) => (
                              <div
                                key={j}
                                className="rounded border border-border px-2 py-1 text-xs text-muted-foreground"
                              >
                                {opt}
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  )}
                </div>
                <button onClick={() => deleteBlockMut.mutate(b.id)}>
                  <Trash2 className="size-3.5 text-destructive" />
                </button>
              </SortableBlockItem>
            ))}
            {!blocks?.length && (
              <div className="rounded-md border border-dashed border-border p-6 text-center">
                <HelpCircle className="mx-auto mb-2 size-5 text-muted-foreground" />
                <p className="text-sm font-medium">Sem blocos nesta página</p>
                <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
                  Adicione instruções ou questões do banco, ou use a IA para gerar uma página
                  completa de texto e questões.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => setAddBlockOpen(true)}
                >
                  <Plus className="size-3.5" /> Adicionar bloco
                </Button>
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {addBlockOpen && (
        <AddBlockDialog
          pageId={pageId}
          blockCount={blocks?.length ?? 0}
          onClose={() => setAddBlockOpen(false)}
        />
      )}
    </Card>
  );
}

function SortableBlockItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 rounded-md border border-border p-3 bg-background"
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing mt-0.5">
        <GripVertical className="size-4 text-muted-foreground" />
      </button>
      {children}
    </div>
  );
}

function AddPageDialog({
  simuladoId,
  initialMode,
  onClose,
}: {
  simuladoId: string;
  initialMode: "choose" | "ai" | "manual";
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"choose" | "ai" | "manual">(initialMode);
  const [wide, setWide] = useState(false);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "flex max-h-[85vh] flex-col overflow-hidden",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        {mode === "choose" && (
          <ChoosePageMode
            onPickAi={() => setMode("ai")}
            onPickManual={() => setMode("manual")}
            onClose={onClose}
          />
        )}
        {mode === "ai" && (
          <AiGenerateContent
            simuladoId={simuladoId}
            onClose={onClose}
            onWideChange={setWide}
            onBack={() => {
              setWide(false);
              setMode("choose");
            }}
          />
        )}
        {mode === "manual" && (
          <ManualPageContent
            simuladoId={simuladoId}
            onClose={onClose}
            onBack={() => setMode("choose")}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChoosePageMode({
  onPickAi,
  onPickManual,
  onClose,
}: {
  onPickAi: () => void;
  onPickManual: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <DialogHeader className="border-b pb-3">
        <DialogTitle className="flex items-center gap-2">
          <Plus className="size-4 text-primary" /> Nova página
        </DialogTitle>
        <p className="text-xs text-muted-foreground">
          Escolha como quer criar a página do simulado.
        </p>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onPickAi}
          className="group rounded-lg border border-border bg-card p-4 text-left transition hover:border-primary/60 hover:bg-accent"
        >
          <div className="grid size-10 place-items-center rounded-full bg-primary/10">
            <Sparkles className="size-5 text-primary" />
          </div>
          <p className="mt-3 font-medium">Gerar com IA</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Informe um tema e a IA escreve o texto e as questões automaticamente.
          </p>
        </button>
        <button
          type="button"
          onClick={onPickManual}
          className="group rounded-lg border border-border bg-card p-4 text-left transition hover:border-primary/60 hover:bg-accent"
        >
          <div className="grid size-10 place-items-center rounded-full bg-muted">
            <FileText className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-3 font-medium">Criar manualmente</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Escreva o texto e monte as questões com o gabarito por conta própria.
          </p>
        </button>
      </div>
      <DialogFooter className="border-t pt-3">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
      </DialogFooter>
    </>
  );
}

type ManualQuestion = {
  statement: string;
  q_type: "multiple_choice" | "open";
  options: string[];
  correct_answer: string;
  pirls_process: string;
  explanation: string;
  rubric: string;
};

const emptyQuestion = (): ManualQuestion => ({
  statement: "",
  q_type: "multiple_choice",
  options: ["", "", "", ""],
  correct_answer: "",
  pirls_process: "locate_information",
  explanation: "",
  rubric: "",
});

function ManualPageContent({
  simuladoId,
  onClose,
  onBack,
}: {
  simuladoId: string;
  onClose: () => void;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const save = useServerFn(saveGeneratedPageFn);
  const [form, setForm] = useState({
    title: "",
    body: "",
    category: "literary" as "literary" | "informational" | "mixed",
    level: "medium" as "easy" | "medium" | "hard",
  });
  const [questions, setQuestions] = useState<ManualQuestion[]>([emptyQuestion()]);

  const setQ = (i: number, patch: Partial<ManualQuestion>) =>
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  const saveMut = useMutation({
    mutationFn: () =>
      save({
        data: {
          simuladoId,
          payload: {
            title: form.title,
            body: form.body,
            category: form.category,
            level: form.level,
            questions: questions.map((q) => ({
              statement: q.statement,
              q_type: q.q_type,
              options: q.options,
              correct_answer: q.correct_answer,
              pirls_process: q.pirls_process as ManualQuestion["pirls_process"],
              explanation: q.explanation,
              rubric: q.rubric,
            })),
          },
        },
      }),
    onSuccess: () => {
      toast.success("Página criada manualmente");
      qc.invalidateQueries({ queryKey: ["simulado-pages", simuladoId] });
      qc.invalidateQueries({ queryKey: ["texts"] });
      onClose();
    },
    onError: (e: Error) => showError(e),
  });

  const validQuestions = questions.filter(
    (q) =>
      q.statement.trim() &&
      q.correct_answer.trim() &&
      (q.q_type === "open" || q.options.every((o) => o.trim())),
  );

  return (
    <>
      <DialogHeader className="border-b pb-3">
        <DialogTitle className="flex items-center gap-2">
          <FileText className="size-4 text-primary" /> Criar página manualmente
        </DialogTitle>
      </DialogHeader>
      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="manual-title">Título</Label>
            <Input
              id="manual-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex.: O ciclo da água"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-category">Categoria</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm({ ...form, category: v as typeof form.category })}
            >
              <SelectTrigger id="manual-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="literary">Literário</SelectItem>
                <SelectItem value="informational">Informativo</SelectItem>
                <SelectItem value="mixed">Misto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-level">Nível</Label>
            <Select
              value={form.level}
              onValueChange={(v) => setForm({ ...form, level: v as typeof form.level })}
            >
              <SelectTrigger id="manual-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Fácil</SelectItem>
                <SelectItem value="medium">Médio</SelectItem>
                <SelectItem value="hard">Difícil</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="manual-body">Texto de leitura</Label>
          <Textarea
            id="manual-body"
            rows={7}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="Cole ou escreva aqui o texto que os alunos vão ler…"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label className="mb-0">Questões ({questions.length})</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setQuestions((qs) => [...qs, emptyQuestion()])}
            >
              <Plus className="size-3.5" /> Adicionar questão
            </Button>
          </div>
          <div className="space-y-3">
            {questions.map((q, i) => (
              <div key={i} className="rounded-md border border-border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Questão {i + 1}</p>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      className="text-xs text-destructive hover:underline"
                      onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}
                    >
                      Remover
                    </button>
                  )}
                </div>
                <Textarea
                  rows={2}
                  value={q.statement}
                  onChange={(e) => setQ(i, { statement: e.target.value })}
                  placeholder="Enunciado da questão…"
                />
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select
                      value={q.q_type}
                      onValueChange={(v) =>
                        setQ(i, {
                          q_type: v as ManualQuestion["q_type"],
                          options: v === "open" ? [] : ["", "", "", ""],
                          correct_answer: "",
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="multiple_choice">Múltipla escolha</SelectItem>
                        <SelectItem value="open">Aberta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Processo PIRLS</Label>
                    <Select
                      value={q.pirls_process}
                      onValueChange={(v) => setQ(i, { pirls_process: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PROCESS_LABEL).map(([k, label]) => (
                          <SelectItem key={k} value={k}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {q.q_type === "multiple_choice" && (
                  <div className="mt-3 space-y-2">
                    <Label>Opções</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {["A", "B", "C", "D"].map((letter, oi) => (
                        <div key={letter} className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            {letter}
                          </span>
                          <Input
                            value={q.options[oi] ?? ""}
                            onChange={(e) => {
                              const options = [...q.options];
                              options[oi] = e.target.value;
                              setQ(i, { options });
                            }}
                            placeholder={`Opção ${letter}`}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <Label>Gabarito (alternativa correta)</Label>
                      <Select
                        value={q.correct_answer}
                        onValueChange={(v) => setQ(i, { correct_answer: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a correta" />
                        </SelectTrigger>
                        <SelectContent>
                          {q.options.map((opt, oi) =>
                            opt.trim() ? (
                              <SelectItem key={oi} value={opt}>
                                {["A", "B", "C", "D"][oi]}: {opt}
                              </SelectItem>
                            ) : null,
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {q.q_type === "open" && (
                  <div className="mt-3 space-y-2">
                    <Label>Gabarito (resposta modelo)</Label>
                    <Input
                      value={q.correct_answer}
                      onChange={(e) => setQ(i, { correct_answer: e.target.value })}
                      placeholder="Resposta esperada do aluno…"
                    />
                  </div>
                )}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Explicação (opcional)</Label>
                    <Input
                      value={q.explanation}
                      onChange={(e) => setQ(i, { explanation: e.target.value })}
                      placeholder="Justificativa pedagógica…"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rubrica (opcional)</Label>
                    <Input
                      value={q.rubric}
                      onChange={(e) => setQ(i, { rubric: e.target.value })}
                      placeholder="Critérios de correção…"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <DialogFooter className="border-t pt-3">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4" /> Voltar
        </Button>
        <Button variant="outline" onClick={onClose} disabled={saveMut.isPending}>
          Cancelar
        </Button>
        <Button
          onClick={() => saveMut.mutate()}
          disabled={
            saveMut.isPending ||
            !form.title.trim() ||
            !form.body.trim() ||
            validQuestions.length !== questions.length
          }
        >
          {saveMut.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Salvando…
            </>
          ) : (
            <>
              <Check className="size-4" /> Criar página
            </>
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

function AddBlockDialog({
  pageId,
  blockCount,
  onClose,
}: {
  pageId: string;
  blockCount: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [type, setType] = useState<"instruction" | "question">("instruction");
  const [content, setContent] = useState("");
  const [questionId, setQuestionId] = useState("");

  const { data: questions } = useQuery({
    queryKey: ["questions-select"],
    queryFn: async () =>
      (
        await supabase
          .from("questions")
          .select("id, statement, pirls_process")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("simulado_blocks").insert({
        page_id: pageId,
        position: blockCount,
        b_type: type,
        content: type === "instruction" ? content : null,
        question_id: type === "question" ? questionId : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["page-blocks", pageId] });
      onClose();
    },
    onError: (e: Error) => showError(e),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar bloco</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instruction">Instrução</SelectItem>
                <SelectItem value="question">Questão</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === "instruction" && (
            <div>
              <Label>Conteúdo</Label>
              <Textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
            </div>
          )}
          {type === "question" && (
            <div>
              <Label>Questão do banco</Label>
              <Select value={questionId} onValueChange={setQuestionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {questions?.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.statement.slice(0, 80)}
                      {q.statement.length > 80 ? "…" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || (type === "instruction" ? !content : !questionId)}
          >
            {mut.isPending && <Loader2 className="size-4 animate-spin" />} Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type GeneratedQuestion = {
  statement: string;
  q_type: "multiple_choice" | "open";
  options: string[];
  correct_answer: string;
  pirls_process: string;
  explanation: string;
  rubric: string;
};

type GeneratedPreview = {
  title: string;
  body: string;
  category: "literary" | "informational" | "mixed";
  level: "easy" | "medium" | "hard";
  questions: GeneratedQuestion[];
};

function AiGenerateContent({
  simuladoId,
  onClose,
  onWideChange,
  onBack,
}: {
  simuladoId: string;
  onClose: () => void;
  onWideChange: (wide: boolean) => void;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const generate = useServerFn(generateTextAndQuestionsFn);
  const save = useServerFn(saveGeneratedPageFn);
  const [step, setStep] = useState<"form" | "generating" | "preview">("form");
  const [preview, setPreview] = useState<GeneratedPreview | null>(null);
  const [form, setForm] = useState<{
    topic: string;
    level: "easy" | "medium" | "hard";
    category: "literary" | "informational" | "mixed";
    questionCount: number;
  }>({
    topic: "",
    level: "medium",
    category: "literary",
    questionCount: 8,
  });

  const changeStep = (next: "form" | "generating" | "preview") => {
    setStep(next);
    onWideChange(next === "preview");
  };

  const generateMut = useMutation({
    mutationFn: () => generate({ data: { ...form, simuladoId, previewOnly: true } }),
    onMutate: () => {
      setPreview(null);
      changeStep("generating");
    },
    onSuccess: (res) => {
      if (res && "preview" in res && res.preview) {
        setPreview(res.preview as GeneratedPreview);
        changeStep("preview");
      } else {
        showError("A IA não retornou um conteúdo válido.");
        changeStep("form");
      }
    },
    onError: (e: Error) => {
      showError(e);
      changeStep("form");
    },
  });

  const saveMut = useMutation({
    mutationFn: () =>
      save({
        data: { simuladoId, payload: preview as GeneratedPreview },
      }),
    onSuccess: () => {
      toast.success("Página gerada e adicionada ao simulado");
      qc.invalidateQueries({ queryKey: ["simulado-pages", simuladoId] });
      qc.invalidateQueries({ queryKey: ["texts"] });
      onClose();
    },
    onError: (e: Error) => showError(e),
  });

  const mcCount = preview?.questions.filter((q) => q.q_type === "multiple_choice").length ?? 0;
  const openCount = (preview?.questions.length ?? 0) - mcCount;

  return (
    <>
      <DialogHeader className="border-b pb-3">
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          {step === "preview" ? "Revisar página gerada" : "Gerar página com IA"}
        </DialogTitle>
        {step === "preview" && (
          <p className="text-xs text-muted-foreground">
            Revise o texto e as questões antes de adicionar ao simulado.
          </p>
        )}
      </DialogHeader>

      {step === "form" && (
        <AiGenerateForm
          form={form}
          onChange={setForm}
          onGenerate={() => generateMut.mutate()}
          onClose={onClose}
          onBack={onBack}
          pending={generateMut.isPending}
        />
      )}

      {step === "generating" && (
        <div className="flex flex-col items-center justify-center gap-4 py-10">
          <div className="relative">
            <div className="grid size-14 place-items-center rounded-full bg-primary/10">
              <Sparkles className="size-6 animate-pulse text-primary" />
            </div>
            <Loader2 className="absolute -inset-1 size-16 animate-spin text-primary/40" />
          </div>
          <div className="text-center">
            <p className="font-medium">Gerando texto e questões…</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tema: <span className="font-medium text-foreground">{form.topic}</span>
            </p>
          </div>
          <ul className="w-full max-w-xs space-y-1.5">
            {GENERATION_STEPS.map((s, i) => (
              <li
                key={s}
                className={cn(
                  "flex items-center gap-2 text-sm transition",
                  i <= 1 ? "text-muted-foreground" : "text-muted-foreground/40",
                )}
              >
                {i < 1 ? (
                  <Check className="size-3.5 text-success" />
                ) : (
                  <Loader2
                    className={cn(
                      "size-3.5",
                      i === 1 ? "animate-spin text-primary" : "text-muted-foreground/40",
                    )}
                  />
                )}
                <span className={i > 1 ? "line-through opacity-60" : ""}>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === "preview" && preview && (
        <AiGeneratePreview
          preview={preview}
          onSave={() => saveMut.mutate()}
          onRegenerate={() => {
            changeStep("form");
            setPreview(null);
          }}
          saving={saveMut.isPending}
          mcCount={mcCount}
          openCount={openCount}
        />
      )}
    </>
  );
}

function AiGenerateForm({
  form,
  onChange,
  onGenerate,
  onClose,
  onBack,
  pending,
}: {
  form: {
    topic: string;
    level: "easy" | "medium" | "hard";
    category: "literary" | "informational" | "mixed";
    questionCount: number;
  };
  onChange: (f: {
    topic: string;
    level: "easy" | "medium" | "hard";
    category: "literary" | "informational" | "mixed";
    questionCount: number;
  }) => void;
  onGenerate: () => void;
  onClose: () => void;
  onBack: () => void;
  pending: boolean;
}) {
  return (
    <>
      <div className="space-y-4 overflow-y-auto">
        <div className="space-y-2">
          <Label htmlFor="ai-topic">Tema do texto</Label>
          <Input
            id="ai-topic"
            value={form.topic}
            onChange={(e) => onChange({ ...form, topic: e.target.value })}
            placeholder="Ex.: a descoberta do fogo"
            disabled={pending}
          />
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_TOPICS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onChange({ ...form, topic: t })}
                disabled={pending}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition",
                  form.topic === t
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="ai-category">Categoria</Label>
            <Select
              value={form.category}
              onValueChange={(v) => onChange({ ...form, category: v as typeof form.category })}
            >
              <SelectTrigger id="ai-category" disabled={pending}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="literary">Literário</SelectItem>
                <SelectItem value="informational">Informativo</SelectItem>
                <SelectItem value="mixed">Misto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-level">Nível</Label>
            <Select
              value={form.level}
              onValueChange={(v) => onChange({ ...form, level: v as typeof form.level })}
            >
              <SelectTrigger id="ai-level" disabled={pending}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Fácil</SelectItem>
                <SelectItem value="medium">Médio</SelectItem>
                <SelectItem value="hard">Difícil</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-count">Questões</Label>
            <Input
              id="ai-count"
              type="number"
              min={4}
              max={16}
              value={form.questionCount}
              onChange={(e) => onChange({ ...form, questionCount: Number(e.target.value) })}
              disabled={pending}
            />
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          A IA cria um texto de 250 a 500 palavras e distribui as {form.questionCount} questões
          entre os 4 processos PIRLS, misturando múltipla escolha e questões abertas com gabarito.
        </div>
      </div>
      <DialogFooter className="border-t pt-3">
        <Button variant="ghost" onClick={onBack} disabled={pending}>
          <ArrowLeft className="size-4" /> Voltar
        </Button>
        <Button variant="outline" onClick={() => onClose && onClose()} disabled={pending}>
          Cancelar
        </Button>
        <Button onClick={onGenerate} disabled={form.topic.trim().length < 3 || pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Gerando…
            </>
          ) : (
            <>
              <Sparkles className="size-4" /> Gerar e revisar
            </>
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

function AiGeneratePreview({
  preview,
  onSave,
  onRegenerate,
  saving,
  mcCount,
  openCount,
}: {
  preview: GeneratedPreview;
  onSave: () => void;
  onRegenerate: () => void;
  saving: boolean;
  mcCount: number;
  openCount: number;
}) {
  const [showAnswers, setShowAnswers] = useState(false);

  return (
    <>
      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        <div className="rounded-md border border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-display text-lg leading-tight">{preview.title}</h3>
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary">{CATEGORY_LABEL[preview.category]}</Badge>
              <Badge variant="outline">{LEVEL_LABEL[preview.level]}</Badge>
            </div>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <BookOpen className="size-3" />
              {preview.body.split(/\s+/).filter(Boolean).length} palavras
            </span>
            <span className="inline-flex items-center gap-1">
              <ListChecks className="size-3" />
              {preview.questions.length} questões ({mcCount} múltipla escolha, {openCount} abertas)
            </span>
          </div>
          <RichTextBody
            body={preview.body}
            className="mt-3 max-h-44 overflow-y-auto text-sm leading-relaxed"
          />
        </div>

        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Questões</h4>
          <Button size="sm" variant="ghost" onClick={() => setShowAnswers((v) => !v)}>
            {showAnswers ? "Ocultar gabarito" : "Ver gabarito"}
          </Button>
        </div>

        <ul className="space-y-2">
          {preview.questions.map((q, i) => (
            <li key={i} className="rounded-md border border-border p-3">
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">
                  {i + 1}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {PROCESS_LABEL[q.pirls_process] ?? q.pirls_process}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {q.q_type === "multiple_choice" ? "Múltipla escolha" : "Aberta"}
                </Badge>
              </div>
              <p className="text-sm">{q.statement}</p>
              {q.q_type === "multiple_choice" && q.options.length > 0 && (
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  {q.options.map((opt, j) => (
                    <div
                      key={j}
                      className={cn(
                        "rounded border px-2 py-1 text-xs",
                        showAnswers && q.correct_answer === opt
                          ? "border-success/50 bg-success/10 font-medium text-foreground"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {opt}
                    </div>
                  ))}
                </div>
              )}
              {showAnswers && (
                <div className="mt-2 rounded bg-muted/40 p-2 text-xs">
                  <p>
                    <span className="font-medium">Gabarito: </span>
                    {q.correct_answer}
                  </p>
                  {q.explanation && (
                    <p className="mt-1 text-muted-foreground">
                      <span className="font-medium text-foreground">Explicação: </span>
                      {q.explanation}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
      <DialogFooter className="border-t pt-3">
        <Button variant="outline" onClick={onRegenerate} disabled={saving}>
          <RefreshCw className="size-4" /> Gerar novamente
        </Button>
        <Button onClick={onSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Salvando…
            </>
          ) : (
            <>
              <Check className="size-4" /> Adicionar página
            </>
          )}
        </Button>
      </DialogFooter>
    </>
  );
}
