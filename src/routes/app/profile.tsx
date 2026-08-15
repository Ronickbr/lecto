import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/stat-card";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "sonner";
import { KeyRound, Save } from "lucide-react";

export const Route = createFileRoute("/app/profile")({
  head: () => ({ meta: [{ title: "Meu perfil | Lecto" }] }),
  component: ProfilePage,
});

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super administrador",
  school_admin: "Administrador escolar",
  teacher: "Professor",
  student: "Aluno",
};

function ProfilePage() {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me?.profile?.full_name) setFullName(me.profile.full_name);
  }, [me?.profile?.full_name]);

  async function save() {
    if (!me) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone: phone || null })
      .eq("id", me.userId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
    qc.invalidateQueries({ queryKey: ["current-user"] });
  }

  async function resetPassword() {
    if (!me?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(me.email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) return toast.error(error.message);
    toast.success("Enviamos um link de redefinição para o seu e-mail");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Meu perfil" description="Dados da sua conta na plataforma." />

      <Card className="rounded-2xl border-border/70 shadow-soft">
        <CardContent className="space-y-5 p-5">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary">
              {(fullName || me?.email || "?").slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium">{fullName || "Sem nome"}</p>
              <p className="truncate text-sm text-muted-foreground">{me?.email ?? "—"}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {(me?.roles ?? []).map((r) => (
                  <Badge key={r} variant="secondary" className="rounded-lg">
                    {ROLE_LABEL[r] ?? r}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nome completo</Label>
              <Input
                className="rounded-xl"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                className="rounded-xl"
                placeholder="(00) 00000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input className="rounded-xl" value={me?.email ?? ""} disabled />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button className="rounded-xl" onClick={save} disabled={busy}>
              <Save className="size-4" /> Salvar
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={resetPassword}>
              <KeyRound className="size-4" /> Alterar senha
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
