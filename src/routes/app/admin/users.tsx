import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { PageHeader, StatCard } from "@/components/admin/stat-card";
import { useAdminSchools } from "@/lib/admin/queries";
import {
  listGlobalUsersFn,
  deleteGlobalUserFn,
  type GlobalUserRow,
} from "@/lib/admin/global-users.functions";
import { shortDate, num } from "@/lib/admin/format";
import { showError, toast } from "@/lib/errors/feedback";
import { Search, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/app/admin/users")({
  head: () => ({ meta: [{ title: "Usuários globais — Super Admin | Lecto" }] }),
  component: UsersPage,
});

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  school_admin: "Admin escolar",
  teacher: "Professor",
  student: "Aluno",
  no_role: "Sem papel",
};

type UserRow = {
  key: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  school: string;
  created_at: string;
};

function UsersPage() {
  const { data: schools } = useAdminSchools();
  const { data: currentUser } = useCurrentUser();
  const currentUserId = currentUser?.userId;

  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [toDelete, setToDelete] = useState<UserRow | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");

  const listGlobalUsers = useServerFn(listGlobalUsersFn);
  const deleteGlobalUser = useServerFn(deleteGlobalUserFn);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["admin-global-users"],
    queryFn: () => listGlobalUsers(),
  });

  const schoolName = useMemo(() => new Map((schools ?? []).map((s) => [s.id, s.name])), [schools]);

  const users = useMemo<UserRow[]>(() => {
    if (!data) return [];
    return data.map((u: GlobalUserRow) => ({
      key: `${u.userId}-${u.role}`,
      userId: u.userId,
      name: u.name ?? "—",
      email: u.email ?? "—",
      role: u.role,
      school: u.schoolId ? (schoolName.get(u.schoolId) ?? "—") : "Plataforma",
      created_at: u.createdAt,
    }));
  }, [data, schoolName]);

  const list = users.filter(
    (u) =>
      (role === "all" || u.role === role) &&
      [u.name, u.email, u.school].some((v) => v.toLowerCase().includes(q.trim().toLowerCase())),
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    users.forEach((u) => (c[u.role] = (c[u.role] ?? 0) + 1));
    return c;
  }, [users]);

  const deleteMutation = useMutation({
    mutationFn: (targetUserId: string) => deleteGlobalUser({ data: { targetUserId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-global-users"] });
      toast.success("Usuário deletado com sucesso.");
      setToDelete(null);
      setConfirmEmail("");
    },
    onError: (err: Error) => {
      showError(err);
    },
  });

  function openDeleteDialog(u: UserRow) {
    setConfirmEmail("");
    setToDelete(u);
  }

  function handleConfirmDelete() {
    if (!toDelete) return;
    if (confirmEmail.trim().toLowerCase() !== toDelete.email.toLowerCase()) {
      showError("O e-mail digitado não confere. Tente novamente.");
      return;
    }
    deleteMutation.mutate(toDelete.userId);
  }

  const canDelete = (u: UserRow) => u.userId !== currentUserId && u.role !== "super_admin";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="Usuários globais" description="Todos os perfis com acesso à plataforma." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Super admins" value={num(counts.super_admin ?? 0)} />
        <StatCard label="Admins escolares" value={num(counts.school_admin ?? 0)} />
        <StatCard label="Professores" value={num(counts.teacher ?? 0)} />
        <StatCard label="Alunos" value={num(counts.student ?? 0)} />
      </div>

      <Card className="rounded-2xl border-border/70 p-4 shadow-soft">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="rounded-xl pl-9"
              placeholder="Buscar por nome, e-mail ou escola…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os papéis</SelectItem>
              {Object.entries(ROLE_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-2xl border-border/70 shadow-soft">
        <div className="overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Escola</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead className="w-16 text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.slice(0, 100).map((u) => (
                <TableRow key={u.key}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="rounded-lg">
                      {ROLE_LABEL[u.role] ?? u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.school}</TableCell>
                  <TableCell className="text-muted-foreground">{shortDate(u.created_at)}</TableCell>
                  <TableCell className="text-center">
                    {canDelete(u) ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        title="Deletar usuário"
                        data-e2e="delete-user-btn"
                        onClick={() => openDeleteDialog(u)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        Precisa gerenciar usuários de uma escola específica? Abra a{" "}
        <Link to="/app/admin/schools" className="text-primary underline-offset-2 hover:underline">
          lista de escolas
        </Link>
        .
      </p>

      {/* Modal de confirmação de exclusão */}
      <Dialog
        open={!!toDelete}
        onOpenChange={(open) => {
          if (!open) {
            setToDelete(null);
            setConfirmEmail("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              Deletar usuário
            </DialogTitle>
            <DialogDescription>
              Esta ação é <strong>irreversível</strong>. O usuário perderá acesso imediatamente e
              todos os seus dados serão removidos da plataforma.
            </DialogDescription>
          </DialogHeader>

          {toDelete && (
            <div className="space-y-4 pt-1">
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <p className="font-medium">{toDelete.name}</p>
                <p className="text-muted-foreground">{toDelete.email}</p>
                <p className="mt-1 text-muted-foreground">
                  Papel:{" "}
                  <span className="font-medium text-foreground">
                    {ROLE_LABEL[toDelete.role] ?? toDelete.role}
                  </span>{" "}
                  · Escola: <span className="font-medium text-foreground">{toDelete.school}</span>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-email">Digite o e-mail do usuário para confirmar:</Label>
                <Input
                  id="confirm-email"
                  placeholder={toDelete.email}
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleConfirmDelete()}
                  autoComplete="off"
                  data-e2e="confirm-delete-email-input"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                setToDelete(null);
                setConfirmEmail("");
              }}
              disabled={deleteMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={
                deleteMutation.isPending ||
                confirmEmail.trim().toLowerCase() !== (toDelete?.email ?? "").toLowerCase()
              }
              data-e2e="confirm-delete-submit"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Deletar permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
