# Desenvolvimento

Guia para rodar o projeto localmente, incluindo Supabase local.

## Pré-requisitos

- **Bun** >= 1.x (gerenciador oficial)
- **Docker Desktop** (para o Supabase local)
- **Supabase CLI** (para `supabase start`)

## Configuração do ambiente

1. Instale as dependências:

   ```bash
   bun install
   ```

2. Crie o arquivo `.env` a partir do exemplo:

   ```bash
   cp .env.example .env
   ```

3. Preencha as variáveis (veja `.env.example` para a descrição de cada uma).

> **Importante:** o prefixo `VITE_` expõe a variável ao cliente. Só use `VITE_` para valores públicos (anon/publishable keys). Chaves secretas ficam sem prefixo.

## Supabase local

### Iniciar

```bash
supabase start
```

O comando inicia todos os serviços (Postgres, Auth, Storage, Realtime) e exibe as chaves do projeto local.

### Aplicar migrations

As migrations estão em `supabase/migrations/`. O fluxo recomendado é o Supabase CLI:

```bash
supabase db reset
```

`db reset` aplica todas as migrations do zero e limpa os dados. Para aplicar apenas as pendentes sem resetar dados, use:

```bash
supabase migration up
```

> Em instalações self-hosted (VPS), as migrations são aplicadas via `psql` contra o banco. Ver `docs/banco-de-dados.md`.

### Seed de usuários demo (somente local)

```bash
export SUPABASE_URL="http://127.0.0.1:54321"
export SUPABASE_SERVICE_ROLE_KEY="<chave service_role do supabase status>"
bun run scripts/seed-local-users.js
```

> **Nunca** rode o seed contra o Supabase remoto.

### Criação de credenciais de aluno

O fluxo normal (pelo painel admin) cria o usuário do aluno e o hash de PIN automaticamente via server functions. O seed cobre o cenário local.

## Rodando o app

```bash
bun run dev
```

Disponível em `http://localhost:8080`.

## Verificação de qualidade

A sequência esperada antes de qualquer PR:

```bash
bun run lint        # ESLint
bun run typecheck   # tsc --noEmit
bun run build       # build de produção (preset NITRO_PRESET)
```

## Testes E2E

Com o app rodando em `http://localhost:8080`:

```bash
bun run test:e2e
```

Para relatório HTML:

```bash
bun run test:e2e:report
```

O URL base pode ser sobrescrito com `E2E_BASE_URL`.

## Estrutura de diretórios

```
src/
  routes/                    # Rotas file-based do TanStack Router
    __root.tsx               # App shell (contém <Outlet />)
  router.tsx                 # Instância do router (getRouter())
  start.ts                   # createStart + middlewares (CSRF, erros)
  server.ts                  # Entry SSR (handler.fetch)
  lib/                       # Lógica de negócio e server functions
    *.server.ts              # Código server-only
    *-functions.ts           # Server functions (createServerFn)
  integrations/supabase/     # Clientes Supabase (client, admin, auth)
  components/                # Componentes compartilhados
supabase/
  migrations/                # Migrations versionadas (0001_...)
tests/
  e2e/                       # Testes Playwright (responsive-*, functional-*)
scripts/
  seed-local-users.js        # Seed de usuários demo (apenas local)
```

## Convenções

- Tipos do banco: `src/integrations/supabase/types.ts` (gerados a partir do schema).
- Server functions públicas (sem auth) devem ter rate limiting e validação (zod).
- Código que toca o service role fica em `*.server.ts` e é importado dinamicamente dentro de handlers.
