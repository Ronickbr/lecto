# Changelog

Todas as mudanças notáveis do projeto são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o versionamento segue [SemVer](https://semver.org/lang/pt-BR/).

## [Não publicado]

### Segurança
- Webhook de checkout agora valida assinatura HMAC-SHA256 (`WEBHOOK_SECRET`) e processa eventos de forma idempotente (nova tabela `webhook_events`).
- Login de aluno por PIN ganhou rate limiting contra força bruta (5 tentativas/5min, bloqueio de 15min).
- Removida chave pública hardcoded (`pk_live_lecto_...`) da central de configurações.
- Chaves secretas de integração (OpenRouter, OpenAI, Mercado Pago, Resend) deixaram de ser persistidas via client no banco — agora são apenas variáveis de ambiente no servidor.
- Removida service role demo key hardcoded do script `seed-local-users.js` (agora exige `SUPABASE_SERVICE_ROLE_KEY` via env).
- Migração `0024_rls_hardening.sql`: proteção de `submitted_at`, restrição de UPDATE de colunas de faturamento em `schools`, grants de escrita em `user_roles`, isolamento de alunos por escola no `students`, logs vinculados à escola e backfill de `profiles` a partir de `auth.users`.

### Corrigido
- Listagem "Usuários Globais" no admin: `profiles` estava vazio em produção; agora a listagem consulta `auth.users` via server function e o backfill de perfis foi adicionado.

### Infraestrutura
- `Dockerfile` corrigido: build com Bun + preset Nitro `node-server` (antes usava `npm ci` e preset `cloudflare-module` incompatíveis com o runner).
- Preset Nitro agora é configurável via `NITRO_PRESET`.
- Suporte a deploy na **Vercel** via `vercel.json` (preset `vercel`).

### CI/CD
- GitHub Actions: jobs de `lint`, `typecheck` e `build` (node-server + vercel) em PRs e pushes para `main`.
- Templates de Pull Request e Issues (bug, feature, segurança).

### Documentação
- Adicionados `CONTRIBUTING.md`, `SECURITY.md`, `.env.example` e documentação em `docs/`.

## [1.0.0] - 2026-08-15

### Adicionado
- Versão inicial da plataforma Lecto: gestão multi-escola, simulados PIRLS, autenticação por PIN para alunos, dashboards e relatórios.
