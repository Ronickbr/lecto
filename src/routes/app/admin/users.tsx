import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { PageHeader, StatCard } from "@/components/admin/stat-card";
import { useAdminSchools } from "@/lib/admin/queries";
import { shortDate, num } from "@/lib/admin/format";
import { Search } from "lucide-react";

export const Route = createFileRoute("/app/admin/users")({
  head: () => ({ meta: [{ title: "Usuários globais — Super Admin | Lecto" }] }),
  component: UsersPage,
});

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  school_admin: "Admin escolar",
  teacher: "Professor",
  student: "Aluno",
};

function UsersPage() {
  const { data: schools } = useAdminSchools();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");

  const { data } = useQuery({
    queryKey: ["admin-global-users"],
    queryFn: async () => {
      const [roles, profiles, teachers, students] = await Promise.all([
        supabase.from("user_roles").select("user_id, role, school_id, created_at"),
        supabase.from("profiles").select("id, full_name, email, created_at"),
        supabase.from("teachers").select("user_id, full_name, email, school_id, created_at"),
        supabase.from("students").select("id, full_name, school_id, created_at, user_id"),
      ]);
      return {
        roles: roles.data ?? [],
        profiles: profiles.data ?? [],
        teachers: teachers.data ?? [],
        students: students.data ?? [],
      };
    },
  });

  const schoolName = useMemo(() => new Map((schools ?? []).map((s) => [s.id, s.name])), [schools]);

  const users = useMemo(() => {
    if (!data) return [];
    const identity = new Map<string, { name: string; email: string; created_at: string }>();
    data.profiles.forEach((p) =>
      identity.set(p.id, {
        name: p.full_name ?? "—",
        email: p.email ?? "—",
        created_at: p.created_at,
      }),
    );
    data.teachers.forEach((t) => {
      if (!t.user_id) return;
      const existing = identity.get(t.user_id);
      if (!existing || existing.name === "—" || existing.email === "—") {
        identity.set(t.user_id, {
          name: existing && existing.name !== "—" ? existing.name : t.full_name,
          email: existing && existing.email !== "—" ? existing.email : t.email,
          created_at: existing?.created_at ?? t.created_at,
        });
      }
    });
    data.students.forEach((s) => {
      if (!s.user_id) return;
      if (!identity.has(s.user_id)) {
        identity.set(s.user_id, {
          name: s.full_name,
          email: "—",
          created_at: s.created_at,
        });
      }
    });
    const staff = data.roles.map((r) => {
      const id = identity.get(r.user_id);
      return {
        key: `${r.user_id}-${r.role}`,
        name: id?.name ?? "—",
        email: id?.email ?? "—",
        role: r.role as string,
        school: r.school_id ? (schoolName.get(r.school_id) ?? "—") : "Plataforma",
        created_at: id?.created_at ?? r.created_at,
      };
    });
    const studentRows = data.students
      .filter((s) => !s.user_id)
      .map((s) => ({
        key: `st-${s.id}`,
        name: s.full_name,
        email: "—",
        role: "student",
        school: schoolName.get(s.school_id) ?? "—",
        created_at: s.created_at,
      }));
    return [...staff, ...studentRows].sort((a, b) => b.created_at.localeCompare(a.created_at));
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
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Escola</TableHead>
                <TableHead>Desde</TableHead>
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
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
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
    </div>
  );
}
