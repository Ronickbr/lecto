import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { createTeacherFn } from "@/lib/staff.functions";
import { updateTeacherFn, resetTeacherPasswordFn, deleteTeacherFn } from "@/lib/manage.functions";
import { getPlanUsageFn } from "@/lib/plan-limits.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, MoreHorizontal, Pencil, KeyRound, Trash2, Search, Download } from "lucide-react";
import { showError, toast } from "@/lib/errors/feedback";

export const Route = createFileRoute("/app/school/teachers")({
  head: () => ({
    meta: [
      { title: "Professores | Lecto" },
      {
        name: "description",
        content: "Cadastre, edite e gerencie o acesso da equipe docente da sua escola.",
      },
    ],
  }),
  component: TeachersPage,
});

interface TeacherRow {
  id: string;
  full_name: string;
  email: string;
  subjects: string[] | null;
  created_at: string;
}

const ROLES = ["Diretor", "Diretor auxiliar", "Pedagogo (a)", "Professor R1", "Professor R2"];

function TeachersPage() {
  const { data: user } = useCurrentUser();
  const schoolId = user?.schoolId;
  const qc = useQueryClient();
  const createTeacher = useServerFn(createTeacherFn);
  const getPlanUsage = useServerFn(getPlanUsageFn);
  const updateTeacher = useServerFn(updateTeacherFn);
  const resetPassword = useServerFn(resetTeacherPasswordFn);
  const deleteTeacher = useServerFn(deleteTeacherFn);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ fullName: "", email: "", password: "", subjects: "" });
  const [tForm, setTForm] = useState<Record<string, boolean>>({});
  const [eForm, setEForm] = useState<Record<string, string | null>>({});
  const [editing, setEditing] = useState<TeacherRow | null>(null);
  const [editForm, setEditForm] = useState({ fullName: "", subjects: "" });
  const [pwTarget, setPwTarget] = useState<TeacherRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [removing, setRemoving] = useState<TeacherRow | null>(null);

  const { data: teachers, isLoading } = useQuery({
    queryKey: ["teachers", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teachers")
        .select("id, full_name, email, subjects, created_at")
        .eq("school_id", schoolId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TeacherRow[];
    },
  });

  const { data: planUsage } = useQuery({
    queryKey: ["plan-usage", schoolId],
    enabled: !!schoolId,
    queryFn: async () => getPlanUsage({ data: { schoolId: schoolId! } }),
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return teachers ?? [];
    return (teachers ?? []).filter(
      (t) =>
        t.full_name.toLowerCase().includes(term) ||
        t.email.toLowerCase().includes(term) ||
        (t.subjects ?? []).some((s) => s.toLowerCase().includes(term)),
    );
  }, [teachers, q]);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["teachers", schoolId] });
    qc.invalidateQueries({ queryKey: ["teachers-select", schoolId] });
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
    if (!form.fullName.trim()) errors.fullName = "Informe o nome completo";
    else if (form.fullName.trim().split(/\s+/).length < 2)
      errors.fullName = "Informe nome e sobrenome";
    if (!form.email.trim()) errors.email = "Informe o e-mail";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = "E-mail inválido";
    if (!form.password) errors.password = "Informe a senha temporária";
    else if (form.password.length < 6) errors.password = "Senha deve ter pelo menos 6 caracteres";
    if (!form.subjects) errors.subjects = "Selecione o cargo ou disciplina";
    setEForm(errors);
    setTForm({ fullName: true, email: true, password: true, subjects: true });
    if (Object.values(errors).some(Boolean)) {
      showError("Verifique os campos destacados antes de continuar.");
      return;
    }
    const ok = await run(
      () =>
        createTeacher({
          data: {
            schoolId,
            fullName: form.fullName,
            email: form.email,
            password: form.password,
            subjects: [form.subjects],
          },
        }),
      "Professor criado",
    );
    if (ok) {
      setOpen(false);
      setForm({ fullName: "", email: "", password: "", subjects: "" });
      setQ("");
      setTForm({});
      setEForm({});
    }
  }

  function exportCsv() {
    const rows = [
      ["Nome", "Email", "Disciplinas"],
      ...filtered.map((t) => [t.full_name, t.email, (t.subjects ?? []).join(" | ")]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "professores.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Profissionais</h1>
          <p className="text-muted-foreground">
            Cadastre primeiramente a Diretoria, Pedagogos e Professores antes de prosseguir com
            turmas e alunos.
          </p>
          {planUsage && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <Badge
                variant="outline"
                className={
                  planUsage.maxTeachers && planUsage.teachers >= planUsage.maxTeachers
                    ? "border-destructive text-destructive"
                    : ""
                }
              >
                {planUsage.teachers}
                {planUsage.maxTeachers != null ? ` de ${planUsage.maxTeachers}` : ""}
                {" professores"}
                {planUsage.planName ? ` · Plano ${planUsage.planName}` : ""}
              </Badge>
              {planUsage.maxTeachers != null && planUsage.teachers >= planUsage.maxTeachers && (
                <span className="font-medium text-destructive">
                  Limite atingido — remova usuários ou eleve o plano.
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="mr-2 size-4" /> Exportar
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 size-4" /> Novo profissional
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate} className="space-y-4" noValidate>
                <DialogHeader>
                  <DialogTitle>Novo profissional</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
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
                          ? "Informe o nome completo"
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
                  <Label>Email</Label>
                  <Input
                    type="email"
                    required
                    value={form.email}
                    className={
                      tForm.email && eForm.email
                        ? "border-destructive ring-1 ring-destructive/40 focus-visible:ring-destructive"
                        : ""
                    }
                    onBlur={() => {
                      setTForm((t) => ({ ...t, email: true }));
                      setEForm((e) => ({
                        ...e,
                        email: !form.email.trim()
                          ? "Informe o e-mail"
                          : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
                            ? "E-mail inválido"
                            : null,
                      }));
                    }}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                  {tForm.email && eForm.email && (
                    <p className="text-xs font-medium text-destructive">{eForm.email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Senha temporária</Label>
                  <Input
                    required
                    minLength={6}
                    value={form.password}
                    className={
                      tForm.password && eForm.password
                        ? "border-destructive ring-1 ring-destructive/40 focus-visible:ring-destructive"
                        : ""
                    }
                    onBlur={() => {
                      setTForm((t) => ({ ...t, password: true }));
                      setEForm((e) => ({
                        ...e,
                        password: !form.password
                          ? "Informe a senha temporária"
                          : form.password.length < 6
                            ? "Senha deve ter pelo menos 6 caracteres"
                            : null,
                      }));
                    }}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                  {tForm.password && eForm.password && (
                    <p className="text-xs font-medium text-destructive">{eForm.password}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Cargo / Disciplina</Label>
                  <Select
                    value={form.subjects}
                    onValueChange={(v) => {
                      setForm({ ...form, subjects: v });
                      setTForm((t) => ({ ...t, subjects: true }));
                      setEForm((e) => ({
                        ...e,
                        subjects: v ? null : "Selecione o cargo ou disciplina",
                      }));
                    }}
                  >
                    <SelectTrigger
                      className={
                        tForm.subjects && eForm.subjects
                          ? "border-destructive ring-1 ring-destructive/40 focus-visible:ring-destructive"
                          : ""
                      }
                    >
                      <SelectValue placeholder="Selecione o cargo ou disciplina" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {tForm.subjects && eForm.subjects && (
                    <p className="text-xs font-medium text-destructive">{eForm.subjects}</p>
                  )}
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
            placeholder="Buscar por nome, email ou disciplina"
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
        <Badge variant="secondary">
          {(filtered ?? []).length} de {(teachers ?? []).length} profissional(is)
        </Badge>
      </div>

      <Card className="overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Disciplinas</TableHead>
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
                    Nenhum professor encontrado.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{t.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(t.subjects ?? []).length === 0 && (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {(t.subjects ?? []).map((s) => (
                        <Badge key={s} variant="secondary">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Ações para ${t.full_name}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(t);
                            setEditForm({
                              fullName: t.full_name,
                              subjects: (t.subjects ?? []).join(", "),
                            });
                          }}
                        >
                          <Pencil className="mr-2 size-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setPwTarget(t);
                            setNewPassword("");
                          }}
                        >
                          <KeyRound className="mr-2 size-4" /> Redefinir senha
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setRemoving(t)}
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

      {/* Editar */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!editing) return;
              const ok = await run(
                () =>
                  updateTeacher({
                    data: {
                      teacherId: editing.id,
                      fullName: editForm.fullName,
                      subjects: [editForm.subjects],
                    },
                  }),
                "Professor atualizado",
              );
              if (ok) setEditing(null);
            }}
          >
            <DialogHeader>
              <DialogTitle>Editar professor</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input
                required
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Cargo / Disciplina</Label>
              <Select
                value={editForm.subjects}
                onValueChange={(v) => setEditForm({ ...editForm, subjects: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cargo ou disciplina" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Redefinir senha */}
      <Dialog open={!!pwTarget} onOpenChange={(v) => !v && setPwTarget(null)}>
        <DialogContent>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!pwTarget) return;
              const ok = await run(
                () => resetPassword({ data: { teacherId: pwTarget.id, password: newPassword } }),
                "Senha redefinida",
              );
              if (ok) setPwTarget(null);
            }}
          >
            <DialogHeader>
              <DialogTitle>Redefinir senha de {pwTarget?.full_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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

      {/* Remover */}
      <AlertDialog open={!!removing} onOpenChange={(v) => !v && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {removing?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              O acesso do professor será excluído e as turmas vinculadas ficarão sem responsável.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!removing) return;
                await run(
                  () => deleteTeacher({ data: { teacherId: removing.id } }),
                  "Professor removido",
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
