import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Check, Edit, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/plans")({
  head: () => ({ meta: [{ title: "Planos — Admin | Lecto" }] }),
  component: PlansPage,
});

type Plan = {
  id: string;
  name: string;
  tier: string;
  price_cents: number;
  max_schools: number;
  max_teachers: number;
  max_students: number;
  max_simulados_month: number;
  features: string[];
  active: boolean;
};

function PlansPage() {
  const queryClient = useQueryClient();
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").order("price_cents");
      if (error) throw error;
      // Garante desduplicação por tier para evitar cards duplicados caso a base possua seeds repetidos
      const unique = new Map<string, Plan>();
      data?.forEach((p) => {
        if (!unique.has(p.tier)) {
          unique.set(p.tier, p as unknown as Plan);
        }
      });
      return Array.from(unique.values());
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updated: Plan) => {
      const { error } = await supabase
        .from("plans")
        .update({
          name: updated.name,
          price_cents: updated.price_cents,
          max_teachers: updated.max_teachers,
          max_students: updated.max_students,
          max_simulados_month: updated.max_simulados_month,
        })
        .eq("id", updated.id);

      if (error) throw error;
    },
    onMutate: async (updated: Plan) => {
      await queryClient.cancelQueries({ queryKey: ["admin-plans"] });
      const previous = queryClient.getQueryData<Plan[]>(["admin-plans"]);
      queryClient.setQueryData<Plan[]>(["admin-plans"], (old) =>
        (old ?? []).map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
      );
      return { previous };
    },
    onError: (err: Error, _updated, context) => {
      if (context?.previous) queryClient.setQueryData(["admin-plans"], context.previous);
      toast.error(`Erro ao atualizar plano: ${err.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      toast.success("Plano atualizado com sucesso!");
      setEditingPlan(null);
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Planos</h1>
          <p className="text-muted-foreground">Catálogo de assinaturas oferecido às escolas.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans?.map((p) => (
            <Card key={p.id} className="relative shadow-soft">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-xl sm:text-2xl">{p.name}</CardTitle>
                  <Badge variant="outline">{p.tier}</Badge>
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="font-display text-3xl sm:text-4xl">
                    R$ {(p.price_cents / 100).toFixed(0)}
                  </span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                  <div>
                    <strong className="text-foreground">{p.max_teachers}</strong> professores
                  </div>
                  <div>
                    <strong className="text-foreground">{p.max_students}</strong> alunos
                  </div>
                  <div className="col-span-2">
                    <strong className="text-foreground">{p.max_simulados_month}</strong>{" "}
                    simulados/mês
                  </div>
                </div>

                <ul className="space-y-1.5 pt-2">
                  {[
                    `${p.max_schools} ${p.max_schools === 1 ? "escola" : "escolas"}`,
                    `${p.max_teachers} professores`,
                    `${p.max_students} alunos`,
                    `${p.max_simulados_month} simulados/mês`,
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 mt-4"
                  onClick={() => setEditingPlan(p)}
                >
                  <Edit className="size-4" />
                  Editar Plano
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Edição de Plano */}
      <Dialog open={!!editingPlan} onOpenChange={(open) => !open && setEditingPlan(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Plano — {editingPlan?.name}</DialogTitle>
          </DialogHeader>

          {editingPlan && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate(editingPlan);
              }}
              className="space-y-4 pt-2"
            >
              <div className="space-y-1.5">
                <Label htmlFor="plan-name">Nome do Plano</Label>
                <Input
                  id="plan-name"
                  value={editingPlan.name}
                  onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="plan-price">Preço Mensal (R$)</Label>
                <Input
                  id="plan-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={(editingPlan.price_cents / 100).toString()}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setEditingPlan({ ...editingPlan, price_cents: Math.round(val * 100) });
                  }}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="plan-teachers">Professores</Label>
                  <Input
                    id="plan-teachers"
                    type="number"
                    min="1"
                    value={editingPlan.max_teachers}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        max_teachers: parseInt(e.target.value) || 0,
                      })
                    }
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="plan-students">Alunos</Label>
                  <Input
                    id="plan-students"
                    type="number"
                    min="1"
                    value={editingPlan.max_students}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        max_students: parseInt(e.target.value) || 0,
                      })
                    }
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="plan-simulados">Simulados/mês</Label>
                  <Input
                    id="plan-simulados"
                    type="number"
                    min="1"
                    value={editingPlan.max_simulados_month}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        max_simulados_month: parseInt(e.target.value) || 0,
                      })
                    }
                    required
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditingPlan(null)}
                  disabled={updateMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Salvar Alterações
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
