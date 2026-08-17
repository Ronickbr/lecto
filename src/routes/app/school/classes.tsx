import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { createClassFn, updateClassFn, deleteClassFn } from "@/lib/manage.functions";
import { buildClassCode } from "@/lib/class-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Copy,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
  School,
  Search,
  KeyRound,
  UserRound,
} from "lucide-react";
import { showError, toast } from "@/lib/errors/feedback";

export const Route = createFileRoute("/app/school/classes")({
  head: () => ({
    meta: [
      { title: "Turmas | Lecto" },
      {
        name: "description",
        content: "Crie, edite e acompanhe as turmas da escola e seus códigos de acesso.",
      },
    ],
  }),
  component: ClassesPage,
});

interface ClassRow {
  id: string;
  name: string;
  grade: string | null;
  academic_year: number | null;
  class_code: string;
  teacher_id: string | null;
  teacher: { full_name: string } | null;
}

const emptyForm = {
  name: "",
  grade: "",
  academicYear: String(new Date().getFullYear()),
  teacherId: "",
};

function ClassesPage() {
  const { data: user } = useCurrentUser();
  const schoolId = user?.schoolId;
  const qc = useQueryClient();
  const createClass = useServerFn(createClassFn);
  const updateClass = useServerFn(updateClassFn);
  const deleteClass = useServerFn(deleteClassFn);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [removing, setRemoving] = useState<ClassRow | null>(null);

  const { data: classes, isLoading } = useQuery({
    queryKey: ["classes", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, grade, academic_year, class_code, teacher_id")
        .eq("school_id", schoolId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data as unknown as Array<Omit<ClassRow, "teacher">>;
      const ids = Array.from(
        new Set(rows.map((r) => r.teacher_id).filter((id): id is string => !!id)),
      );
      const teacherMap: Record<string, string> = {};
      if (ids.length) {
        const { data: ts } = await supabase.from("teachers").select("id, full_name").in("id", ids);
        (ts ?? []).forEach((t) => {
          teacherMap[t.id] = t.full_name;
        });
      }
      return rows.map(
        (r) =>
          ({
            ...r,
            teacher:
              r.teacher_id && teacherMap[r.teacher_id]
                ? { full_name: teacherMap[r.teacher_id] }
                : null,
          }) as ClassRow,
      );
    },
  });

  const { data: teachers } = useQuery({
    queryKey: ["teachers-select", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase
        .from("teachers")
        .select("id, full_name")
        .eq("school_id", schoolId!);
      return data ?? [];
    },
  });

  const { data: counts } = useQuery({
    queryKey: ["class-student-counts", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("class_id")
        .eq("school_id", schoolId!);
      const map: Record<string, number> = {};
      (data ?? []).forEach((s) => {
        if (s.class_id) map[s.class_id] = (map[s.class_id] ?? 0) + 1;
      });
      return map;
    },
  });

  const totalStudents = useMemo(
    () => Object.values(counts ?? {}).reduce((a, b) => a + b, 0),
    [counts],
  );
  const withoutTeacher = useMemo(
    () => (classes ?? []).filter((c) => !c.teacher_id).length,
    [classes],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return classes ?? [];
    return (classes ?? []).filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.class_code.toLowerCase().includes(term) ||
        (c.grade ?? "").toLowerCase().includes(term) ||
        (c.teacher?.full_name ?? "").toLowerCase().includes(term),
    );
  }, [classes, q]);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["classes", schoolId] });
    qc.invalidateQueries({ queryKey: ["classes-select", schoolId] });
    qc.invalidateQueries({ queryKey: ["school-overview", schoolId] });
  }

  async function run(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      refresh();
      return true;
    } catch (e) {
      showError(e, { fallback: "Falha na operação" });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId) return;
    let createdCode: string | undefined;
    const ok = await run(
      async () => {
        const { class: created } = await createClass({
          data: {
            schoolId,
            name: form.name,
            grade: form.grade || null,
            academicYear: parseInt(form.academicYear, 10) || null,
            teacherId: form.teacherId || null,
          },
        });
        createdCode = (created as unknown as ClassRow).class_code;
        qc.setQueryData<ClassRow[]>(["classes", schoolId], (old) => [
          created as unknown as ClassRow,
          ...(old ?? []),
        ]);
      },
      createdCode ? `Turma criada — código ${createdCode}` : "Turma criada",
    );
    if (ok) {
      setOpen(false);
      setForm(emptyForm);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const ok = await run(async () => {
      const { class: updated } = await updateClass({
        data: {
          classId: editing.id,
          name: editForm.name,
          grade: editForm.grade || null,
          academicYear: parseInt(editForm.academicYear, 10) || null,
          teacherId: editForm.teacherId || null,
        },
      });
      const row = updated as unknown as ClassRow;
      qc.setQueryData<ClassRow[]>(["classes", schoolId], (old) =>
        (old ?? []).map((c) => (c.id === row.id ? row : c)),
      );
    }, "Turma atualizada");
    if (ok) setEditing(null);
  }

  async function handleDelete() {
    if (!removing) return;
    const ok = await run(async () => {
      await deleteClass({ data: { classId: removing.id } });
      qc.setQueryData<ClassRow[]>(["classes", schoolId], (old) =>
        (old ?? []).filter((c) => c.id !== removing.id),
      );
    }, "Turma removida");
    if (ok) setRemoving(null);
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado");
  }

  const stats = [
    { label: "Turmas", value: classes?.length ?? 0, icon: School },
    { label: "Alunos alocados", value: totalStudents, icon: Users },
    { label: "Sem responsável", value: withoutTeacher, icon: UserRound },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Turmas</h1>
          <p className="text-muted-foreground">
            As turmas devem ser cadastradas após os profissionais e antes dos alunos.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" /> Nova turma
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Nova turma</DialogTitle>
                <DialogDescription>
                  O código de acesso é gerado automaticamente a partir dos dados informados.
                </DialogDescription>
              </DialogHeader>
              <ClassFields form={form} setForm={setForm} teachers={teachers ?? []} />
              <DialogFooter>
                <Button type="submit" disabled={busy}>
                  {busy ? "Criando…" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
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

      <Card className="overflow-hidden shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="font-medium">Listagem de turmas</h2>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, código, série…"
              className="pl-8"
              aria-label="Buscar turmas"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Série</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead>Professor</TableHead>
                <TableHead>Alunos</TableHead>
                <TableHead>Código</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-6">
                    <div className="space-y-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && (classes?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                        <School className="size-6 text-primary" />
                      </div>
                      <p className="font-medium">Nenhuma turma criada</p>
                      <p className="text-sm text-muted-foreground">
                        Crie a primeira turma para começar a alocar professores e alunos.
                      </p>
                      <Button size="sm" onClick={() => setOpen(true)}>
                        <Plus className="mr-2 size-4" /> Nova turma
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && (classes?.length ?? 0) > 0 && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Nenhuma turma encontrada para “{q}”.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.grade ?? "—"}</TableCell>
                  <TableCell>{c.academic_year ?? "—"}</TableCell>
                  <TableCell>{c.teacher?.full_name ?? "—"}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Users className="size-3.5" /> {counts?.[c.id] ?? 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => copyCode(c.class_code)}
                      className="inline-flex items-center gap-1.5"
                      title="Copiar código"
                    >
                      <Badge variant="outline" className="font-mono">
                        {c.class_code}
                      </Badge>
                      <Copy className="size-3 text-muted-foreground" />
                    </button>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Ações da turma ${c.name}`}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(c);
                            setEditForm({
                              name: c.name,
                              grade: c.grade ?? "",
                              academicYear: String(c.academic_year ?? new Date().getFullYear()),
                              teacherId: c.teacher_id ?? "",
                            });
                          }}
                        >
                          <Pencil className="mr-2 size-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/app/school/students">
                            <Users className="mr-2 size-4" /> Ver alunos
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setRemoving(c)}
                        >
                          <Trash2 className="mr-2 size-4" /> Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <form onSubmit={handleUpdate} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Editar turma</DialogTitle>
              <DialogDescription>
                O código de acesso será regenerado automaticamente a partir dos dados informados.
              </DialogDescription>
            </DialogHeader>
            <ClassFields form={editForm} setForm={setEditForm} teachers={teachers ?? []} />
            <DialogFooter>
              <Button type="submit" disabled={busy}>
                {busy ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(v) => !v && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover a turma {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Turmas com alunos alocados não podem ser removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={busy}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClassFields({
  form,
  setForm,
  teachers,
}: {
  form: typeof emptyForm;
  setForm: (f: typeof emptyForm) => void;
  teachers: { id: string; full_name: string }[];
}) {
  const previewCode = buildClassCode({
    name: form.name,
    grade: form.grade,
    academicYear: parseInt(form.academicYear, 10) || null,
  });

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2 space-y-2">
        <Label>Nome</Label>
        <Input
          required
          placeholder="Ex.: 5º ano A"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Série / Ano</Label>
        <Input
          placeholder="5º"
          value={form.grade}
          onChange={(e) => setForm({ ...form, grade: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Ano letivo</Label>
        <Input
          type="number"
          value={form.academicYear}
          onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
        />
      </div>
      <div className="col-span-2 space-y-2">
        <Label>Profissional responsável (Opcional)</Label>
        <Select value={form.teacherId} onValueChange={(v) => setForm({ ...form, teacherId: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Opcional" />
          </SelectTrigger>
          <SelectContent>
            {teachers.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2 flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2.5">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <KeyRound className="size-4" /> Código gerado
        </span>
        <Badge variant="outline" className="font-mono">
          {previewCode}
        </Badge>
      </div>
    </div>
  );
}
