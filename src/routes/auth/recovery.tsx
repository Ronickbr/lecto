import { useState } from "react";
import { useNavigate, createFileRoute } from "@tanstack/react-router";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const RecoveryPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error("Informe seu email");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      toast.success("Código enviado! Verifique seu email.");
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar código de recuperação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold">Recuperar Senha</CardTitle>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center">
              <p className="mb-4">
                Código enviado para <strong>{email}</strong>.
              </p>
              <p className="text-sm text-muted-foreground">
                Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
              </p>
              <Button
                type="button"
                size="lg"
                className="mt-4"
                onClick={() => navigate({ to: "/auth" })}
              >
                Voltar à página de login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium">
                  Email
                </label>
                <Input
                  type="email"
                  id="email"
                  placeholder="Digite seu email institucional"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="size-4 mx-auto animate-spin" />
                ) : (
                  "Enviar Link de Recuperação"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="mt-4 w-full"
                onClick={() => navigate({ to: "/auth" })}
              >
                Voltar à página de login
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RecoveryPage;

export const Route = createFileRoute("/auth/recovery")({
  component: RecoveryPage,
});
