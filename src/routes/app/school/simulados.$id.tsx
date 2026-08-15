import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RichTextBody } from "@/components/rich-text";
import { useServerFn } from "@tanstack/react-start";
import { generateTextAndQuestionsFn, reorderFn } from "@/lib/simulados.functions";
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
} from "lucide-react";
import { toast } from "sonner";

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

function SimuladoEditor() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [newPageOpen, setNewPageOpen] = useState(false);
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
    onError: (e: Error) => toast.error(e.message),
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
          <Button variant="outline" onClick={() => setAiOpen(true)}>
            <Sparkles className="size-4" /> Gerar página com IA
          </Button>
          <Button variant="outline" onClick={() => setNewPageOpen(true)}>
            <Plus className="size-4" /> Nova página
          </Button>
          <Button onClick={() => publishMut.mutate()} disabled={publishMut.isPending}>
            <Send className="size-4" />{" "}
            {simulado?.status === "published" ? "Despublicar" : "Publicar"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] [&>*]:min-w-0">
        <Card className="p-3 h-fit">
          <h3 className="mb-2 px-1 text-sm font-medium text-muted-foreground">
            Páginas ({pages?.length ?? 0})
          </h3>
          {!pages?.length && (
            <p className="p-2 text-sm text-muted-foreground">Adicione a primeira página.</p>
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
            <Card className="p-10 text-center text-muted-foreground">
              Nenhuma página selecionada.
            </Card>
          )}
        </div>
      </div>

      {aiOpen && <AiGeneratePageDialog simuladoId={id} onClose={() => setAiOpen(false)} />}
      {newPageOpen && (
        <NewPageDialog
          simuladoId={id}
          pageCount={pages?.length ?? 0}
          onClose={() => setNewPageOpen(false)}
        />
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
                    <p className="text-sm">{b.questions.statement}</p>
                  )}
                </div>
                <button onClick={() => deleteBlockMut.mutate(b.id)}>
                  <Trash2 className="size-3.5 text-destructive" />
                </button>
              </SortableBlockItem>
            ))}
            {!blocks?.length && (
              <p className="text-sm text-muted-foreground text-center py-6">Sem blocos ainda.</p>
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

function NewPageDialog({
  simuladoId,
  pageCount,
  onClose,
}: {
  simuladoId: string;
  pageCount: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", instructions: "", text_id: "" });
  const { data: texts } = useQuery({
    queryKey: ["texts-select"],
    queryFn: async () =>
      (await supabase.from("texts").select("id, title").order("title")).data ?? [],
  });

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("simulado_pages").insert({
        simulado_id: simuladoId,
        position: pageCount,
        title: form.title || null,
        instructions: form.instructions || null,
        text_id: form.text_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["simulado-pages", simuladoId] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova página</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <Label>Instruções</Label>
            <Textarea
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            />
          </div>
          <div>
            <Label>Texto associado (opcional)</Label>
            <Select value={form.text_id} onValueChange={(v) => setForm({ ...form, text_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione do banco" />
              </SelectTrigger>
              <SelectContent>
                {texts?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    onError: (e: Error) => toast.error(e.message),
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

function AiGeneratePageDialog({
  simuladoId,
  onClose,
}: {
  simuladoId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const generate = useServerFn(generateTextAndQuestionsFn);
  const [form, setForm] = useState({
    topic: "",
    level: "medium" as const,
    category: "literary" as const,
    questionCount: 8,
  });

  const mut = useMutation({
    mutationFn: () => generate({ data: { ...form, simuladoId } }),
    onSuccess: () => {
      toast.success("Página gerada!");
      qc.invalidateQueries({ queryKey: ["simulado-pages", simuladoId] });
      qc.invalidateQueries({ queryKey: ["texts"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar página com IA</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tema</Label>
            <Input
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Categoria</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v as typeof form.category })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="literary">Literário</SelectItem>
                  <SelectItem value="informational">Informativo</SelectItem>
                  <SelectItem value="mixed">Misto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nível</Label>
              <Select
                value={form.level}
                onValueChange={(v) => setForm({ ...form, level: v as typeof form.level })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Fácil</SelectItem>
                  <SelectItem value="medium">Médio</SelectItem>
                  <SelectItem value="hard">Difícil</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Questões</Label>
              <Input
                type="number"
                min={4}
                max={16}
                value={form.questionCount}
                onChange={(e) => setForm({ ...form, questionCount: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!form.topic || mut.isPending}>
            {mut.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Gerando…
              </>
            ) : (
              <>
                <Sparkles className="size-4" /> Gerar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
