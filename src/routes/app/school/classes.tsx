import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
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
import { Plus, Copy, MoreHorizontal, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

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
  classCode: "",
  teacherId: "",
};

function ClassesPage() {
  const { data: user } = useCurrentUser();
  const schoolId = user?.schoolId;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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
        .select(
          "id, name, grade, academic_year, class_code, teacher_id, teacher:teachers(full_name)",
        )
        .eq("school_id", schoolId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ClassRow[];
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

  function refresh() {
    qc.invalidateQueries({ queryKey: ["classes", schoolId] });
    qc.invalidateQueries({ queryKey: ["classes-select", schoolId] });
    qc.invalidateQueries({ queryKey: ["school-overview", schoolId] });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId) return;
    setBusy(true);
    const { error } = await supabase.from("classes").insert({
      school_id: schoolId,
      name: form.name,
      grade: form.grade || null,
      academic_year: parseInt(form.academicYear, 10) || null,
      class_code: form.classCode.trim().toUpperCase(),
      teacher_id: form.teacherId || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Turma criada");
    setOpen(false);
    setForm(emptyForm);
    refresh();
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    const { error } = await supabase
      .from("classes")
      .update({
        name: editForm.name,
        grade: editForm.grade || null,
        academic_year: parseInt(editForm.academicYear, 10) || null,
        class_code: editForm.classCode.trim().toUpperCase(),
        teacher_id: editForm.teacherId || null,
      })
      .eq("id", editing.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Turma atualizada");
    setEditing(null);
    refresh();
  }

  async function handleDelete() {
    if (!removing) return;
    if ((counts?.[removing.id] ?? 0) > 0) {
      setRemoving(null);
      return toast.error("Mova ou remova os alunos antes de excluir a turma");
    }
    const { error } = await supabase.from("classes").delete().eq("id", removing.id);
    setRemoving(null);
    if (error) return toast.error(error.message);
    toast.success("Turma removida");
    refresh();
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Turmas</h1>
          <p className="text-muted-foreground">
            {classes?.length ?? 0} turma(s) · {totalStudents} aluno(s) alocados. As turmas devem ser
            cadastradas após os profissionais e antes dos alunos.
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
              </DialogHeader>
              <ClassFields form={form} setForm={setForm} teachers={teachers ?? []} />
              <DialogFooter>
                <Button type="submit" disabled={busy}>
                  Criar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="overflow-hidden shadow-soft">
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
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Carregando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && classes?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Nenhuma turma criada.
                  </TableCell>
                </TableRow>
              )}
              {classes?.map((c) => (
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
                              classCode: c.class_code,
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
            </DialogHeader>
            <ClassFields form={editForm} setForm={setEditForm} teachers={teachers ?? []} />
            <DialogFooter>
              <Button type="submit" disabled={busy}>
                Salvar
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
            <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
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
        <Label>Código da turma</Label>
        <Input
          required
          placeholder="5A-2026"
          value={form.classCode}
          onChange={(e) => setForm({ ...form, classCode: e.target.value.toUpperCase() })}
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
    </div>
  );
}
