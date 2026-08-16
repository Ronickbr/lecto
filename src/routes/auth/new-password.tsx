import { useLocation, LinkOutlet } from "@tanstack/react-router";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const NewPasswordPage = () => {
  const location = useLocation();
  const { iveToken } = location.state ?? {};
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);

  const passwordRules = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,}$/;

  const validatePassword = () => {
    if (!passwordRules.test(newPassword)) {
      setError("A senha deve ter pelo menos 6 caracteres, incluindo uma letra maiúscula e um número");
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
      const { error } = await supabase.auth.resetPassword(iveToken, {
        new_password: newPassword,
        options: { daysUntilExpiry: 7 },
      });
      if (error) throw error;
      toast.success("Senha redefinida com sucesso! Faça login agora.");
      // Redirecionar para página de login após sucesso
      // window.location.href = "/auth";
    } catch (err) {
      toast.error(err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!iveToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Link inválido</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Não foi possível processar a solicitação de redefinição de senha.</p>
          <LinkOutlet to="/" className="text-primary">
            Voltar para a página de login
          </LinkOutlet>
        </CardContent>
      </Card>
    );
  }

  if (!verified) {
    return (
      <div className="card flex min-h-screen items-center justify-center bg-surface px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Verificando código...</CardTitle>
          </CardHeader>
          <CardContent>
            <Loader2 className="size-6 flex mx-auto animate-spin text-primary" />
            <p className="text-sm text-muted-foreground mt-2">
              Por favor, aguarde enquanto validamos seu token de recuperação...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card className="shadow-none min-h-screen flex items-center justify-center bg-surface">
      <CardContent className="w-full max-w-md">
        <h1 className="mb-6 text-center text-2xl font-bold">Redefinir Senha</h1>
        {error && <p className="mb-4 text-red-600">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="password"
              id="new-password"
              label="Nova Senha"
              placeholder="Digite uma nova senha"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={loading}
            />
            <Input
              type="password"
              id="confirm-password"
              label="Confirmar Nova Senha"
              placeholder="Confirme sua nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <Loader2 className="size-4 flex mx-auto animate-spin" />
            ) : (
              "Redefinir Senha"
            )}
          </Button>
          <div className="mt-4 text-center">
            <Link to="/auth/recovery" className="text-sm text-primary">
              Voltar à recuperação
            </Link>
          </div>
      </CardContent>
    </Card>
  );
};

export default NewPasswordPage;