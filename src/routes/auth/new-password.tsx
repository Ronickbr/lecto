import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const NewPasswordPage = () => {
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const passwordRules = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,}$/;

  const validatePassword = () => {
    if (!passwordRules.test(newPassword)) {
      setError(
        "A senha deve ter pelo menos 6 caracteres, incluindo uma letra maiúscula e um número",
      );
      return false;
    }
    if (newPassword !== confirmPassword) {
      setError("As senhas não correspondem");
      return false;
    }
    setError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePassword()) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha redefinida com sucesso! Faça login agora.");
      window.location.href = "/auth";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao redefinir senha";
      toast.error(message);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold">Redefinir Senha</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-4 text-red-600">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="mb-1 block text-sm font-medium">
                Nova Senha
              </label>
              <Input
                type="password"
                id="new-password"
                placeholder="Digite uma nova senha"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium">
                Confirmar Nova Senha
              </label>
              <Input
                type="password"
                id="confirm-password"
                placeholder="Confirme sua nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="size-4 mx-auto animate-spin" /> : "Redefinir Senha"}
            </Button>
            <div className="mt-4 text-center">
              <a href="/auth/recovery" className="text-sm text-primary">
                Voltar à recuperação
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewPasswordPage;

export const Route = createFileRoute("/auth/new-password")({
  component: NewPasswordPage,
});
