import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { createStudentFn } from "@/lib/students.functions";
import {
  updateStudentFn,
  resetStudentPinFn,
  deleteStudentFn,
  bulkImportStudentsFn,
} from "@/lib/manage.functions";
import { getPlanUsageFn } from "@/lib/plan-limits.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  KeyRound,
  Trash2,
  Search,
  Download,
  Upload,
} from "lucide-react";
import { showError, toast } from "@/lib/errors/feedback";

export const Route = createFileRoute("/app/school/students")({
  head: () => ({
    meta: [
      { title: "Alunos | Lecto" },
      {
        name: "description",
        content: "Cadastre, importe, edite e gerencie as credenciais de acesso dos alunos.",
      },
    ],
  }),
  component: StudentsPage,
});

interface StudentRow {
  id: string;
  full_name: string;
  student_code: string;
  class_id: string | null;
  created_at: string;
  class: { name: string; class_code: string } | null;
}

const emptyForm = {
  fullName: "",
  studentCode: "",
  pin: "",
  classId: "",
  birthDate: "",
  guardianEmail: "",
  guardianPhone: "",
};

function StudentsPage() {
  const { data: user } = useCurrentUser();
  const schoolId = user?.schoolId;
  const isTeacherOnly = user?.primaryRole === "teacher";
  const qc = useQueryClient();
  const createStudent = useServerFn(createStudentFn);
  const getPlanUsage = useServerFn(getPlanUsageFn);
  const updateStudent = useServerFn(updateStudentFn);
  const resetPin = useServerFn(resetStudentPinFn);
  const deleteStudent = useServerFn(deleteStudentFn);
  const bulkImport = useServerFn(bulkImportStudentsFn);

  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [form, setForm] = useState(emptyForm);
  const [tForm, setTForm] = useState<Record<string, boolean>>({});
  const [eForm, setEForm] = useState<Record<string, string | null>>({});
  const [csv, setCsv] = useState("");
  const [importClass, setImportClass] = useState("");
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [pinTarget, setPinTarget] = useState<StudentRow | null>(null);
  const [newPin, setNewPin] = useState("");
  const [removing, setRemoving] = useState<StudentRow | null>(null);

  const { data: students, isLoading } = useQuery({
    queryKey: ["students", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select(
          "id, full_name, student_code, class_id, created_at, class:classes(name, class_code)",
        )
        .eq("school_id", schoolId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as StudentRow[];
    },
  });

  const { data: classes } = useQuery({
    queryKey: ["classes-select", schoolId, isTeacherOnly, user?.userId],
    enabled: !!schoolId,
    queryFn: async () => {
      if (isTeacherOnly) {
        const { data: teacher } = await supabase
          .from("teachers")
          .select("id")
          .eq("user_id", user!.userId)
          .eq("school_id", schoolId!)
          .maybeSingle();
        if (!teacher) return [];
        const { data } = await supabase
          .from("classes")
          .select("id, name, class_code")
          .eq("school_id", schoolId!)
          .eq("teacher_id", teacher.id);
        return data ?? [];
      }
      const { data } = await supabase
        .from("classes")
        .select("id, name, class_code")
        .eq("school_id", schoolId!);
      return data ?? [];
    },
  });

  const { data: planUsage } = useQuery({
    queryKey: ["plan-usage", schoolId],
    enabled: !!schoolId,
    queryFn: async () => getPlanUsage({ data: { schoolId: schoolId! } }),
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const myClassIds = new Set((classes ?? []).map((c) => c.id));
    const scoped = isTeacherOnly
      ? (students ?? []).filter((s) => s.class_id && myClassIds.has(s.class_id))
      : (students ?? []);
    return scoped.filter((s) => {
      const matchTerm =
        !term ||
        s.full_name.toLowerCase().includes(term) ||
        s.student_code.toLowerCase().includes(term);
      const matchClass =
        classFilter === "all" ||
        (classFilter === "none" ? !s.class_id : s.class_id === classFilter);
      return matchTerm && matchClass;
    });
  }, [students, q, classFilter, classes, isTeacherOnly]);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["students", schoolId] });
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
    const errors: Record<string, string | null> = {};
    if (!form.fullName.trim()) errors.fullName = "Informe o nome completo do aluno";
    else if (form.fullName.trim().split(/\s+/).length < 2)
      errors.fullName = "Informe nome e sobrenome";
    if (!form.studentCode.trim()) errors.studentCode = "Informe o código do aluno";
    if (!form.pin) errors.pin = "Informe o PIN de acesso";
    else if (!/^\d+$/.test(form.pin)) errors.pin = "PIN deve conter apenas dígitos (0-9)";
    else if (form.pin.length < 4) errors.pin = "PIN deve ter pelo menos 4 dígitos";
    else if (form.pin.length > 10) errors.pin = "PIN deve ter no máximo 10 dígitos";
    if (isTeacherOnly && !form.classId) errors.classId = "Selecione a turma do aluno";
    if (form.guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.guardianEmail))
      errors.guardianEmail = "E-mail do responsável inválido";
    setEForm(errors);
    setTForm({
      fullName: true,
      studentCode: true,
      pin: true,
      classId: true,
      guardianEmail: true,
    });
    if (Object.values(errors).some(Boolean)) {
      showError("Verifique os campos destacados antes de continuar.");
      return;
    }
    const ok = await run(
      () =>
        createStudent({
          data: {
            schoolId,
            classId: form.classId || null,
            fullName: form.fullName,
            studentCode: form.studentCode,
            pin: form.pin,
            birthDate: form.birthDate || null,
            guardianEmail: form.guardianEmail || null,
            guardianPhone: form.guardianPhone || null,
          },
        }),
      "Aluno cadastrado",
    );
    if (ok) {
      setOpen(false);
      setForm(emptyForm);
      setTForm({});
      setEForm({});
      setQ("");
    }
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId) return;
    const rows = csv
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [fullName, studentCode, pin] = line.split(/[;,]/).map((c) => c.trim());
        return { fullName, studentCode, pin };
      })
      .filter((r) => r.fullName && r.studentCode && r.pin && r.pin.length >= 4);
    if (!rows.length) return showError("Nenhuma linha válida. Use: Nome, Código, PIN");

    setBusy(true);
    try {
      const res = (await bulkImport({
        data: { schoolId, classId: importClass || null, rows },
      })) as { created: number; errors: string[] };
      toast.success(`${res.created} aluno(s) importado(s)`);
      if (res.errors.length)
        showError(`${res.errors.length} falha(s): ${res.errors.slice(0, 3).join("; ")}`);
      refresh();
      setImportOpen(false);
      setCsv("");
      setImportClass("");
    } catch (err) {
      showError(err, { fallback: "Falha na importação" });
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const rows = [
      ["Nome", "Código", "Turma"],
      ...filtered.map((s) => [s.full_name, s.student_code, s.class?.name ?? ""]),
    ];
    const content = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "alunos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Alunos</h1>
          <p className="text-muted-foreground">
            {isTeacherOnly
              ? "Cadastre e gerencie os alunos das suas turmas."
              : "Cadastro, turmas e credenciais de acesso dos alunos."}
          </p>
          {planUsage && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <Badge
                variant="outline"
                className={
                  planUsage.maxStudents && planUsage.students >= planUsage.maxStudents
                    ? "border-destructive text-destructive"
                    : ""
                }
              >
                {planUsage.students}
                {planUsage.maxStudents != null ? ` de ${planUsage.maxStudents}` : ""}
                {" alunos"}
                {planUsage.planName ? ` · Plano ${planUsage.planName}` : ""}
              </Badge>
              {planUsage.maxSimuladosMonth != null && (
                <Badge variant="outline">
                  Simulados este mês: {planUsage.simuladosMonth ?? 0}/{planUsage.maxSimuladosMonth}
                </Badge>
              )}
              {planUsage.maxStudents != null && planUsage.students >= planUsage.maxStudents && (
                <span className="font-medium text-destructive">
                  Limite atingido — remova alunos ou eleve o plano.
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="mr-2 size-4" /> Exportar
          </Button>
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 size-4" /> Importar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleImport} className="space-y-4">
                <DialogHeader>
                  <DialogTitle>Importar alunos</DialogTitle>
                  <DialogDescription>
                    Uma linha por aluno no formato: Nome completo, Código, PIN
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label>Turma de destino</Label>
                  <Select value={importClass} onValueChange={setImportClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sem turma" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} · {c.class_code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Dados</Label>
                  <Textarea
                    rows={8}
                    placeholder={"Ana Souza, A001, 1234\nBruno Lima, A002, 4321"}
                    value={csv}
                    onChange={(e) => setCsv(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={busy}>
                    Importar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 size-4" /> Novo aluno
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate} className="space-y-4" noValidate>
                <DialogHeader>
                  <DialogTitle>Novo aluno</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-2">
                    <Label>Nome completo</Label>
                    <Input
                      required
                      value={form.fullName}
                      className={
                        tForm.fullName && eForm.fullName
                          ? "border-destructive ring-1 ring-destructive/40 focus-visible:ring-destructive"
                          : ""
                      }
                      onBlur={() => {
                        setTForm((t) => ({ ...t, fullName: true }));
                        setEForm((e) => ({
                          ...e,
                          fullName: !form.fullName.trim()
                            ? "Informe o nome completo do aluno"
                            : form.fullName.trim().split(/\s+/).length < 2
                              ? "Informe nome e sobrenome"
                              : null,
                        }));
                      }}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    />
                    {tForm.fullName && eForm.fullName && (
                      <p className="text-xs font-medium text-destructive">{eForm.fullName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Código do aluno</Label>
                    <Input
                      required
                      placeholder="A017"
                      value={form.studentCode}
                      className={
                        tForm.studentCode && eForm.studentCode
                          ? "border-destructive ring-1 ring-destructive/40 focus-visible:ring-destructive"
                          : ""
                      }
                      onBlur={() => {
                        setTForm((t) => ({ ...t, studentCode: true }));
                        setEForm((e) => ({
                          ...e,
                          studentCode: !form.studentCode.trim()
                            ? "Informe o código do aluno"
                            : null,
                        }));
                      }}
                      onChange={(e) => setForm({ ...form, studentCode: e.target.value })}
                    />
                    {tForm.studentCode && eForm.studentCode && (
                      <p className="text-xs font-medium text-destructive">{eForm.studentCode}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>PIN (4-6 dígitos)</Label>
                    <Input
                      required
                      minLength={4}
                      maxLength={10}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={form.pin}
                      className={
                        tForm.pin && eForm.pin
                          ? "border-destructive ring-1 ring-destructive/40 focus-visible:ring-destructive"
                          : ""
                      }
                      onBlur={() => {
                        setTForm((t) => ({ ...t, pin: true }));
                        setEForm((e) => ({
                          ...e,
                          pin: !form.pin
                            ? "Informe o PIN de acesso"
                            : !/^\d+$/.test(form.pin)
                              ? "PIN deve conter apenas dígitos (0-9)"
                              : form.pin.length < 4
                                ? "PIN deve ter pelo menos 4 dígitos"
                                : form.pin.length > 10
                                  ? "PIN deve ter no máximo 10 dígitos"
                                  : null,
                        }));
                      }}
                      onChange={(e) =>
                        setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 10) })
                      }
                    />
                    {tForm.pin && eForm.pin && (
                      <p className="text-xs font-medium text-destructive">{eForm.pin}</p>
                    )}
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Turma</Label>
                    <Select
                      required={isTeacherOnly}
                      value={form.classId}
                      onValueChange={(v) => {
                        setForm({ ...form, classId: v });
                        setTForm((t) => ({ ...t, classId: true }));
                        setEForm((e) => ({
                          ...e,
                          classId: isTeacherOnly && !v ? "Selecione a turma do aluno" : null,
                        }));
                      }}
                    >
                      <SelectTrigger
                        className={
                          tForm.classId && eForm.classId
                            ? "border-destructive ring-1 ring-destructive/40 focus-visible:ring-destructive"
                            : ""
                        }
                      >
                        <SelectValue placeholder="Selecione a turma" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} · {c.class_code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {tForm.classId && eForm.classId && (
                      <p className="text-xs font-medium text-destructive">{eForm.classId}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Nascimento</Label>
                    <Input
                      type="date"
                      value={form.birthDate}
                      onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone responsável</Label>
                    <Input
                      value={form.guardianPhone}
                      onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Email responsável</Label>
                    <Input
                      type="email"
                      value={form.guardianEmail}
                      className={
                        tForm.guardianEmail && eForm.guardianEmail
                          ? "border-destructive ring-1 ring-destructive/40 focus-visible:ring-destructive"
                          : ""
                      }
                      onBlur={() => {
                        setTForm((t) => ({ ...t, guardianEmail: true }));
                        setEForm((e) => ({
                          ...e,
                          guardianEmail:
                            form.guardianEmail &&
                            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.guardianEmail)
                              ? "E-mail do responsável inválido"
                              : null,
                        }));
                      }}
                      onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })}
                    />
                    {tForm.guardianEmail && eForm.guardianEmail && (
                      <p className="text-xs font-medium text-destructive">{eForm.guardianEmail}</p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={busy}>
                    Criar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9 pr-9"
            placeholder="Buscar por nome ou código"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Limpar busca"
              className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
              onClick={() => setQ("")}
            >
              <span aria-hidden className="text-lg leading-none">
                ×
              </span>
            </Button>
          )}
        </div>
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as turmas</SelectItem>
            <SelectItem value="none">Sem turma</SelectItem>
            {classes?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    Carregando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    Nenhum aluno encontrado.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.full_name}</TableCell>
                  <TableCell className="font-mono text-sm">{s.student_code}</TableCell>
                  <TableCell>{s.class?.name ?? "—"}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Ações para ${s.full_name}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(s);
                            setEditForm({
                              ...emptyForm,
                              fullName: s.full_name,
                              studentCode: s.student_code,
                              classId: s.class_id ?? "",
                            });
                          }}
                        >
                          <Pencil className="mr-2 size-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setPinTarget(s);
                            setNewPin("");
                          }}
                        >
                          <KeyRound className="mr-2 size-4" /> Redefinir PIN
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setRemoving(s)}
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
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!editing) return;
              const ok = await run(
                () =>
                  updateStudent({
                    data: {
                      studentId: editing.id,
                      fullName: editForm.fullName,
                      studentCode: editForm.studentCode,
                      classId: editForm.classId || null,
                      birthDate: editForm.birthDate || null,
                      guardianEmail: editForm.guardianEmail || null,
                      guardianPhone: editForm.guardianPhone || null,
                    },
                  }),
                "Aluno atualizado",
              );
              if (ok) setEditing(null);
            }}
          >
            <DialogHeader>
              <DialogTitle>Editar aluno</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-2">
                <Label>Nome completo</Label>
                <Input
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Código</Label>
                <Input
                  required
                  value={editForm.studentCode}
                  onChange={(e) => setEditForm({ ...editForm, studentCode: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Turma</Label>
                <Select
                  value={editForm.classId}
                  onValueChange={(v) => setEditForm({ ...editForm, classId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem turma" />
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
              <div className="space-y-2">
                <Label>Nascimento</Label>
                <Input
                  type="date"
                  value={editForm.birthDate}
                  onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone responsável</Label>
                <Input
                  value={editForm.guardianPhone}
                  onChange={(e) => setEditForm({ ...editForm, guardianPhone: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Email responsável</Label>
                <Input
                  type="email"
                  value={editForm.guardianEmail}
                  onChange={(e) => setEditForm({ ...editForm, guardianEmail: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pinTarget} onOpenChange={(v) => !v && setPinTarget(null)}>
        <DialogContent>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!pinTarget) return;
              const ok = await run(
                () => resetPin({ data: { studentId: pinTarget.id, pin: newPin } }),
                "PIN redefinido",
              );
              if (ok) setPinTarget(null);
            }}
          >
            <DialogHeader>
              <DialogTitle>Redefinir PIN de {pinTarget?.full_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Novo PIN</Label>
              <Input
                required
                minLength={4}
                maxLength={10}
                inputMode="numeric"
                pattern="[0-9]*"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy}>
                Redefinir
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(v) => !v && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {removing?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              O acesso e as credenciais do aluno serão excluídos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!removing) return;
                await run(
                  () => deleteStudent({ data: { studentId: removing.id } }),
                  "Aluno removido",
                );
                setRemoving(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
