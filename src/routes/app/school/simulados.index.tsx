import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createSimuladoFn } from "@/lib/simulados.functions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Search,
  FileText,
  Library,
  Clock,
  Layers,
  ListChecks,
} from "lucide-react";
import { showError, toast } from "@/lib/errors/feedback";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/school/simulados/")({
  head: () => ({ meta: [{ title: "Simulados | Lecto" }] }),
  component: SimuladosPage,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};

const STATUS_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "draft", label: "Rascunho" },
  { value: "published", label: "Publicado" },
  { value: "archived", label: "Arquivado" },
];

type SimuladoRow = {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  time_limit_minutes: number;
  classes?: { name: string } | null;
};

function SimuladosPage() {
  const { data: user } = useCurrentUser();
  const schoolId = user?.schoolId;
  const canEdit = user?.primaryRole === "school_admin" || user?.primaryRole === "teacher";
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: simulados, isLoading } = useQuery({
    queryKey: ["simulados", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simulados")
        .select("*, classes(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (data ?? []).map((s) => s.id);
      const { data: pages } = await supabase
        .from("simulado_pages")
        .select("simulado_id, simulado_blocks(id, question_id)")
        .in("simulado_id", ids);
      const pageCount = new Map<string, number>();
      const questionCount = new Map<string, number>();
      for (const p of pages ?? []) {
        pageCount.set(p.simulado_id, (pageCount.get(p.simulado_id) ?? 0) + 1);
        const n = (p.simulado_blocks ?? []).filter((b) => b.question_id).length;
        questionCount.set(p.simulado_id, (questionCount.get(p.simulado_id) ?? 0) + n);
      }
      return (data ?? []).map((s) => ({
        ...s,
        pageCount: pageCount.get(s.id) ?? 0,
        questionCount: questionCount.get(s.id) ?? 0,
      }));
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("simulados").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Simulado excluído");
      qc.invalidateQueries({ queryKey: ["simulados"] });
    },
    onError: (e: Error) => showError(e),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (simulados ?? []).filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (!q) return true;
      return s.title.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q);
    });
  }, [simulados, search, statusFilter]);

  const publishedCount = (simulados ?? []).filter((s) => s.status === "published").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Simulados</h1>
          <p className="text-muted-foreground">
            Monte simulados PIRLS com páginas, textos e questões geradas por IA.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Novo simulado
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="shadow-soft">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary">
              <Layers className="size-4" />
            </div>
            <div>
              <p className="font-display text-lg leading-none">{simulados?.length ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Simulados no total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary">
              <Library className="size-4" />
            </div>
            <div>
              <p className="font-display text-lg leading-none">{publishedCount}</p>
              <p className="text-xs text-muted-foreground">Publicados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary">
              <ListChecks className="size-4" />
            </div>
            <div>
              <p className="font-display text-lg leading-none">
                {simulados?.reduce((acc, s) => acc + s.questionCount, 0) ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground">Questões no total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título ou descrição…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition",
                statusFilter === f.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-accent",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead>Tempo</TableHead>
                <TableHead>Páginas</TableHead>
                <TableHead>Questões</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center">
                    <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12">
                    <div className="mx-auto max-w-sm text-center">
                      <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-primary/10">
                        <FileText className="size-6 text-primary" />
                      </div>
                      {simulados?.length === 0 ? (
                        <>
                          <p className="font-medium">Ainda não há simulados</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Crie seu primeiro simulado e use a IA para montar texto e questões PIRLS
                            em minutos.
                          </p>
                          {canEdit && (
                            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                              <Plus className="size-4" /> Criar simulado
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="font-medium">Nada encontrado</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Nenhum simulado corresponde a "{search}" nesse filtro.
                          </p>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <p className="font-medium">{s.title}</p>
                    {s.description && (
                      <p className="line-clamp-1 max-w-[320px] text-xs text-muted-foreground">
                        {s.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.classes?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" /> {s.time_limit_minutes} min
                    </span>
                  </TableCell>
                  <TableCell>{s.pageCount}</TableCell>
                  <TableCell>{s.questionCount}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "published" ? "default" : "outline"}>
                      {STATUS_LABEL[s.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/app/school/simulados/$id" params={{ id: s.id }}>
                        <Pencil className="size-4" /> Editor
                      </Link>
                    </Button>
                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Excluir simulado?")) deleteMut.mutate(s.id);
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {createOpen && schoolId && (
        <CreateSimuladoDialog schoolId={schoolId} onClose={() => setCreateOpen(false)} />
      )}
    </div>
  );
}

function CreateSimuladoDialog({ schoolId, onClose }: { schoolId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const createSimulado = useServerFn(createSimuladoFn);
  const [form, setForm] = useState({
    title: "",
    description: "",
    class_id: "",
    time_limit_minutes: 60,
  });

  const { data: classes } = useQuery({
    queryKey: ["classes-select", schoolId],
    queryFn: async () =>
      (await supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name"))
        .data ?? [],
  });

  const mut = useMutation({
    mutationFn: async () =>
      createSimulado({
        data: {
          schoolId,
          title: form.title,
          description: form.description || null,
          classId: form.class_id || null,
          timeLimitMinutes: form.time_limit_minutes,
        },
      }),
    onSuccess: () => {
      toast.success("Simulado criado");
      qc.invalidateQueries({ queryKey: ["simulados"] });
      onClose();
    },
    onError: (e: Error) => showError(e),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo simulado</DialogTitle>
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
            <Label>Descrição</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Turma</Label>
              <Select
                value={form.class_id}
                onValueChange={(v) => setForm({ ...form, class_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {classes?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Duração (min)</Label>
              <Input
                type="number"
                min={5}
                value={form.time_limit_minutes}
                onChange={(e) => setForm({ ...form, time_limit_minutes: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!form.title || mut.isPending}>
            {mut.isPending && <Loader2 className="size-4 animate-spin" />} Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
