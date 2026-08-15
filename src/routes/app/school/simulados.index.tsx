import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/school/simulados/")({
  head: () => ({ meta: [{ title: "Simulados | Lecto" }] }),
  component: SimuladosPage,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};

function SimuladosPage() {
  const { data: user } = useCurrentUser();
  const schoolId = user?.schoolId;
  const canEdit = user?.primaryRole === "school_admin" || user?.primaryRole === "teacher";
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: simulados, isLoading } = useQuery({
    queryKey: ["simulados", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simulados")
        .select("*, classes(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
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
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Simulados</h1>
          <p className="text-muted-foreground">
            Monte simulados PIRLS com páginas, textos e questões.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Novo simulado
          </Button>
        )}
      </div>

      <Card className="shadow-soft">
        <CardHeader className="pb-3" />
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead>Tempo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="mx-auto size-4 animate-spin" />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && simulados?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum simulado ainda.
                  </TableCell>
                </TableRow>
              )}
              {simulados?.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.title}</TableCell>
                  <TableCell className="text-muted-foreground">{s.classes?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.time_limit_minutes} min
                  </TableCell>
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
    mutationFn: async () => {
      const { error } = await supabase.from("simulados").insert({
        school_id: schoolId,
        title: form.title,
        description: form.description || null,
        class_id: form.class_id || null,
        time_limit_minutes: form.time_limit_minutes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Simulado criado");
      qc.invalidateQueries({ queryKey: ["simulados"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
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
