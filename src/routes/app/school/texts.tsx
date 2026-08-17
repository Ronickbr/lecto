import { createFileRoute } from "@tanstack/react-router";
import { generateRubricFn } from "@/lib/rubrics.functions";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { generateTextAndQuestionsFn } from "@/lib/simulados.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Sparkles,
  Trash2,
  Eye,
  Loader2,
  Search,
  Pencil,
  ListChecks,
  ChevronDown,
  ChevronUp,
  ImagePlus,
} from "lucide-react";
import { showError, toast } from "@/lib/errors/feedback";
import { RichTextBody } from "@/components/rich-text";
import { TEXT_IMAGES_BUCKET } from "@/components/rich-text-utils";

export const Route = createFileRoute("/app/school/texts")({
  head: () => ({ meta: [{ title: "Banco de textos | Lecto" }] }),
  component: TextsPage,
});

const CATEGORY_LABEL: Record<string, string> = {
  literary: "Literário",
  informational: "Informativo",
  mixed: "Misto",
};
const LEVEL_LABEL: Record<string, string> = { easy: "Fácil", medium: "Médio", hard: "Difícil" };
const PROCESS_LABEL: Record<string, string> = {
  locate_information: "Localizar",
  straightforward_inference: "Inferência direta",
  interpret_integrate: "Interpretar/integrar",
  evaluate_critique: "Avaliar/criticar",
};

type Category = "literary" | "informational" | "mixed";
type Level = "easy" | "medium" | "hard";
type QType = "multiple_choice" | "open";
type Process =
  "locate_information" | "straightforward_inference" | "interpret_integrate" | "evaluate_critique";

const HOWTO_STEPS = [
  {
    title: "Abra o texto",
    body: "Na tabela abaixo, clique no ícone de olho (Ver / questões) da linha do texto desejado. As questões sempre ficam vinculadas a um texto, como no PIRLS.",
  },
  {
    title: 'Clique em "Nova questão"',
    body: 'Dentro da janela do texto, role até a seção "Questões" e use o botão "Nova questão" no canto direito.',
  },
  {
    title: "Escolha o tipo: objetiva ou descritiva",
    body: 'Em "Tipo", selecione "Múltipla escolha" para perguntas objetivas (enunciado + alternativas + marcar a correta) ou "Aberta" para perguntas descritivas (enunciado + resposta modelo + rubrica usada pela correção com IA).',
  },
  {
    title: "Classifique e salve",
    body: "Defina o processo PIRLS (localizar, inferir, interpretar ou avaliar), os pontos e a explicação. Clique em Salvar — a questão passa a aparecer na lista do texto.",
  },
  {
    title: "Use no simulado",
    body: 'No Editor de Simulados, adicione um bloco "Questão" na página e selecione a questão criada.',
  },
];

function HowToAddQuestions() {
  const [open, setOpen] = useState(true);
  return (
    <Card className="border-primary/20 bg-primary/5 shadow-soft">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="size-4 text-primary" />
            Onde inserir as perguntas (objetivas e descritivas)
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            <span className="sr-only sm:not-sr-only">{open ? "Ocultar" : "Ver passo a passo"}</span>
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="pt-0">
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {HOWTO_STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3 rounded-lg border border-border bg-card p-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-snug">{s.title}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      )}
    </Card>
  );
}

function TextsPage() {
  const { data: user } = useCurrentUser();
  const schoolId = user?.schoolId;
  const canEdit = user?.primaryRole === "school_admin" || user?.primaryRole === "teacher";
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [level, setLevel] = useState<string>("all");
  const [viewId, setViewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const { data: texts, isLoading } = useQuery({
    queryKey: ["texts", schoolId, search, category, level],
    enabled: !!schoolId,
    queryFn: async () => {
      let q = supabase.from("texts").select("*").order("created_at", { ascending: false });
      if (category !== "all") q = q.eq("category", category as Category);
      if (level !== "all") q = q.eq("level", level as Level);
      if (search) q = q.ilike("title", `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("texts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Texto excluído");
      qc.invalidateQueries({ queryKey: ["texts"] });
    },
    onError: (e: Error) => showError(e),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Banco de textos e mídias</h1>
          <p className="text-muted-foreground">
            Textos puros para treino e versões "revista" para simulados oficiais.
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAiOpen(true)}>
              <Sparkles className="size-4" /> Gerar com IA
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> Novo texto
            </Button>
          </div>
        )}
      </div>

      {canEdit && <HowToAddQuestions />}

      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por título"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                <SelectItem value="literary">Literário</SelectItem>
                <SelectItem value="informational">Informativo</SelectItem>
                <SelectItem value="mixed">Misto</SelectItem>
              </SelectContent>
            </Select>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Nível" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos níveis</SelectItem>
                <SelectItem value="easy">Fácil</SelectItem>
                <SelectItem value="medium">Médio</SelectItem>
                <SelectItem value="hard">Difícil</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead>Palavras</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    <Loader2 className="mx-auto size-4 animate-spin" />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && texts?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum texto ainda. Crie um manualmente ou gere com IA.
                  </TableCell>
                </TableRow>
              )}
              {texts?.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{CATEGORY_LABEL[t.category]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{LEVEL_LABEL[t.level]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{t.word_count ?? "—"}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Ver / questões"
                      onClick={() => setViewId(t.id)}
                    >
                      <Eye className="size-4" />
                    </Button>
                    {canEdit && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Editar texto"
                          onClick={() => setEditId(t.id)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Excluir"
                          onClick={() => {
                            if (confirm("Excluir este texto e suas questões?"))
                              deleteMut.mutate(t.id);
                          }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {createOpen && schoolId && (
        <TextFormDialog schoolId={schoolId} onClose={() => setCreateOpen(false)} />
      )}
      {editId && schoolId && (
        <TextFormDialog schoolId={schoolId} textId={editId} onClose={() => setEditId(null)} />
      )}
      {aiOpen && <AiGenerateDialog onClose={() => setAiOpen(false)} />}
      {viewId && (
        <TextDetailDialog
          textId={viewId}
          canEdit={canEdit}
          schoolId={schoolId ?? undefined}
          onClose={() => setViewId(null)}
        />
      )}
    </div>
  );
}

function TextFormDialog({
  schoolId,
  textId,
  onClose,
}: {
  schoolId: string;
  textId?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!textId;
  const [form, setForm] = useState({
    title: "",
    body: "",
    category: "literary",
    level: "medium",
    source: "",
    text_type: "standard",
  });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const imageCount = (form.body.match(/!\[[^\]]*\]\([^)\s]+\)/g) ?? []).length;
  const hasImage = imageCount > 0;

  function removeImage() {
    setForm((f) => ({
      ...f,
      body: f.body.replace(/\n*!\[[^\]]*\]\([^)\s]+\)\n*/, "\n\n").trimStart(),
    }));
    toast.success("Imagem removida");
  }

  async function uploadImage(file: File) {
    if (hasImage) return showError("Cada texto pode ter apenas uma imagem");
    if (!file.type.startsWith("image/")) return showError("Selecione um arquivo de imagem");
    if (file.size > 5 * 1024 * 1024) return showError("A imagem deve ter no máximo 5 MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${schoolId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(TEXT_IMAGES_BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      const snippet = `\n\n![Imagem](storage:${path})\n\n`;
      const el = bodyRef.current;
      const pos = el?.selectionStart ?? form.body.length;
      const next = form.body.slice(0, pos) + snippet + form.body.slice(pos);
      setForm((f) => ({ ...f, body: next }));
      toast.success("Imagem inserida no texto");
    } catch (e) {
      showError(e, { fallback: "Falha ao enviar imagem" });
    } finally {
      setUploading(false);
    }
  }

  const { data: existing, isLoading } = useQuery({
    queryKey: ["text-edit", textId],
    enabled: isEdit,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("texts")
        .select("*")
        .eq("id", textId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existing) {
      setForm({
        title: existing.title,
        body: existing.body,
        category: existing.category,
        level: existing.level,
        source: existing.source ?? "",
        text_type: (existing as { text_type?: string }).text_type || "standard",
      });
    }
  }, [existing]);

  const mut = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        body: form.body,
        category: form.category as Category,
        level: form.level as Level,
        source: form.source || null,
        word_count: form.body.split(/\s+/).filter(Boolean).length,
        text_type: form.text_type,
      } satisfies Record<string, unknown>;
      if (isEdit) {
        const { error } = await supabase.from("texts").update(payload).eq("id", textId!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("texts").insert({ school_id: schoolId, ...payload });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Texto atualizado" : "Texto criado");
      qc.invalidateQueries({ queryKey: ["texts"] });
      qc.invalidateQueries({ queryKey: ["text-detail", textId] });
      onClose();
    },
    onError: (e: Error) => showError(e),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar texto" : "Novo texto"}</DialogTitle>
        </DialogHeader>
        {isEdit && isLoading ? (
          <div className="py-8 text-center">
            <Loader2 className="mx-auto size-4 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Tipo de exibição</Label>
                <Select
                  value={form.text_type || "standard"}
                  onValueChange={(v) => setForm({ ...form, text_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Texto puro (Treinamento)</SelectItem>
                    <SelectItem value="magazine">Estilo Revista (Simulado/Imagens)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  "Estilo Revista" prioriza a visualização de imagens em tela cheia no simulado.
                </p>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
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
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Nível</Label>
                <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
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
                <Label>Fonte</Label>
                <Input
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <Label>Corpo do texto</Label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) uploadImage(file);
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label="Fazer upload de imagem para o corpo do texto (1 imagem por texto, máximo 5 MB)"
                    data-e2e="text-upload-image-btn"
                    disabled={uploading || hasImage}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ImagePlus className="size-4" />
                    )}{" "}
                    Inserir imagem
                  </Button>
                  {hasImage && (
                    <Button type="button" size="sm" variant="ghost" onClick={removeImage}>
                      Remover imagem
                    </Button>
                  )}
                </div>
              </div>
              <Textarea
                ref={bodyRef}
                rows={10}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {hasImage
                  ? "Este texto já possui uma imagem (limite de 1 por texto). Remova a atual para trocar."
                  : "É permitida apenas 1 imagem por texto. Ela é inserida no ponto onde o cursor está, no formato ![legenda](...). Edite a legenda entre colchetes."}
              </p>

              {form.body.includes("![") && (
                <div className="mt-3 rounded-md border border-border bg-muted/30 p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Pré-visualização</p>
                  <RichTextBody body={form.body} className="text-sm leading-relaxed" />
                </div>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={!form.title || !form.body || mut.isPending}
          >
            {mut.isPending && <Loader2 className="size-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AiGenerateDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const generate = useServerFn(generateTextAndQuestionsFn);
  const [form, setForm] = useState({
    topic: "",
    level: "medium" as const,
    category: "literary" as const,
    questionCount: 8,
  });
  const mut = useMutation({
    mutationFn: () => generate({ data: form }),
    onSuccess: () => {
      toast.success("Texto e questões gerados!");
      qc.invalidateQueries({ queryKey: ["texts"] });
      qc.invalidateQueries({ queryKey: ["questions"] });
      onClose();
    },
    onError: (e: Error) => showError(e),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar texto com IA</DialogTitle>
          <DialogDescription>
            Gera texto balanceado pela matriz PIRLS com questões prontas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tema</Label>
            <Input
              placeholder="Ex.: A vida no fundo do oceano"
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
              <Label>Nº questões</Label>
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

type QuestionDraft = {
  id?: string;
  statement: string;
  q_type: QType;
  options: string[];
  pirls_process: Process;
  points: number;
  explanation: string;
  correct_answer: string;
  rubric: string;
};

const EMPTY_QUESTION: QuestionDraft = {
  statement: "",
  q_type: "multiple_choice",
  options: ["", "", "", ""],
  pirls_process: "locate_information",
  points: 1,
  explanation: "",
  correct_answer: "",
  rubric: "",
};

function TextDetailDialog({
  textId,
  canEdit,
  schoolId,
  onClose,
}: {
  textId: string;
  canEdit: boolean;
  schoolId?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [editingQuestion, setEditingQuestion] = useState<QuestionDraft | null>(null);

  const { data } = useQuery({
    queryKey: ["text-detail", textId],
    queryFn: async () => {
      const [{ data: text }, { data: questions }] = await Promise.all([
        supabase.from("texts").select("*").eq("id", textId).maybeSingle(),
        supabase.from("questions").select("*").eq("text_id", textId).order("created_at"),
      ]);
      const ids = (questions ?? []).map((q) => q.id);
      const { data: keys } = await supabase
        .from("question_keys")
        .select("question_id, correct_answer, rubric")
        .in("question_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const keyById = new Map((keys ?? []).map((k) => [k.question_id, k]));
      return {
        text,
        questions: (questions ?? []).map((q) => ({
          ...q,
          correct_answer: keyById.get(q.id)?.correct_answer ?? null,
          rubric: keyById.get(q.id)?.rubric ?? null,
        })),
      };
    },
  });

  const deleteQuestion = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("question_keys").delete().eq("question_id", id);
      const { error } = await supabase.from("questions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Questão excluída");
      qc.invalidateQueries({ queryKey: ["text-detail", textId] });
    },
    onError: (e: Error) => showError(e),
  });

  const textSchoolId = data?.text?.school_id ?? schoolId ?? undefined;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data?.text?.title ?? "Carregando…"}</DialogTitle>
          <DialogDescription>
            {data?.text && (
              <span className="flex flex-wrap gap-2">
                <Badge variant="secondary">{CATEGORY_LABEL[data.text.category]}</Badge>
                <Badge variant="outline">{LEVEL_LABEL[data.text.level]}</Badge>
                <span className="text-xs text-muted-foreground">
                  {data.text.word_count ?? 0} palavras
                </span>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        {data?.text && (
          <div className="space-y-4">
            <RichTextBody
              body={data.text.body}
              className="rounded-md border border-border bg-muted/30 p-4 text-sm leading-relaxed"
            />
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="font-medium">Questões ({data.questions.length})</h3>
                {canEdit && (
                  <Button
                    size="sm"
                    onClick={() =>
                      setEditingQuestion({ ...EMPTY_QUESTION, options: ["", "", "", ""] })
                    }
                  >
                    <Plus className="size-4" /> Nova questão
                  </Button>
                )}
              </div>
              {canEdit && (
                <p className="mb-3 flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                  <ListChecks className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    Clique em <strong>Nova questão</strong> acima e escolha o tipo:{" "}
                    <strong>Múltipla escolha</strong> (objetiva, com alternativas e gabarito) ou{" "}
                    <strong>Aberta</strong> (descritiva, com resposta modelo e rubrica para a
                    correção por IA).
                  </span>
                </p>
              )}
              <div className="space-y-3">
                {data.questions.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma questão vinculada a este texto ainda.
                  </p>
                )}
                {data.questions.map((q, i) => (
                  <Card key={q.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-xs font-semibold">Q{i + 1}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {PROCESS_LABEL[q.pirls_process]}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {q.q_type === "multiple_choice" ? "Múltipla escolha" : "Aberta"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{q.points} pt</span>
                        </div>
                        <p className="text-sm">{q.statement}</p>
                        {q.q_type === "multiple_choice" && Array.isArray(q.options) && (
                          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                            {(q.options as string[]).map((op, oi) => (
                              <li
                                key={oi}
                                className={
                                  op === q.correct_answer ? "text-primary font-medium" : ""
                                }
                              >
                                {String.fromCharCode(65 + oi)}. {op}
                              </li>
                            ))}
                          </ul>
                        )}
                        {q.q_type === "open" && q.correct_answer && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            <strong>Resposta modelo:</strong> {q.correct_answer}
                          </p>
                        )}
                        {q.rubric && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            <strong>Rubrica:</strong> {q.rubric}
                          </p>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Editar questão"
                            onClick={() =>
                              setEditingQuestion({
                                id: q.id,
                                statement: q.statement,
                                q_type: q.q_type as QType,
                                options:
                                  Array.isArray(q.options) && (q.options as string[]).length
                                    ? (q.options as string[])
                                    : ["", "", "", ""],
                                pirls_process: q.pirls_process as Process,
                                points: q.points,
                                explanation: q.explanation ?? "",
                                correct_answer: q.correct_answer ?? "",
                                rubric: q.rubric ?? "",
                              })
                            }
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Excluir questão"
                            onClick={() => {
                              if (confirm("Excluir esta questão?")) deleteQuestion.mutate(q.id);
                            }}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">Dicas rápidas</p>
                <ul className="list-disc space-y-0.5 pl-5">
                  <li>
                    Após salvar, use a ação{" "}
                    <strong className="text-foreground">Ver / questões</strong> na tabela para
                    adicionar questões manualmente.
                  </li>
                  <li>
                    Para gerar texto + questões com IA, feche este diálogo e use{" "}
                    <strong className="text-foreground">Gerar com IA</strong> na barra superior.
                  </li>
                  <li>
                    No editor de simulados, inclua um{" "}
                    <strong className="text-foreground">bloco Questão</strong> e reutilize qualquer
                    questão cadastrada.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>

        {editingQuestion && textSchoolId && (
          <QuestionFormDialog
            draft={editingQuestion}
            textId={textId}
            schoolId={textSchoolId}
            onClose={() => setEditingQuestion(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function QuestionFormDialog({
  draft,
  textId,
  schoolId,
  onClose,
}: {
  draft: QuestionDraft;
  textId: string;
  schoolId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<QuestionDraft>(draft);
  const isEdit = !!draft.id;
  const generateRubric = useServerFn(generateRubricFn);

  const mut = useMutation({
    mutationFn: async () => {
      const options =
        form.q_type === "multiple_choice" ? form.options.map((o) => o.trim()).filter(Boolean) : [];
      if (form.q_type === "multiple_choice") {
        if (options.length < 2) throw new Error("Informe pelo menos 2 alternativas");
        if (!options.includes(form.correct_answer))
          throw new Error("Selecione a alternativa correta");
      }
      const payload = {
        statement: form.statement,
        q_type: form.q_type,
        options,
        pirls_process: form.pirls_process,
        points: Number(form.points) || 1,
        explanation: form.explanation || null,
      };
      let questionId = form.id;
      if (isEdit) {
        const { error } = await supabase.from("questions").update(payload).eq("id", questionId!);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("questions")
          .insert({ school_id: schoolId, text_id: textId, ...payload })
          .select("id")
          .single();
        if (error) throw error;
        questionId = data.id;
      }
      const { error: keyError } = await supabase.from("question_keys").upsert({
        question_id: questionId!,
        school_id: schoolId,
        correct_answer: form.correct_answer || null,
        rubric: form.rubric || null,
      });
      if (keyError) throw keyError;

      // A IA define a rubrica das questões abertas automaticamente.
      if (form.q_type === "open" && !form.rubric.trim() && questionId) {
        try {
          await generateRubric({ data: { questionId } });
        } catch {
          /* a correção usa critério genérico se a geração falhar */
        }
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Questão atualizada" : "Questão criada");
      qc.invalidateQueries({ queryKey: ["text-detail", textId] });
      qc.invalidateQueries({ queryKey: ["questions"] });
      onClose();
    },
    onError: (e: Error) => showError(e),
  });

  const setOption = (i: number, v: string) => {
    const next = [...form.options];
    next[i] = v;
    setForm({ ...form, options: next });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar questão" : "Nova questão"}</DialogTitle>
          <DialogDescription>Vinculada ao texto selecionado.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Enunciado</Label>
            <Textarea
              rows={3}
              value={form.statement}
              onChange={(e) => setForm({ ...form, statement: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Tipo</Label>
              <Select
                value={form.q_type}
                onValueChange={(v) => setForm({ ...form, q_type: v as QType, correct_answer: "" })}
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
            <div>
              <Label>Processo PIRLS</Label>
              <Select
                value={form.pirls_process}
                onValueChange={(v) => setForm({ ...form, pirls_process: v as Process })}
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
            <div>
              <Label>Pontos</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={form.points}
                onChange={(e) => setForm({ ...form, points: Number(e.target.value) })}
              />
            </div>
          </div>

          {form.q_type === "multiple_choice" ? (
            <div className="space-y-2">
              <Label>Alternativas (marque a correta)</Label>
              {form.options.map((op, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct"
                    className="size-4 accent-primary"
                    checked={!!op && form.correct_answer === op}
                    onChange={() => setForm({ ...form, correct_answer: op })}
                  />
                  <span className="w-4 text-sm text-muted-foreground">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <Input
                    value={op}
                    onChange={(e) => {
                      const wasCorrect = form.correct_answer === op;
                      setOption(i, e.target.value);
                      if (wasCorrect)
                        setForm((f) => {
                          const next = [...f.options];
                          next[i] = e.target.value;
                          return { ...f, options: next, correct_answer: e.target.value };
                        });
                    }}
                    placeholder={`Alternativa ${String.fromCharCode(65 + i)}`}
                  />
                  {form.options.length > 2 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setForm({
                          ...form,
                          options: form.options.filter((_, oi) => oi !== i),
                        })
                      }
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setForm({ ...form, options: [...form.options, ""] })}
              >
                <Plus className="size-4" /> Alternativa
              </Button>
            </div>
          ) : (
            <div>
              <Label>Resposta modelo</Label>
              <Textarea
                rows={3}
                value={form.correct_answer}
                onChange={(e) => setForm({ ...form, correct_answer: e.target.value })}
              />
            </div>
          )}

          {form.q_type === "open" && (
            <div className="rounded-lg border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
              <strong className="text-foreground">Rubrica automática:</strong> a IA gera a rubrica
              de correção desta questão ao salvar. O professor pode revisar e ajustar depois em
              <em> Rubricas</em>.
            </div>
          )}
          <div>
            <Label>Explicação / justificativa</Label>
            <Textarea
              rows={2}
              value={form.explanation}
              onChange={(e) => setForm({ ...form, explanation: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!form.statement.trim() || mut.isPending}>
            {mut.isPending && <Loader2 className="size-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
