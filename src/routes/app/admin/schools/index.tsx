import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createSchoolFn } from "@/lib/staff.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Download, ArrowUpDown } from "lucide-react";
import { showError, toast } from "@/lib/errors/feedback";
import { PageHeader } from "@/components/admin/stat-card";
import { HealthBadge, PlanBadge, StatusBadge } from "@/components/admin/badges";
import { SchoolActions } from "@/components/admin/school-actions";
import { useAdminSchools, type SchoolRow } from "@/lib/admin/queries";
import { dateShort, num, relative, toCsv, downloadCsv } from "@/lib/admin/format";

type Search = { new?: boolean };

export const Route = createFileRoute("/app/admin/schools/")({
  head: () => ({ meta: [{ title: "Escolas — Super Admin | Lecto" }] }),
  validateSearch: (s: Record<string, unknown>): Search =>
    s.new === true || s.new === "true" ? { new: true } : {},
  component: SchoolsPage,
});

const PAGE_SIZE = 10;

function SchoolsPage() {
  const qc = useQueryClient();
  const navigate = Route.useNavigate();
  const { new: openNew } = Route.useSearch();
  const createSchool = useServerFn(createSchoolFn);
  const { data: schools, isLoading } = useAdminSchools();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");
  const [health, setHealth] = useState("all");
  const [sort, setSort] = useState<{ key: keyof SchoolRow; dir: "asc" | "desc" }>({
    key: "created_at",
    dir: "desc",
  });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);

  const { data: plans } = useQuery({
    queryKey: ["plans-select"],
    queryFn: async () => {
      const { data } = await supabase
        .from("plans")
        .select("id, name")
        .eq("active", true)
        .order("price_cents");
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    let list = schools ?? [];
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter((s) =>
        [s.name, s.slug, s.city, s.ownerEmail].some((v) => v?.toLowerCase().includes(term)),
      );
    }
    if (status !== "all") list = list.filter((s) => s.subscription_status === status);
    if (plan !== "all") list = list.filter((s) => s.plan_id === plan);
    if (health !== "all") list = list.filter((s) => s.health === health);
    return [...list].sort((a, b) => {
      const av = a[sort.key] ?? "";
      const bv = b[sort.key] ?? "";
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [schools, q, status, plan, health, sort]);

  const pageRows = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  const toggleSort = (key: keyof SchoolRow) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));

  async function bulkStatus(next: "active" | "suspended") {
    const { error } = await supabase
      .from("schools")
      .update({ subscription_status: next })
      .in("id", selected);
    if (error) return showError(error);
    toast.success(`${selected.length} escola(s) atualizada(s)`);
    setSelected([]);
    qc.invalidateQueries({ queryKey: ["admin-schools-full"] });
  }

  function exportCsv() {
    downloadCsv(
      "escolas-lecto.csv",
      toCsv(rows, [
        { key: "name", label: "Escola" },
        { key: "slug", label: "Slug" },
        { key: "city", label: "Cidade" },
        { key: "state", label: "UF" },
        { key: "planName", label: "Plano" },
        { key: "subscription_status", label: "Status" },
        { key: "students", label: "Alunos" },
        { key: "teachers", label: "Professores" },
        { key: "simulados", label: "Simulados" },
        { key: "created_at", label: "Criada em" },
      ]),
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Escolas"
        description={`${num(rows.length)} instituição(ões) encontradas`}
        actions={
          <>
            <Button variant="outline" className="rounded-xl" onClick={exportCsv}>
              <Download className="size-4" /> Exportar CSV
            </Button>
            <Button className="rounded-xl" onClick={() => navigate({ search: { new: true } })}>
              <Plus className="size-4" /> Nova escola
            </Button>
          </>
        }
      />

      <Card className="rounded-2xl border-border/70 p-4 shadow-soft">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="rounded-xl pl-9"
              placeholder="Buscar por nome, slug, cidade…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="active">Ativa</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="suspended">Suspensa</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={plan}
            onValueChange={(v) => {
              setPlan(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os planos</SelectItem>
              {(plans ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={health}
            onValueChange={(v) => {
              setHealth(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Saúde" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda a saúde</SelectItem>
              <SelectItem value="healthy">Saudável</SelectItem>
              <SelectItem value="low">Uso baixo</SelectItem>
              <SelectItem value="inactive">Inativa</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selected.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-sm">
            <span className="font-medium">{selected.length} selecionada(s)</span>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto rounded-lg"
              onClick={() => bulkStatus("active")}
            >
              Reativar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg"
              onClick={() => bulkStatus("suspended")}
            >
              Suspender
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-lg"
              onClick={() => setSelected([])}
            >
              Limpar
            </Button>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden rounded-2xl border-border/70 shadow-soft">
        <div className="overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-10">
                  <Checkbox
                    checked={pageRows.length > 0 && pageRows.every((r) => selected.includes(r.id))}
                    onCheckedChange={(v) =>
                      setSelected(
                        v ? [...new Set([...selected, ...pageRows.map((r) => r.id)])] : [],
                      )
                    }
                    aria-label="Selecionar todas"
                  />
                </TableHead>
                <TableHead>
                  <button
                    className="inline-flex items-center gap-1"
                    onClick={() => toggleSort("name")}
                  >
                    Escola <ArrowUpDown className="size-3" />
                  </button>
                </TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <button
                    className="inline-flex items-center gap-1"
                    onClick={() => toggleSort("students")}
                  >
                    Alunos <ArrowUpDown className="size-3" />
                  </button>
                </TableHead>
                <TableHead className="text-right">Professores</TableHead>
                <TableHead className="text-right">Simulados</TableHead>
                <TableHead>Último acesso</TableHead>
                <TableHead>Saúde</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={11}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!isLoading && pageRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="py-14 text-center">
                    <p className="text-sm font-medium">Nenhuma escola encontrada</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ajuste os filtros ou cadastre uma nova instituição.
                    </p>
                    <Button
                      className="mt-4 rounded-xl"
                      onClick={() => navigate({ search: { new: true } })}
                    >
                      <Plus className="size-4" /> Nova escola
                    </Button>
                  </TableCell>
                </TableRow>
              )}
              {pageRows.map((s) => (
                <TableRow key={s.id} className="group">
                  <TableCell>
                    <Checkbox
                      checked={selected.includes(s.id)}
                      onCheckedChange={(v) =>
                        setSelected(v ? [...selected, s.id] : selected.filter((x) => x !== s.id))
                      }
                      aria-label={`Selecionar ${s.name}`}
                    />
                  </TableCell>
                  <TableCell className="min-w-0">
                    <Link
                      to="/app/admin/schools/$id"
                      params={{ id: s.id }}
                      className="flex min-w-0 items-center gap-3"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-xs font-semibold text-primary">
                        {s.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium group-hover:text-primary">
                          {s.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[s.city, s.state].filter(Boolean).join("/") || s.slug}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <PlanBadge tier={s.planTier} name={s.planName} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={s.subscription_status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{num(s.students)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(s.teachers)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(s.simulados)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {relative(s.lastAccess)}
                  </TableCell>
                  <TableCell>
                    <HealthBadge health={s.health} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {dateShort(s.created_at)}
                  </TableCell>
                  <TableCell>
                    <SchoolActions school={s} plans={plans ?? []} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-3 text-sm text-muted-foreground">
          <span>
            Página {page + 1} de {pages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={page >= pages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={!!openNew} onOpenChange={(v) => navigate({ search: v ? { new: true } : {} })}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <NewSchoolForm
            onSubmit={async (v) => {
              try {
                await createSchool({ data: v });
                toast.success("Escola criada com sucesso");
                navigate({ search: {} });
                qc.invalidateQueries({ queryKey: ["admin-schools-full"] });
              } catch (e) {
                showError(e, { fallback: "Falha ao criar" });
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewSchoolForm({
  onSubmit,
}: {
  onSubmit: (v: {
    name: string;
    slug: string;
    city: string;
    state: string;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
  }) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    city: "",
    state: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  function validateField(key: string, value: string | null): string | null {
    switch (key) {
      case "name":
        if (!value || !value.trim()) return "Informe o nome da escola";
        if (value.trim().length < 3) return "Nome deve ter pelo menos 3 caracteres";
        return null;
      case "slug":
        if (!value || !value.trim()) return "Informe o slug (URL amigável)";
        if (!/^[-a-z0-9]+$/.test(value)) return "Use apenas letras minúsculas, números e hífen";
        if (value.length < 3) return "Slug deve ter pelo menos 3 caracteres";
        return null;
      case "city":
        if (!value || !value.trim()) return "Informe a cidade";
        return null;
      case "state":
        if (!value || !value.trim()) return "Informe a UF";
        if (!/^[A-Z]{2}$/.test(value)) return "UF deve ter 2 letras maiúsculas";
        return null;
      case "adminName":
        if (!value || !value.trim()) return "Informe o nome do administrador";
        if (value.trim().split(/\s+/).length < 2) return "Informe nome e sobrenome";
        return null;
      case "adminEmail":
        if (!value || !value.trim()) return "Informe o e-mail do administrador";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "E-mail inválido";
        return null;
      case "adminPassword":
        if (!value) return "Informe a senha temporária";
        if (value.length < 6) return "Senha deve ter pelo menos 6 caracteres";
        return null;
      default:
        return null;
    }
  }

  function validateAll(): boolean {
    const next: Record<string, string | null> = {};
    const keys: (keyof typeof form)[] = [
      "name",
      "slug",
      "city",
      "state",
      "adminName",
      "adminEmail",
      "adminPassword",
    ];
    for (const k of keys) next[k] = validateField(k, String(form[k] ?? ""));
    setErrors(next);
    setTouched(Object.fromEntries(keys.map((k) => [k, true])));
    return Object.values(next).every((v) => !v);
  }

  function fieldClass(key: string) {
    const has = touched[key] && errors[key];
    return `rounded-xl ${has ? "border-destructive ring-1 ring-destructive/40 focus-visible:ring-destructive" : ""}`;
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!validateAll()) {
          showError("Verifique os campos destacados antes de continuar.");
          return;
        }
        setBusy(true);
        try {
          await onSubmit(form);
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-4"
      noValidate
    >
      <DialogHeader>
        <DialogTitle>Nova escola</DialogTitle>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-2">
          <Label>Nome</Label>
          <Input
            required
            className={fieldClass("name")}
            value={form.name}
            onBlur={() => {
              setTouched((t) => ({ ...t, name: true }));
              setErrors((e) => ({ ...e, name: validateField("name", form.name) }));
            }}
            onChange={(e) =>
              setForm({
                ...form,
                name: e.target.value,
                slug:
                  form.slug ||
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, ""),
              })
            }
          />
          {touched.name && errors.name && (
            <p className="text-xs font-medium text-destructive">{errors.name}</p>
          )}
        </div>
        <div className="col-span-2 space-y-2">
          <Label>Slug (URL amigável)</Label>
          <Input
            required
            pattern="[-a-z0-9]+"
            className={fieldClass("slug")}
            placeholder="colegio-exemplo"
            value={form.slug}
            onBlur={() => {
              setTouched((t) => ({ ...t, slug: true }));
              setErrors((e) => ({ ...e, slug: validateField("slug", form.slug) }));
            }}
            onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
          />
          {touched.slug && errors.slug && (
            <p className="text-xs font-medium text-destructive">{errors.slug}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Cidade</Label>
          <Input
            className={fieldClass("city")}
            value={form.city}
            onBlur={() => {
              setTouched((t) => ({ ...t, city: true }));
              setErrors((e) => ({ ...e, city: validateField("city", form.city) }));
            }}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
          {touched.city && errors.city && (
            <p className="text-xs font-medium text-destructive">{errors.city}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>UF</Label>
          <Input
            maxLength={2}
            className={fieldClass("state")}
            value={form.state}
            onBlur={() => {
              setTouched((t) => ({ ...t, state: true }));
              setErrors((e) => ({ ...e, state: validateField("state", form.state) }));
            }}
            onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
          />
          {touched.state && errors.state && (
            <p className="text-xs font-medium text-destructive">{errors.state}</p>
          )}
        </div>
        <div className="col-span-2 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-sm">
          <p className="font-medium text-amber-700 dark:text-amber-400">
            Toda nova escola começa no plano Trial
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            1 professor, 25 alunos e até 5 simulados por mês. O plano pode ser alterado depois pela
            aba <span className="font-medium">Assinatura</span> no painel da escola.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 p-3">
        <p className="mb-3 text-sm font-medium">Administrador da escola</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-2">
            <Label>Nome</Label>
            <Input
              required
              className={fieldClass("adminName")}
              value={form.adminName}
              onBlur={() => {
                setTouched((t) => ({ ...t, adminName: true }));
                setErrors((e) => ({ ...e, adminName: validateField("adminName", form.adminName) }));
              }}
              onChange={(e) => setForm({ ...form, adminName: e.target.value })}
            />
            {touched.adminName && errors.adminName && (
              <p className="text-xs font-medium text-destructive">{errors.adminName}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input
              type="email"
              required
              className={fieldClass("adminEmail")}
              value={form.adminEmail}
              onBlur={() => {
                setTouched((t) => ({ ...t, adminEmail: true }));
                setErrors((e) => ({
                  ...e,
                  adminEmail: validateField("adminEmail", form.adminEmail),
                }));
              }}
              onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
            />
            {touched.adminEmail && errors.adminEmail && (
              <p className="text-xs font-medium text-destructive">{errors.adminEmail}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Senha temporária</Label>
            <Input
              required
              minLength={6}
              className={fieldClass("adminPassword")}
              value={form.adminPassword}
              onBlur={() => {
                setTouched((t) => ({ ...t, adminPassword: true }));
                setErrors((e) => ({
                  ...e,
                  adminPassword: validateField("adminPassword", form.adminPassword),
                }));
              }}
              onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
            />
            {touched.adminPassword && errors.adminPassword && (
              <p className="text-xs font-medium text-destructive">{errors.adminPassword}</p>
            )}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" className="rounded-xl" disabled={busy}>
          Criar escola
        </Button>
      </DialogFooter>
    </form>
  );
}
