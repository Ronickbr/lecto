import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpenText, Loader2 } from "lucide-react";
import { showError, toast } from "@/lib/errors/feedback";

export const Route = createFileRoute("/auth/")({
  head: () => ({
    meta: [
      { title: "Entrar — Lecto" },
      {
        name: "description",
        content:
          "Acesse sua conta institucional Lecto para gerenciar escolas, turmas, alunos e simulados.",
      },
      { property: "og:title", content: "Entrar — Lecto" },
      { property: "og:description", content: "Acesso institucional." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

  // Sign in
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return showError("Preencha todos os campos");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) return showError(error);
    toast.success("Login realizado");
    navigate({ to: "/app" });
  }

  // Sign up
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || !fullName) return showError("Preencha todos os campos");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) return showError(error);
    toast.success("Conta criada — faça login");
  }

  // Verificar sessão
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) navigate({ to: "/app" });
      else setCheckingSession(false);
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (checkingSession) {
    return (
      <div
        className="grid min-h-screen place-items-center bg-surface"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="sr-only">Verificando sessão</span>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-surface px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 text-foreground">
          <div className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <BookOpenText className="size-4" />
          </div>
          <span className="font-display text-xl">Lecto</span>
        </Link>

        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle className="font-display text-xl sm:text-2xl">Acesso institucional</CardTitle>
            <CardDescription>Administradores, escolas e professores.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    Entrar
                  </Button>
                  <div className="mt-4 text-center">
                    <Link to="/auth/recovery" className="text-sm text-primary hover:underline">
                      Esqueci minha senha
                    </Link>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome completo</Label>
                    <Input
                      id="name"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email2">Email</Label>
                    <Input
                      id="email2"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password2">Senha</Label>
                    <Input
                      id="password2"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    Criar conta
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    O primeiro usuário registrado se torna administrador geral automaticamente.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
