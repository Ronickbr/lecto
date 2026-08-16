import { useNavigate, Link } from "@tanstack/react-router";
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
    setLoading(true);
    try {
      const { error } = await supabase.auth.requestMagicLink(email);
      if (error) throw error;
      toast.success("Código enviado! Verifique seu email.");
      setSent(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-none min-h-screen flex items-center justify-center bg-surface">
      <CardContent className="w-full max-w-md">
        <h1 className="mb-6 text-center text-2xl font-bold">Recuperar Senha</h1>
        {sent ? (
          <div className="text-center">
            <p className="mb-4">Código enviado para <strong>{email}</strong>.</p>
            <p className="text-sm text-muted-foreground">
              Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
            </p>
            <Link to="/auth" className="mt-4 inline-block text-primary hover:underline">
              Voltar à página de login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              id="email"
              label="Email"
              placeholder="Digite seu email institucional"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="size-4 flex mx-auto animate-spin" />
              ) : (
                "Recuperar Senha"
              )}
            </Button>
            <div className="mt-4 text-center">
              <Link to="/auth" className="text-sm text-primary">
                Voltar à página de login
              </Link>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default RecoveryPage;