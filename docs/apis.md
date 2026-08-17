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

Os webhooks de pagamento são **rotas HTTP puras** (fora de serverFn), interceptadas no entrypoint `src/server.ts` antes do SSR — necessárias porque os provedores enviam a assinatura em header/query e seguem contratos próprios.

| Rota                             | Provedor     | Assinatura                                                                                                                                               |
| :------------------------------- | :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/webhooks/mercadopago` | Mercado Pago | `x-signature` (`ts=...,v1=...`) + `x-request-id` + `data.id` na query → HMAC-SHA256 da string canônica `id:[data.id];request-id:[x-request-id];ts:[ts];` |
| `POST /api/webhooks/infinitypay` | InfinityPay  | Sem assinatura; validação por `order_nsu` (deve corresponder a um checkout real) + idempotência por `transaction_nsu`                                    |

**Garantias comuns** (em `src/lib/payment-processing.server.ts`):

- **Idempotência**: eventos duplicados (mesmo `eventId`) são ignorados via tabela `webhook_events`.
- **Mapeamento**: o `external_reference`/`order_nsu` aponta para a tabela `checkouts`, que guarda `school_id` + `plan_id` + `amount_cents`.
- **Ativação**: pagamento confirmado ativa a assinatura — upsert em `subscriptions` (status `active`, expiração 30 dias) **e** atualiza `schools.subscription_status`/`plan_id`/`subscription_expires_at` (painel admin).
- **Ledger**: `checkouts.status` vai para `paid` com `paid_at`.

> **Mercado Pago**: o payload do webhook pode vir truncado; o handler consulta `GET /v1/payments/{data.id}` para obter o `external_reference` confiável.

## Integrações externas

| Serviço                 | Variáveis de ambiente                                                                    | Uso                                                                       |
| :---------------------- | :--------------------------------------------------------------------------------------- | :------------------------------------------------------------------------ |
| Supabase (banco)        | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`                                              | Cliente admin (server).                                                   |
| Supabase (auth)         | `SUPABASE_PUBLISHABLE_KEY`                                                               | Cliente autenticado (server + client).                                    |
| IA (OpenRouter/OpenAI)  | `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`                                                  | Geração/correção de simulados.                                            |
| Webhooks de pagamento   | `WEBHOOK_SECRET`, `MERCADO_PAGO_ACCESS_TOKEN` (e opcional `MERCADO_PAGO_WEBHOOK_SECRET`) | Verificação de assinatura dos webhooks.                                   |
| Mercado Pago (checkout) | `MERCADO_PAGO_ACCESS_TOKEN`                                                              | Criação de preferências (Checkout Pro).                                   |
| InfinityPay (checkout)  | `INFINITYPAY_HANDLE`                                                                     | Criação de links via `api.checkout.infinitepay.io` (sem API key).         |
| Resend (e-mails)        | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`                                                    | E-mails transacionais (auth/notificações) via `src/lib/resend.server.ts`. |

## Server functions de integração

- `testIntegrationFn` (`src/lib/integrations.functions.ts`): testa conexão real de `mercadopago`, `infinitypay` e `resend`. Apenas super admin.
- `createCheckoutFn` (`src/lib/integrations.functions.ts`): cria um pedido na tabela `checkouts` e gera o link/checkout no provedor (`mercado_pago` ou `infinitypay`), retornando `checkoutUrl`. Apenas super admin.
- `testAiConnectionFn` (`src/lib/ai-gateway.functions.ts`): testa a conexão de IA (`AI_BASE_URL`/`AI_API_KEY`).

## Checklist para novas server functions

1. Definir schema zod no `.validator(...)`.
2. Adicionar `requireSupabaseAuth` se precisar do usuário logado.
3. Endpoint público → adicionar rate limiting.
4. Usar `supabaseAdmin` **somente** no servidor, com import dinâmico.
5. Nunca retornar dados sensíveis (hash de PIN, service role, chaves).
