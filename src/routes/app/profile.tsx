import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Separator,
} from "@/components/ui";
import { PageHeader } from "@/components/admin/stat-card";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "sonner";
import { Camera, KeyRound, Loader2, LogOut, Save, Send } from "lucide-react";

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

const AVATARS_BUCKET = "avatars";
const PASSWORD_RULES = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,}$/;

function ProfilePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useCurrentUser();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwSent, setPwSent] = useState(false);
  const [mailBusy, setMailBusy] = useState(false);

  useEffect(() => {
    if (me?.profile?.full_name) setFullName(me.profile.full_name);
    if (me?.profile?.phone) setPhone(me.profile.phone);
  }, [me?.profile?.full_name, me?.profile?.phone]);

  useEffect(() => {
    let active = true;
    const path = me?.profile?.avatar_url;
    if (!path) {
      setAvatarUrl(null);
      return;
    }
    supabase.storage
      .from(AVATARS_BUCKET)
      .createSignedUrl(path, 60 * 60)
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data?.signedUrl) setAvatarUrl(null);
        else setAvatarUrl(data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [me?.profile?.avatar_url]);

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

  async function uploadAvatar(file: File) {
    if (!me) return;
    if (!file.type.startsWith("image/")) return toast.error("Selecione um arquivo de imagem");
    if (file.size > 2 * 1024 * 1024) return toast.error("A imagem deve ter no máximo 2 MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${me.userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("id", me.userId);
      if (dbErr) throw dbErr;
      toast.success("Foto de perfil atualizada");
      qc.invalidateQueries({ queryKey: ["current-user"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar imagem");
    } finally {
      setUploading(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!me?.email) return toast.error("Não foi possível identificar seu e-mail");
    if (!PASSWORD_RULES.test(newPassword)) {
      return toast.error(
        "A senha deve ter pelo menos 6 caracteres, incluindo uma letra maiúscula e um número",
      );
    }
    if (newPassword !== confirmPassword) return toast.error("As senhas não coincidem");
    setPwBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha alterada com sucesso");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar senha");
    } finally {
      setPwBusy(false);
    }
  }

  async function sendRecoveryMail() {
    if (!me?.email) return toast.error("Não foi possível identificar seu e-mail");
    setMailBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(me.email, {
      redirectTo: `${window.location.origin}/auth/new-password`,
    });
    setMailBusy(false);
    if (error) return toast.error(error.message);
    setPwSent(true);
    toast.success("Enviamos um link de redefinição para o seu e-mail");
  }

  async function signOut() {
    try {
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
    } catch (err) {
      console.error("signOut", err);
    } finally {
      navigate({ to: "/auth", replace: true });
    }
  }

  const initials = (fullName || me?.email || "?").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Meu perfil" description="Dados da sua conta na plataforma." />

      <Card className="rounded-2xl border-border/70 shadow-soft">
        <CardContent className="space-y-5 p-5">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group relative shrink-0 cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="Alterar foto de perfil"
              disabled={uploading}
            >
              <Avatar className="size-16">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName || "Avatar"} />}
                <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="absolute inset-0 grid place-items-center rounded-full bg-black/0 text-white transition-colors group-hover:bg-black/40">
                {uploading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Camera className="size-5 opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadAvatar(file);
                e.target.value = "";
              }}
            />
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
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 shadow-soft">
        <CardHeader className="p-5 pb-0">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <KeyRound className="size-4 text-primary" /> Alterar senha
          </CardTitle>
          <CardDescription>
            Defina uma nova senha para a sua conta. Use letra maiúscula e número (mínimo 6
            caracteres).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <form onSubmit={changePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Senha atual</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                className="rounded-xl"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  className="rounded-xl"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  className="rounded-xl"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" className="rounded-xl" disabled={pwBusy}>
                {pwBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <KeyRound className="size-4" />
                )}
                Alterar senha
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={sendRecoveryMail}
                disabled={mailBusy}
              >
                {mailBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                {pwSent ? "Link reenviado" : "Enviar link por e-mail"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 shadow-soft">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">Sessão</p>
              <p className="text-sm text-muted-foreground">
                Encerrar a sessão atual neste dispositivo.
              </p>
            </div>
            <Button variant="outline" className="rounded-xl" onClick={signOut}>
              <LogOut className="size-4" /> Sair da conta
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
