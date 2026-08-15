import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/admin/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brl, TIER_LABEL } from "@/lib/admin/format";
import { toast } from "sonner";
import { Save } from "lucide-react";

export const Route = createFileRoute("/app/admin/settings")({
  head: () => ({ meta: [{ title: "Configurações — Super Admin | Lecto" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const [prefs, setPrefs] = useState(() => ({
    trialDays: 14,
    notifyNewSchool: true,
    notifyChurn: true,
    weeklyDigest: false,
  }));

  const { data: plans } = useQuery({
    queryKey: ["settings-plans"],
    queryFn: async () => (await supabase.from("plans").select("*").order("price_cents")).data ?? [],
  });

  async function togglePlan(id: string, active: boolean) {
    const { error } = await supabase.from("plans").update({ active }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(active ? "Plano ativado" : "Plano desativado");
    qc.invalidateQueries({ queryKey: ["settings-plans"] });
    qc.invalidateQueries({ queryKey: ["plans-select"] });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Configurações da plataforma"
        description="Preferências globais do super administrador."
      />

      <Card className="rounded-2xl border-border/70 shadow-soft">
        <CardContent className="space-y-5 p-5">
          <h3 className="text-sm font-semibold">Operação</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Duração padrão do trial (dias)</Label>
              <Input
                type="number"
                min={1}
                className="rounded-xl"
                value={prefs.trialDays}
                onChange={(e) => setPrefs({ ...prefs, trialDays: Number(e.target.value) })}
              />
            </div>
          </div>

          <Separator />

          <h3 className="text-sm font-semibold">Notificações</h3>
          {[
            {
              key: "notifyNewSchool" as const,
              label: "Avisar quando uma nova escola for cadastrada",
            },
            {
              key: "notifyChurn" as const,
              label: "Avisar quando uma escola cancelar ou ficar inativa",
            },
            { key: "weeklyDigest" as const, label: "Resumo semanal de métricas por e-mail" },
          ].map((row) => (
            <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
              <span className="min-w-0 text-sm">{row.label}</span>
              <Switch
                checked={prefs[row.key]}
                onCheckedChange={(v) => setPrefs({ ...prefs, [row.key]: v })}
              />
            </div>
          ))}

          <Button
            className="rounded-xl"
            onClick={() => toast.success("Preferências salvas nesta sessão")}
          >
            <Save className="size-4" /> Salvar preferências
          </Button>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-2xl border-border/70 shadow-soft">
        <div className="border-b border-border/60 px-4 py-3 text-sm font-semibold">
          Catálogo de planos
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Plano</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Limites</TableHead>
                <TableHead className="text-right">Ativo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(plans ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">{TIER_LABEL[p.tier]}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(p.price_cents)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {p.max_teachers} prof · {p.max_students} alunos · {p.max_simulados_month}/mês
                  </TableCell>
                  <TableCell className="text-right">
                    <Switch checked={p.active} onCheckedChange={(v) => togglePlan(p.id, v)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
