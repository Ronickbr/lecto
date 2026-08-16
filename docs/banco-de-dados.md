# Banco de Dados

Documentação do schema, RLS (Row Level Security) e migrations do Supabase.

## Visão geral

O banco é PostgreSQL (via Supabase) com **multi-tenancy por escola**. As principais entidades:

| Entidade | Tabela | Descrição |
| :--- | :--- | :--- |
| Perfis | `profiles` | Perfil público do usuário (criado automaticamente no signup). |
| Escolas | `schools` | Instituições / redes de ensino. |
| Planos | `plans` | Planos de assinatura e limites. |
| Assinaturas | `subscriptions` | Vínculo escola-plano com status. |
| Papéis | `user_roles` | `super_admin`, `school_admin`, `teacher`, `student` por escola. |
| Turmas | `classes` | Turmas vinculadas a uma escola. |
| Professores | `teachers` | Dados de professores por escola. |
| Alunos | `students` | Dados de alunos por escola e turma. |
| Credenciais de aluno | `student_credentials` | Hash do PIN (bcrypt) + e-mail do aluno. |
| Textos | `texts` | Material de leitura (PIRLS). |
| Questões | `questions` | Questões com processo PIRLS. |
| Gabaritos | `question_keys` | Gabaritos/rubricas restritos a editores. |
| Simulados | `simulados`, `simulado_pages`, `simulado_blocks` | Estrutura de provas. |
| Tentativas | `simulado_attempts` | Sessões de aluno (com `submitted_at`). |
| Respostas | `simulado_answers` | Respostas e correção. |
| Reaplicações | `simulado_retakes` | Controle de retakes. |
| Logs | `logs` | Trilha de auditoria. |
| Config. plataforma | `platform_settings` | Configurações globais do super admin. |
| Webhooks | `webhook_events` | Ledger de idempotência de webhooks de pagamento. |

## Row Level Security (RLS)

Todas as tabelas têm RLS habilitado. As funções auxiliares definem o isolamento:

| Função | Uso |
| :--- | :--- |
| `public.has_role(uid, role)` | Verifica se o usuário tem um papel. |
| `public.user_school_id(uid)` | Escola do usuário (fail-closed se estiver em mais de uma). |
| `public.is_super_admin(uid)` | Papel global de super admin. |
| `public.is_school_editor(uid, school_id)` | `school_admin` ou `teacher` da escola. |
| `public.is_attempt_staff(school_id)` | Staff com acesso de correção. |

### Regras principais

- **Alunos** veem/alteram apenas os próprios dados (via `user_id = auth.uid()` + associação com a escola).
- **School admin/teacher** operam apenas na própria escola (`school_id = user_school_id(auth.uid())`).
- **Super admin** gerencia tudo.
- **`submitted_at`** é imutável após a submissão (`protect_attempt_columns`).
- **Alunos não podem deletar tentativas**; podem apenas ler/criar/editar as próprias.
- **School admin não altera colunas de faturamento** (`plan_id`, `subscription_status`, `subscription_expires_at`).
- **`student_credentials`** só é acessível via `service_role` (hash de PIN nunca vaza).
- **`webhook_events`** só via `service_role`.

### Grants

O padrão é: `GRANT ... TO authenticated` para tabelas com políticas RLS, `GRANT ALL ... TO service_role` para operações administrativas, e funções sensíveis (`hash_pin`, `verify_student_pin`) restritas a `service_role`.

## Migrations

Migrations ficam em `supabase/migrations/` com a numeração sequencial (`0001_...`, `0024_...`). O versionamento também é registrado em `supabase_migrations.schema_migrations`.

### Regras

- **Nunca** edite migrations já aplicadas em produção. Crie uma nova migration com o próximo número.
- Teste localmente antes de aplicar em produção.
- Toda tabela nova: `ENABLE ROW LEVEL SECURITY` + policies + grants.
- Ao alterar o schema, atualize `src/integrations/supabase/types.ts` (regenerar via Supabase CLI) para manter o type-check.

### Aplicar em produção (self-hosted)

Com o arquivo de migration e acesso psql ao banco remoto:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0024_rls_hardening.sql
```

E registre a versão:

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0024', 'rls_hardening')
ON CONFLICT (version) DO NOTHING;
```

> Reserve o acesso ao banco de produção para operações autorizadas.

## Views e Materialized Views

- `questions_safe`: expõe questões sem gabarito/rubrica para alunos.
- Materialized views para relatórios/dashboards (ver `0009_views.sql`, `0010_materialized_views.sql`).

## Realtime

- Tabelas com realtime habilitado: ver `0015_realtime.sql`.
- Cron jobs: ver `0016_cron.sql` (ex.: jobs de manutenção).

## Backups

- Recursos de backup nativos do Supabase para instâncias gerenciadas.
- Para self-hosted, use `pg_dump` (os dumps `full_vps_*.sql` são ignorados pelo git).
