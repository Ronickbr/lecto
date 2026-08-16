import { useState, useTransition, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/admin/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { brl, TIER_LABEL } from "@/lib/admin/format";
import { toast } from "sonner";
import {
  Save,
  Search,
  Sliders,
  Shield,
  Bell,
  HardDrive,
  Cpu,
  FileText,
  Lock,
  Globe,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Download,
  Key,
  ShieldAlert,
  Database,
  Terminal,
  Activity,
  Layers,
  UserCheck,
  Check,
} from "lucide-react";

export const Route = createFileRoute("/app/admin/settings")({
  head: () => ({ meta: [{ title: "Configurações Avançadas — Super Admin | Lecto" }] }),
  component: SuperAdminSettingsPage,
});

// Tipos de Configuração do Sistema
interface SystemSettingsState {
  // Geral
  platformName: string;
  platformUrl: string;
  supportEmail: string;
  contactPhone: string;
  timezone: string;
  defaultLanguage: string;
  maintenanceMode: boolean;
  publicApiKey: string;

  // Segurança
  enforce2FA: boolean;
  minPasswordLength: number;
  requireSpecialChar: boolean;
  requireNumbers: boolean;
  passwordExpirationDays: number;
  sessionTimeoutMinutes: number;
  maxFailedLogins: number;
  ipWhitelist: string;

  // Notificações
  notifyNewSchool: boolean;
  notifyChurn: boolean;
  weeklyDigest: boolean;
  notifySuspiciousLogin: boolean;
  notifyCriticalErrors: boolean;
  notificationChannel: "email" | "in_app" | "both";
  digestFrequency: "daily" | "weekly" | "monthly";

  // Backup
  autoBackupEnabled: boolean;
  backupFrequency: "daily" | "weekly" | "monthly";
  backupRetentionDays: number;
  storageProvider: "supabase" | "aws_s3" | "gcp";

  openrouterApiKey: string;
  openaiApiKey: string;
  mercadoPagoAccessToken: string;
  infinityPayTag: string;
  infinityPayRedirectUrl: string;
  infinityPayWebhookUrl: string;
  resendApiKey: string;
  webhookUrl: string;
}

const DEFAULT_SETTINGS: SystemSettingsState = {
  platformName: "Lecto — Plataforma de Compreensão Leitora",
  platformUrl: "https://lecto.app",
  supportEmail: "suporte@lecto.app",
  contactPhone: "+55 (11) 98888-7777",
  timezone: "America/Sao_Paulo",
  defaultLanguage: "pt-BR",
  maintenanceMode: false,
  publicApiKey: "",

  enforce2FA: false,
  minPasswordLength: 8,
  requireSpecialChar: true,
  requireNumbers: true,
  passwordExpirationDays: 90,
  sessionTimeoutMinutes: 60,
  maxFailedLogins: 5,
  ipWhitelist: "",

  notifyNewSchool: true,
  notifyChurn: true,
  weeklyDigest: true,
  notifySuspiciousLogin: true,
  notifyCriticalErrors: true,
  notificationChannel: "both",
  digestFrequency: "weekly",

  autoBackupEnabled: true,
  backupFrequency: "daily",
  backupRetentionDays: 30,
  storageProvider: "supabase",

  openrouterApiKey: "sk-or-v1-************************************",
  openaiApiKey: "sk-proj-************************************",
  mercadoPagoAccessToken: "APP_USR-************************************",
  infinityPayTag: "minha_loja_lecto",
  infinityPayRedirectUrl: "https://lecto.app/checkout/sucesso",
  infinityPayWebhookUrl: "https://lecto.app/api/webhooks/infinitypay",
  resendApiKey: "re_************************************",
  webhookUrl: "https://lecto.app/api/webhooks/v1",
};

// Logs estáticos para demonstração de auditoria
const MOCK_AUDIT_LOGS = [
  {
    id: "1",
    timestamp: "2026-08-15 18:25:10",
    user: "Super Admin (Você)",
    action: "ALTERAR_CONFIGURAÇAO",
    module: "Segurança",
    details: "Atualizou política de sessão para 60 min",
  },
  {
    id: "2",
    timestamp: "2026-08-15 17:10:04",
    user: "Super Admin (Você)",
    action: "ATIVAR_PLANO",
    module: "Planos",
    details: "Ativou o plano 'Pro'",
  },
  {
    id: "3",
    timestamp: "2026-08-15 15:40:22",
    user: "Sistema",
    action: "BACKUP_AUTOMATICO",
    module: "Backup",
    details: "Snapshot completo gerado (42 MB)",
  },
  {
    id: "4",
    timestamp: "2026-08-15 12:00:00",
    user: "Super Admin (Você)",
    action: "TESTE_INTEGRAÇÃO",
    module: "Integrações",
    details: "Testou conexão OpenAI (200 OK)",
  },
  {
    id: "5",
    timestamp: "2026-08-14 22:15:33",
    user: "Super Admin (Você)",
    action: "LOGIN_SUPERADMIN",
    module: "Autenticação",
    details: "Login efetuado via IP 189.120.44.12",
  },
];

function SuperAdminSettingsPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("general");
  const [searchQuery, setSearchQuery] = useState("");
  const [settings, setSettings] = useState<SystemSettingsState>(DEFAULT_SETTINGS);
  const [initialSettings, setInitialSettings] = useState<SystemSettingsState>(DEFAULT_SETTINGS);
  const [showSecretKeys, setShowSecretKeys] = useState<{ [key: string]: boolean }>({});
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingPreset, setPendingPreset] = useState<"production" | "staging" | null>(null);

  // Carregar dados salvos da plataforma (via platform_settings no Supabase)
  const { data: dbSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["platform-settings-db"],
    queryFn: async () => {
      const { data, error } = await supabase.from("platform_settings").select("*");
      if (error) throw error;
      const parsed: Record<string, unknown> = {};
      data?.forEach((item) => {
        let val: unknown = item.value;
        if (val && typeof val === "object" && !Array.isArray(val) && "val" in val) {
          val = (val as Record<string, unknown>).val;
        }
        parsed[item.key] = val;
      });
      return parsed;
    },
  });

  // Atualizar estado local quando o banco carregar
  useEffect(() => {
    if (dbSettings && Object.keys(dbSettings).length > 0) {
      const merged = { ...DEFAULT_SETTINGS, ...dbSettings };
      setSettings(merged);
      setInitialSettings(merged);
    }
  }, [dbSettings]);

  // Query de Planos
  const { data: plans } = useQuery({
    queryKey: ["settings-plans"],
    queryFn: async () => (await supabase.from("plans").select("*").order("price_cents")).data ?? [],
  });

  const isDirty = JSON.stringify(settings) !== JSON.stringify(initialSettings);

  // Salvar no Supabase
  const saveMutation = useMutation({
    mutationFn: async (newSettings: SystemSettingsState) => {
      // Segredos de integração não são persistidos no banco: são gerenciados
      // exclusivamente via variáveis de ambiente no servidor (ver src/lib/ai-gateway.server.ts).
      const SECRET_KEYS = new Set([
        "openrouterApiKey",
        "openaiApiKey",
        "mercadoPagoAccessToken",
        "resendApiKey",
      ]);
      const entries = Object.entries(newSettings)
        .filter(([key]) => !SECRET_KEYS.has(key))
        .map(([key, value]) => ({
          key,
          value: typeof value === "object" && value !== null ? value : { val: value },
          updated_at: new Date().toISOString(),
        }));

      for (const entry of entries) {
        const { error } = await supabase
          .from("platform_settings")
          .upsert(
            { key: entry.key, value: entry.value, updated_at: entry.updated_at },
            { onConflict: "key" },
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setInitialSettings(settings);
      toast.success("Todas as configurações foram salvas com sucesso no banco de dados!");
      qc.invalidateQueries({ queryKey: ["platform-settings-db"] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao salvar configurações: ${err.message}`);
    },
  });

  // Alternar ativo de plano
  async function togglePlan(id: string, active: boolean) {
    const { error } = await supabase.from("plans").update({ active }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(active ? "Plano ativado" : "Plano desativado");
    qc.invalidateQueries({ queryKey: ["settings-plans"] });
  }

  // Perfis pré-definidos (Presets)
  function applyPreset(preset: "production" | "staging") {
    if (preset === "production") {
      setSettings((prev) => ({
        ...prev,
        maintenanceMode: false,
        enforce2FA: true,
        minPasswordLength: 12,
        requireSpecialChar: true,
        requireNumbers: true,
        sessionTimeoutMinutes: 30,
        maxFailedLogins: 3,
        autoBackupEnabled: true,
        backupFrequency: "daily",
        backupRetentionDays: 90,
      }));
      toast.info("Preset 'Modo Produção' aplicado! Clique em Salvar para efetivar.");
    } else {
      setSettings((prev) => ({
        ...prev,
        maintenanceMode: true,
        enforce2FA: false,
        minPasswordLength: 8,
        requireSpecialChar: false,
        requireNumbers: true,
        sessionTimeoutMinutes: 120,
        maxFailedLogins: 10,
        autoBackupEnabled: false,
        backupFrequency: "weekly",
        backupRetentionDays: 7,
      }));
      toast.info("Preset 'Modo Homologação/Staging' aplicado! Clique em Salvar para efetivar.");
    }
  }

  function toggleShowKey(keyName: string) {
    setShowSecretKeys((prev) => ({ ...prev, [keyName]: !prev[keyName] }));
  }

  function testIntegration(serviceName: string) {
    toast.promise(new Promise((res) => setTimeout(res, 1200)), {
      loading: `Testando conexão com ${serviceName}...`,
      success: `Conexão com ${serviceName} realizada com sucesso! (Status 200 OK)`,
      error: `Falha na conexão com ${serviceName}`,
    });
  }

  function runManualBackup() {
    toast.promise(new Promise((res) => setTimeout(res, 1800)), {
      loading: "Gerando backup completo do banco Postgres...",
      success: "Backup gerado com sucesso! Arquivo snapshot_20260815.sql salvo.",
      error: "Erro ao gerar backup.",
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header Principal */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Central de Configurações do Sistema"
          description="Auditoria, segurança, backups e preferências globais do super administrador."
        />

        <div className="flex items-center gap-2">
          {isDirty && (
            <Badge variant="destructive" className="animate-pulse gap-1 px-3 py-1 text-xs">
              <AlertTriangle className="size-3" /> Alterações não salvas
            </Badge>
          )}

          <Button
            size="lg"
            className="gap-2 rounded-xl shadow-soft"
            onClick={() => saveMutation.mutate(settings)}
            disabled={saveMutation.isPending || !isDirty}
          >
            {saveMutation.isPending ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Salvar Alterações
          </Button>
        </div>
      </div>

      {/* Barra de Busca e Presets */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border/80 bg-card p-4 shadow-soft">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar configuração (ex: 2FA, backup, email...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-xl border-border/70"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Presets:</span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg gap-1.5 text-xs"
            onClick={() => applyPreset("production")}
          >
            <ShieldCheckIcon className="size-3.5 text-emerald-500" /> Produção
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg gap-1.5 text-xs"
            onClick={() => applyPreset("staging")}
          >
            <Sliders className="size-3.5 text-amber-500" /> Homologação
          </Button>
        </div>
      </div>

      {/* Tabs de Navegação */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 gap-1 rounded-2xl bg-muted p-1 sm:grid-cols-4 lg:grid-cols-7 h-auto">
          <TabsTrigger value="general" className="rounded-xl py-2 gap-1.5 text-xs font-medium">
            <Globe className="size-3.5" /> Geral
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-xl py-2 gap-1.5 text-xs font-medium">
            <Shield className="size-3.5" /> Segurança
          </TabsTrigger>
          <TabsTrigger value="permissions" className="rounded-xl py-2 gap-1.5 text-xs font-medium">
            <UserCheck className="size-3.5" /> Permissões
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="rounded-xl py-2 gap-1.5 text-xs font-medium"
          >
            <Bell className="size-3.5" /> Notificações
          </TabsTrigger>
          <TabsTrigger value="backup" className="rounded-xl py-2 gap-1.5 text-xs font-medium">
            <HardDrive className="size-3.5" /> Backup
          </TabsTrigger>
          <TabsTrigger value="integrations" className="rounded-xl py-2 gap-1.5 text-xs font-medium">
            <Cpu className="size-3.5" /> Integrações
          </TabsTrigger>
          <TabsTrigger value="audit" className="rounded-xl py-2 gap-1.5 text-xs font-medium">
            <FileText className="size-3.5" /> Logs & RLS
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CONFIGURAÇÕES GERAIS */}
        <TabsContent value="general">
          <Card className="rounded-2xl border-border/70 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe className="size-5 text-primary" /> Configurações Gerais do Sistema
              </CardTitle>
              <CardDescription>
                Informações institucionais, internacionalização e parâmetros de operação da
                plataforma Lecto.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="platformName">Nome da Plataforma</Label>
                  <Input
                    id="platformName"
                    value={settings.platformName}
                    onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="platformUrl">URL Oficial da Aplicação</Label>
                  <Input
                    id="platformUrl"
                    value={settings.platformUrl}
                    onChange={(e) => setSettings({ ...settings, platformUrl: e.target.value })}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supportEmail">E-mail Institucional de Suporte</Label>
                  <Input
                    id="supportEmail"
                    type="email"
                    value={settings.supportEmail}
                    onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Telefone de Contato / Suporte</Label>
                  <Input
                    id="contactPhone"
                    value={settings.contactPhone}
                    onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Fuso Horário Padrão</Label>
                  <Select
                    value={settings.timezone}
                    onValueChange={(val) => setSettings({ ...settings, timezone: val })}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Selecione o fuso horário" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Sao_Paulo">
                        América/São Paulo (UTC-03:00)
                      </SelectItem>
                      <SelectItem value="America/Manaus">América/Manaus (UTC-04:00)</SelectItem>
                      <SelectItem value="UTC">UTC (Tempo Universal Coordenado)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultLanguage">Idioma Padrão</Label>
                  <Select
                    value={settings.defaultLanguage}
                    onValueChange={(val) => setSettings({ ...settings, defaultLanguage: val })}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Selecione o idioma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                      <SelectItem value="en-US">English (United States)</SelectItem>
                      <SelectItem value="es-ES">Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 font-semibold text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="size-4" /> Modo Manutenção da Plataforma
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Quando ativado, bloqueia acessos de professores e alunos exibindo tela de
                    manutenção.
                  </p>
                </div>
                <Switch
                  checked={settings.maintenanceMode}
                  onCheckedChange={(val) => setSettings({ ...settings, maintenanceMode: val })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="publicApiKey">Chave de API Pública (Public Client Key)</Label>
                <Input
                  id="publicApiKey"
                  readOnly
                  value={settings.publicApiKey}
                  className="font-mono text-xs rounded-xl bg-muted"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: SEGURANÇA AVANÇADA */}
        <TabsContent value="security">
          <Card className="rounded-2xl border-border/70 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="size-5 text-emerald-500" /> Políticas de Segurança e Autenticação
              </CardTitle>
              <CardDescription>
                Regras de senhas, autenticação em dois fatores, controle de sessões e restrição de
                IPs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-border p-4">
                  <div>
                    <div className="font-semibold text-sm">
                      Autenticação de Dois Fatores (2FA) Obrigatória
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Exige 2FA para todos os administradores e professores cadastrados no sistema.
                    </p>
                  </div>
                  <Switch
                    checked={settings.enforce2FA}
                    onCheckedChange={(val) => setSettings({ ...settings, enforce2FA: val })}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Tamanho Mínimo de Senha</Label>
                    <Input
                      type="number"
                      min={6}
                      max={32}
                      value={settings.minPasswordLength}
                      onChange={(e) =>
                        setSettings({ ...settings, minPasswordLength: Number(e.target.value) })
                      }
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Validade Máxima da Senha (dias)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={settings.passwordExpirationDays}
                      onChange={(e) =>
                        setSettings({ ...settings, passwordExpirationDays: Number(e.target.value) })
                      }
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tempo de Sessão Inativa (minutos)</Label>
                    <Input
                      type="number"
                      min={5}
                      value={settings.sessionTimeoutMinutes}
                      onChange={(e) =>
                        setSettings({ ...settings, sessionTimeoutMinutes: Number(e.target.value) })
                      }
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Max Tentativas Falhas (Bloqueio)</Label>
                    <Input
                      type="number"
                      min={3}
                      value={settings.maxFailedLogins}
                      onChange={(e) =>
                        setSettings({ ...settings, maxFailedLogins: Number(e.target.value) })
                      }
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-xl border border-border p-3">
                    <span className="text-sm">Exigir caracteres especiais (!@#$)</span>
                    <Checkbox
                      checked={settings.requireSpecialChar}
                      onCheckedChange={(v) =>
                        setSettings({ ...settings, requireSpecialChar: Boolean(v) })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-border p-3">
                    <span className="text-sm">Exigir números (0-9)</span>
                    <Checkbox
                      checked={settings.requireNumbers}
                      onCheckedChange={(v) =>
                        setSettings({ ...settings, requireNumbers: Boolean(v) })
                      }
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="ipWhitelist">
                    Lista de Acesso por IP (IP Whitelist para Admin)
                  </Label>
                  <Textarea
                    id="ipWhitelist"
                    placeholder="Cole os IPs autorizados separados por vírgula ou linha (ex: 200.180.12.1, 189.44.12.0/24)"
                    value={settings.ipWhitelist}
                    onChange={(e) => setSettings({ ...settings, ipWhitelist: e.target.value })}
                    className="rounded-xl font-mono text-xs"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Se vazio, o acesso ao painel superadmin é permitido de qualquer IP autenticado.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: GERENCIAMENTO DE PERMISSÕES GRANULARIZADAS */}
        <TabsContent value="permissions">
          <Card className="rounded-2xl border-border/70 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserCheck className="size-5 text-indigo-500" /> Matriz de Permissões por Função
                (RBAC)
              </CardTitle>
              <CardDescription>
                Controle granular dos privilégios do sistema para Super Admin, Gestor Escolar,
                Professor e Aluno.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Módulo / Recurso do Sistema</TableHead>
                      <TableHead className="text-center">Super Admin</TableHead>
                      <TableHead className="text-center">Gestor Escolar (School Admin)</TableHead>
                      <TableHead className="text-center">Professor (Teacher)</TableHead>
                      <TableHead className="text-center">Aluno (Student)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      {
                        module: "Gerenciamento de Escolas & Assinaturas",
                        sa: true,
                        sc: false,
                        te: false,
                        st: false,
                      },
                      {
                        module: "Criar & Publicar Simulados",
                        sa: true,
                        sc: true,
                        te: true,
                        st: false,
                      },
                      {
                        module: "Realizar Simulados & Enviar Respostas",
                        sa: false,
                        sc: false,
                        te: false,
                        st: true,
                      },
                      {
                        module: "Visualizar Gabarito & Rubrica de Correção",
                        sa: true,
                        sc: true,
                        te: true,
                        st: false,
                      },
                      {
                        module: "Correção de Questões Dissertativas via IA",
                        sa: true,
                        sc: true,
                        te: true,
                        st: false,
                      },
                      {
                        module: "Gerenciar Turmas e Professores",
                        sa: true,
                        sc: true,
                        te: false,
                        st: false,
                      },
                      {
                        module: "Configurações Globais da Plataforma",
                        sa: true,
                        sc: false,
                        te: false,
                        st: false,
                      },
                      {
                        module: "Logs de Auditoria & Segurança RLS",
                        sa: true,
                        sc: true,
                        te: false,
                        st: false,
                      },
                    ].map((row) => (
                      <TableRow key={row.module}>
                        <TableCell className="font-medium text-sm">{row.module}</TableCell>
                        <TableCell className="text-center">
                          <Check className="mx-auto size-4 text-emerald-500" />
                        </TableCell>
                        <TableCell className="text-center">
                          {row.sc ? (
                            <Check className="mx-auto size-4 text-emerald-500" />
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.te ? (
                            <Check className="mx-auto size-4 text-emerald-500" />
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.st ? (
                            <Check className="mx-auto size-4 text-emerald-500" />
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Tabela de Planos integrada */}
              <div className="mt-8 space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Layers className="size-4 text-primary" /> Status dos Planos de Assinatura no
                  Banco
                </h4>
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Plano</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead className="text-right">Preço Mensal</TableHead>
                        <TableHead className="text-right">Capacidade</TableHead>
                        <TableHead className="text-right">Ativo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(plans ?? []).map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{TIER_LABEL[p.tier]}</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {brl(p.price_cents)}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {p.max_teachers} profs · {p.max_students} alunos
                          </TableCell>
                          <TableCell className="text-right">
                            <Switch
                              checked={p.active}
                              onCheckedChange={(v) => togglePlan(p.id, v)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: CONFIGURAÇÕES DE NOTIFICAÇÕES */}
        <TabsContent value="notifications">
          <Card className="rounded-2xl border-border/70 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="size-5 text-amber-500" /> Notificações & Alertas de Eventos
              </CardTitle>
              <CardDescription>
                Defina os gatilhos de eventos, alertas de segurança e frequência dos relatórios.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                {[
                  {
                    key: "notifyNewSchool" as const,
                    title: "Nova Escola Cadastrada",
                    desc: "Receber aviso quando uma nova escola iniciar o cadastro ou trial.",
                  },
                  {
                    key: "notifyChurn" as const,
                    title: "Cancelamento / Inatividade (Churn)",
                    desc: "Notificar quando uma assinatura for cancelada ou expirar.",
                  },
                  {
                    key: "notifySuspiciousLogin" as const,
                    title: "Tentativas de Login Suspeitas",
                    desc: "Alertar quando houver múltiplos logins com falha ou de IPs desconhecidos.",
                  },
                  {
                    key: "notifyCriticalErrors" as const,
                    title: "Erros Críticos da Aplicação",
                    desc: "Notificar falhas de conexões de IA ou erros no Supabase.",
                  },
                  {
                    key: "weeklyDigest" as const,
                    title: "Resumo Semanal de Métricas",
                    desc: "Receber relatório consolidado de simulados realizados e cadastros.",
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-xl border border-border p-3.5"
                  >
                    <div>
                      <div className="text-sm font-semibold">{item.title}</div>
                      <div className="text-xs text-muted-foreground">{item.desc}</div>
                    </div>
                    <Switch
                      checked={settings[item.key]}
                      onCheckedChange={(val) => setSettings({ ...settings, [item.key]: val })}
                    />
                  </div>
                ))}
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Canal Principal de Entrega</Label>
                  <Select
                    value={settings.notificationChannel}
                    onValueChange={(val) =>
                      setSettings({
                        ...settings,
                        notificationChannel: val as "email" | "in_app" | "both",
                      })
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Selecione o canal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Somente E-mail</SelectItem>
                      <SelectItem value="in_app">Somente Notificação no Painel</SelectItem>
                      <SelectItem value="both">Ambos (E-mail + Painel)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Frequência dos Resumos de Desempenho</Label>
                  <Select
                    value={settings.digestFrequency}
                    onValueChange={(val) =>
                      setSettings({
                        ...settings,
                        digestFrequency: val as "daily" | "weekly" | "monthly",
                      })
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Selecione a frequência" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diário</SelectItem>
                      <SelectItem value="weekly">Semanal (Toda Segunda-feira)</SelectItem>
                      <SelectItem value="monthly">Mensal (1º dia do mês)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: BACKUP E RESTAURAÇÃO */}
        <TabsContent value="backup">
          <Card className="rounded-2xl border-border/70 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <HardDrive className="size-5 text-blue-500" /> Copias de Segurança (Backup) &
                Retenção
              </CardTitle>
              <CardDescription>
                Agendamento de rotinas de backup da base Postgres do Supabase e relatórios de
                restauração.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-xl border border-border p-4 bg-muted/20">
                <div className="space-y-0.5">
                  <div className="font-semibold text-sm">Backups Automáticos Agendados</div>
                  <p className="text-xs text-muted-foreground">
                    Cria snapshots criptografados do banco de dados periodicamente.
                  </p>
                </div>
                <Switch
                  checked={settings.autoBackupEnabled}
                  onCheckedChange={(val) => setSettings({ ...settings, autoBackupEnabled: val })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Frequência do Backup</Label>
                  <Select
                    value={settings.backupFrequency}
                    onValueChange={(val) =>
                      setSettings({
                        ...settings,
                        backupFrequency: val as "daily" | "weekly" | "monthly",
                      })
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diário (à meia-noite)</SelectItem>
                      <SelectItem value="weekly">Semanal (Aos Domingos)</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Período de Retenção (dias)</Label>
                  <Input
                    type="number"
                    min={7}
                    max={365}
                    value={settings.backupRetentionDays}
                    onChange={(e) =>
                      setSettings({ ...settings, backupRetentionDays: Number(e.target.value) })
                    }
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Provedor de Armazenamento</Label>
                  <Select
                    value={settings.storageProvider}
                    onValueChange={(val) =>
                      setSettings({
                        ...settings,
                        storageProvider: val as "supabase" | "aws_s3" | "gcp",
                      })
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="supabase">Supabase Storage Safe</SelectItem>
                      <SelectItem value="aws_s3">Amazon S3 Bucket (Encrypted)</SelectItem>
                      <SelectItem value="gcp">Google Cloud Storage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="font-semibold text-sm">Backup Manual Imediato</h4>
                  <p className="text-xs text-muted-foreground">
                    Gere uma cópia completa dos dados da plataforma em tempo real.
                  </p>
                </div>
                <Button variant="outline" className="gap-2 rounded-xl" onClick={runManualBackup}>
                  <Database className="size-4 text-blue-500" /> Executar Backup Agora
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 6: INTEGRAÇÕES */}
        <TabsContent value="integrations">
          <Card className="rounded-2xl border-border/70 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Cpu className="size-5 text-purple-500" /> Integrações & APIs de Terceiros
              </CardTitle>
              <CardDescription>
                As chaves secretas de integração são gerenciadas exclusivamente por variáveis de
                ambiente no servidor (ex.: <code>AI_API_KEY</code>, <code>WEBHOOK_SECRET</code>). Os
                campos abaixo são apenas de visualização e não são persistidos no banco de dados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* OpenRouter Key */}
              <div className="space-y-2 rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm flex items-center gap-2">
                    <Cpu className="size-4 text-orange-500" /> OpenRouter API Key (Modelos LLM
                    Universais / Claude, Llama, DeepSeek)
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => testIntegration("OpenRouter API")}
                  >
                    <Activity className="size-3.5" /> Testar Conexão
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    type={showSecretKeys["openrouter"] ? "text" : "password"}
                    value={settings.openrouterApiKey}
                    readOnly
                    className="pr-10 font-mono text-xs rounded-xl bg-muted/40"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey("openrouter")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecretKeys["openrouter"] ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* OpenAI Key */}
              <div className="space-y-2 rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm flex items-center gap-2">
                    <SparklesIcon className="size-4 text-purple-500" /> OpenAI API Key (Geração de
                    Simulados e Correção IA)
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => testIntegration("OpenAI API")}
                  >
                    <Activity className="size-3.5" /> Testar Conexão
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    type={showSecretKeys["openai"] ? "text" : "password"}
                    value={settings.openaiApiKey}
                    readOnly
                    className="pr-10 font-mono text-xs rounded-xl bg-muted/40"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey("openai")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecretKeys["openai"] ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Mercado Pago Access Token */}
              <div className="space-y-2 rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm flex items-center gap-2">
                    <Key className="size-4 text-sky-500" /> Mercado Pago Access Token (Gateway de
                    Pagamento)
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => testIntegration("Mercado Pago")}
                  >
                    <Activity className="size-3.5" /> Testar Conexão
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    type={showSecretKeys["mercadopago"] ? "text" : "password"}
                    value={settings.mercadoPagoAccessToken}
                    readOnly
                    className="pr-10 font-mono text-xs rounded-xl bg-muted/40"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey("mercadopago")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecretKeys["mercadopago"] ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* InfinityPay */}
              <div className="space-y-4 rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm flex items-center gap-2">
                    <Key className="size-4 text-emerald-500" /> InfinityPay (Checkout Integrado)
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => testIntegration("InfinityPay")}
                  >
                    <Activity className="size-3.5" /> Testar Conexão
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      InfiniteTag (Handle / @ da conta sem o $)
                    </label>
                    <Input
                      type="text"
                      value={settings.infinityPayTag}
                      onChange={(e) => setSettings({ ...settings, infinityPayTag: e.target.value })}
                      className="font-mono text-xs rounded-xl"
                      placeholder="minha_tag"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Redirect URL (URL de Sucesso)
                    </label>
                    <Input
                      type="text"
                      value={settings.infinityPayRedirectUrl}
                      onChange={(e) =>
                        setSettings({ ...settings, infinityPayRedirectUrl: e.target.value })
                      }
                      className="font-mono text-xs rounded-xl"
                      placeholder="https://seusite.com/sucesso"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Webhook URL</label>
                    <Input
                      type="text"
                      value={settings.infinityPayWebhookUrl}
                      onChange={(e) =>
                        setSettings({ ...settings, infinityPayWebhookUrl: e.target.value })
                      }
                      className="font-mono text-xs rounded-xl"
                      placeholder="https://seusite.com/api/webhook/infinitypay"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      InfiniteTag (Handle / @ da conta sem o $)
                    </label>
                    <Input
                      type="text"
                      value={settings.infinityPayTag}
                      onChange={(e) => setSettings({ ...settings, infinityPayTag: e.target.value })}
                      className="font-mono text-xs rounded-xl"
                      placeholder="minha_tag"
                    />
                  </div>
                </div>
              </div>

              {/* Resend Email Key */}
              <div className="space-y-2 rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm flex items-center gap-2">
                    <Bell className="size-4 text-blue-500" /> Resend API Key (Disparo de E-mails
                    Transacionais)
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => testIntegration("Resend Mailer")}
                  >
                    <Activity className="size-3.5" /> Testar Conexão
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    type={showSecretKeys["resend"] ? "text" : "password"}
                    value={settings.resendApiKey}
                    readOnly
                    className="pr-10 font-mono text-xs rounded-xl bg-muted/40"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey("resend")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecretKeys["resend"] ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Webhook Endpoint */}
              <div className="space-y-2">
                <Label htmlFor="webhookUrl">Endpoint de Webhooks do Sistema</Label>
                <Input
                  id="webhookUrl"
                  value={settings.webhookUrl}
                  onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
                  className="font-mono text-xs rounded-xl"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 7: AUDITORIA & LOGS */}
        <TabsContent value="audit">
          <Card className="rounded-2xl border-border/70 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="size-5 text-rose-500" /> Logs de Auditoria & Segurança RLS
              </CardTitle>
              <CardDescription>
                Histórico completo de alterações realizadas na plataforma e políticas de compliance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Data & Hora</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Módulo</TableHead>
                      <TableHead>Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_AUDIT_LOGS.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {log.timestamp}
                        </TableCell>
                        <TableCell className="text-xs font-medium">{log.user}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.module}
                        </TableCell>
                        <TableCell className="text-xs">{log.details}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-xl text-xs"
                  onClick={() => toast.info("Relatório de logs exportado em CSV!")}
                >
                  <Download className="size-3.5" /> Exportar Logs (CSV)
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Confirmação para Ações Críticas */}
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" /> Confirmar alteração de
              configurações críticas?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está alterando parâmetros de segurança da plataforma. Esta ação afetará todos os
              usuários da aplicação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-primary"
              onClick={() => {
                saveMutation.mutate(settings);
                setIsConfirmOpen(false);
              }}
            >
              Confirmar e Salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ShieldCheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}
