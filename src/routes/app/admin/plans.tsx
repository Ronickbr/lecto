import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

export const Route = createFileRoute("/app/admin/plans")({
  head: () => ({ meta: [{ title: "Planos — Admin | Lecto" }] }),
  component: PlansPage,
});

function PlansPage() {
  const { data: plans } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").order("price_cents");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl">Planos</h1>
        <p className="text-muted-foreground">Catálogo de assinaturas oferecido às escolas.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans?.map((p) => (
          <Card key={p.id} className="shadow-soft">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-display text-xl sm:text-2xl">{p.name}</CardTitle>
                <Badge variant="outline">{p.tier}</Badge>
              </div>
              <div className="mt-2">
                <span className="font-display text-3xl sm:text-4xl">
                  R$ {(p.price_cents / 100).toFixed(0)}
                </span>
                <span className="text-muted-foreground">/mês</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <div>
                  <strong className="text-foreground">{p.max_teachers}</strong> professores
                </div>
                <div>
                  <strong className="text-foreground">{p.max_students}</strong> alunos
                </div>
                <div className="col-span-2">
                  <strong className="text-foreground">{p.max_simulados_month}</strong> simulados/mês
                </div>
              </div>
              <ul className="space-y-1.5 pt-2">
                {(p.features as string[]).map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
