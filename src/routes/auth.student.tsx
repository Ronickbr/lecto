import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { studentSignInFn } from "@/lib/students.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpenText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/student")({
  head: () => ({
    meta: [
      { title: "Aluno — Entrar com código da turma | Lecto" },
      {
        name: "description",
        content: "Acesso do aluno usando código da turma, código pessoal e PIN.",
      },
      { property: "og:title", content: "Aluno — Entrar | Lecto" },
      { property: "og:description", content: "Login rápido do aluno." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentAuth,
});

function StudentAuth() {
  const navigate = useNavigate();
  const signIn = useServerFn(studentSignInFn);
  const [loading, setLoading] = useState(false);
  const [classCode, setClassCode] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [pin, setPin] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await signIn({
        data: { classCode: classCode.trim().toUpperCase(), studentCode: studentCode.trim(), pin },
      });
      const { error } = await supabase.auth.signInWithPassword({
        email: res.email,
        password: res.password,
      });
      if (error) throw error;
      toast.success(`Olá, ${res.fullName}!`);
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no login");
    } finally {
      setLoading(false);
    }
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
            <CardTitle className="font-display text-xl sm:text-2xl">Entrar como aluno</CardTitle>
            <CardDescription>Peça os dados ao seu professor.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="classCode">Código da turma</Label>
                <Input
                  id="classCode"
                  placeholder="Ex.: 5A-2026"
                  required
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="studentCode">Seu código de aluno</Label>
                <Input
                  id="studentCode"
                  placeholder="Ex.: A017"
                  required
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pin">PIN</Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="4 a 6 dígitos"
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                Entrar
              </Button>
            </form>

            <div className="mt-6 border-t border-border pt-4 text-center text-sm">
              <Link to="/auth" className="text-primary hover:underline">
                Sou professor / escola
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
