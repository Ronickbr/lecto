# Guia de Contribuição

Obrigado por contribuir com o **Lecto**! Este documento define as convenções, fluxos de trabalho e padrões de qualidade do projeto.

## Sumário

- [Código de conduta](#código-de-conduta)
- [Começando](#começando)
- [Fluxo de trabalho com Git](#fluxo-de-trabalho-com-git)
- [Padrões de código](#padrões-de-código)
- [Segurança](#segurança)
- [Banco de dados e migrations](#banco-de-dados-e-migrations)
- [Testes](#testes)
- [Pull Requests](#pull-requests)

## Código de conduta

Seja respeitoso e construtivo. Este projeto não tolera assédio ou discriminação.

## Começando

1. **Fork** o repositório e clone localmente.
2. Instale as dependências com **Bun** (gerenciador oficial):

   ```bash
   bun install
   ```

3. Configure o ambiente: copie `.env.example` para `.env` e preencha as variáveis. O arquivo `.env` **nunca** deve ser commitado.
4. Suba o Supabase local (ver `docs/desenvolvimento.md`) e aplique as migrations.
5. Inicie o servidor de desenvolvimento:

   ```bash
   bun run dev
   ```

   A aplicação estará em `http://localhost:8080`.

## Fluxo de trabalho com Git

O projeto usa **GitHub Flow** com proteção na branch `main`:

- **`main`** — produção. Protegida: exige PR aprovado e CI verde.
- **Branches de feature** — criadas a partir de `main` com o padrão `tipo/descricao-curta`, ex.:
  - `fix/rate-limit-pin`
  - `feat/relatorio-turmas`
  - `chore/atualiza-deps`
  - `security/hardening-rls`

**Nunca** faça push direto para `main`. Todo o trabalho entra via Pull Request.

### Convenção de commits

Usamos commits semânticos (formato `tipo: descrição`):

- `feat:` nova funcionalidade
- `fix:` correção de bug
- `security:` correção de segurança
- `refactor:` refatoração sem mudança de comportamento
- `test:` testes
- `docs:` documentação
- `chore:` tarefas de manutenção
- `ci:` alterações de CI/CD

Exemplo: `fix: aplica rate limit no login por PIN do aluno`.

## Padrões de código

- **TypeScript estrito**: o projeto usa `strict: true` no `tsconfig.json`.
- **Server Functions**: código sensível (Supabase service role, chaves de IA, webhooks) fica em módulos `*.server.ts` ou server functions com o sufixo `.server`. Nunca exponha segredos no bundle do cliente.
- **Importação**: use o alias `@/*` para caminhos a partir de `src/`.
- **Clientes Supabase**:
  - Queries autenticadas (com RLS): `src/integrations/supabase/client.ts` ou o contexto `supabase` do middleware `requireSupabaseAuth`.
  - Operações administrativas: `supabaseAdmin` de `src/integrations/supabase/client.server.ts` — **somente** no servidor.
- **Lint/format**: rode antes de submeter o PR:

  ```bash
  bun run lint
  bun run typecheck
  bun run format
  ```

- **Não adicione comentários desnecessários**; o código deve ser autoexplicativo. Comentários são aceitos quando explicam _por quê_, não _o quê_.

## Segurança

Leia o [`SECURITY.md`](./SECURITY.md). Regras obrigatórias:

- **Nunca** commitite `.env`, chaves de API, tokens ou dados de produção.
- Secrets de integração são lidos de variáveis de ambiente no servidor (ex.: `AI_API_KEY`, `WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`), nunca do banco via client.
- Novas tabelas devem ter **RLS habilitado** com políticas mínimas de acesso por papel/escola.
- Endpoints públicos (webhooks, login por PIN) devem ter verificação de assinatura e/ou rate limiting.

## Banco de dados e migrations

- Migrations versionadas em `supabase/migrations/` no formato `NNNN_nome_descritivo.sql` (ex.: `0024_rls_hardening.sql`).
- **Nunca** edite migrations já aplicadas em produção; crie uma nova.
- Ao alterar tabelas/colunas, atualize os tipos gerados em `src/integrations/supabase/types.ts` (ou regenere com o Supabase CLI).
- Toda tabela nova precisa de: `ENABLE ROW LEVEL SECURITY`, políticas, e `GRANT` adequado.

## Testes

- **E2E** com Playwright: `bun run test:e2e` (app deve estar rodando em `http://localhost:8080` ou `E2E_BASE_URL`).
- **Validação local**: a sequência esperada é `bun run lint` → `bun run typecheck` → `bun run build`.

## Pull Requests

- Descreva a mudança, o motivo e como testar.
- Vincule a issue correspondente quando existir.
- Garanta que CI (lint, typecheck, build) esteja verde.
- Mantenha PRs pequenos e focados; revisores têm prioridade de revisão.
