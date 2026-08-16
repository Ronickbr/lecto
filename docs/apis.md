# APIs

Este documento descreve as interfaces programáticas do projeto: server functions, webhooks e integrações com serviços externos.

## Visão geral

O backend do Lecto usa **TanStack Start Server Functions** (`createServerFn`). Elas são chamadas pelo cliente via RPC e executadas no servidor. Não há uma API REST tradicional; cada server function é um endpoint protegido.

## Segurança das server functions

- **CSRF**: middleware `createCsrfMiddleware` protege todas as server functions POST.
- **Autenticação**: o middleware `requireSupabaseAuth` valida o JWT Bearer e injeta `supabase` + `userId` no contexto.
- **Validação**: todo input passa por schema `zod` no `.validator(...)`.
- **Rate limiting**: endpoints públicos sem auth usam o helper `src/lib/rate-limit.server.ts`.

## Server functions principais

### Autenticação

#### `studentSignInFn` — login de aluno por PIN
- **Método**: POST (público)
- **Input**: `{ classCode, studentCode, pin }`
- **Comportamento**: valida a turma, localiza o aluno, verifica o PIN (bcrypt via `verify_student_pin`), rotaciona a senha do usuário e retorna `{ email, password, fullName }`.
- **Proteção**: rate limit de 5 tentativas / 5 min com bloqueio de 15 min por IP+aluno.

#### `createStudentFn` — criação de aluno pelo admin
- **Método**: POST (autenticado, `school_admin`/`super_admin`)
- **Input**: `{ schoolId, classId, fullName, studentCode, pin, birthDate?, guardianEmail?, guardianPhone? }`
- **Comportamento**: cria usuário no Supabase Auth, hash do PIN, registro em `students`, `student_credentials` e `user_roles`. Em caso de erro parcial, faz rollback.

### Admin

#### `listGlobalUsersFn` — usuários globais (super admin)
- **Método**: GET (autenticado, `super_admin`)
- **Comportamento**: consulta `auth.users` via `admin.listUsers` (paginado), monta mapas de e-mail/nome e retorna lista com `role`, `school` etc.
- **Motivo**: `profiles` pode não estar populado; `auth.users` é a fonte de verdade.

### IA Generativa

O módulo `src/lib/ai-gateway.server.ts` centraliza o acesso a modelos de IA via **Vercel AI SDK** (provider compatível com a API OpenAI):

- Variáveis: `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`.
- Consumido por: `grading.functions.ts`, `rubrics.server.ts`, `simulados.functions.ts`.
- **Nunca** é chamado do client; a chave da IA fica apenas no servidor.

## Webhooks

### Checkout de pagamento

O handler `checkoutWebhook` (em `src/lib/webhooks.checkout.functions.ts`) processa eventos de pagamento (Mercado Pago/InfinityPay). É um **server function POST** com as seguintes garantias de segurança:

- **Assinatura**: verifica HMAC-SHA256 do corpo usando `WEBHOOK_SECRET` (env). O campo `signature` no payload deve conter o hex da assinatura.
- **Idempotência**: eventos duplicados (mesmo `id`) são ignorados via tabela `webhook_events`.
- **Escopo**: apenas atualiza o status da assinatura da escola para `active` em pagamentos `paid`/`active`.

> **Nota:** para provedores que enviam a assinatura em header HTTP (não no corpo), é necessário expor uma rota HTTP pura (fora de serverFn). Planejado para iteração futura.

## Integrações externas

| Serviço | Variáveis de ambiente | Uso |
| :--- | :--- | :--- |
| Supabase (banco) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Cliente admin (server). |
| Supabase (auth) | `SUPABASE_PUBLISHABLE_KEY` | Cliente autenticado (server + client). |
| IA (OpenRouter/OpenAI) | `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | Geração/correção de simulados. |
| Webhooks de pagamento | `WEBHOOK_SECRET` | Verificação de assinatura. |

## Checklist para novas server functions

1. Definir schema zod no `.validator(...)`.
2. Adicionar `requireSupabaseAuth` se precisar do usuário logado.
3. Endpoint público → adicionar rate limiting.
4. Usar `supabaseAdmin` **somente** no servidor, com import dinâmico.
5. Nunca retornar dados sensíveis (hash de PIN, service role, chaves).
