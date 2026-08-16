# Security Policy

## Reporting a Vulnerability

A equipe leva a segurança a sério. **Não abra issues públicas** para vulnerabilidades exploráveis.

**Relatos confidenciais** devem ser enviados por e-mail para a equipe de segurança:

```
kmkz.clan@gmail.com
```

Inclua no relato:

- Descrição da vulnerabilidade e impacto potencial.
- Passos de reprodução em ambiente de teste/homologação.
- Versão/commit afetado, se possível.
- Sugestões de mitigação, se houver.

Você receberá um acuso de recebimento em até 48h e uma avaliação inicial em até 5 dias úteis. Nada será divulgado publicamente sem seu consentimento.

## Disclosure Policy

1. Notifique-nos de forma privada antes de qualquer divulgação pública.
2. Aguarde a confirmação e a correção antes de publicar detalhes.
3. Não acesse dados de produção além do necessário para demonstrar o problema.

## Security Posture

### Segredos

- **Nunca** estão no repositório: `.env`, chaves de API, service role keys, tokens.
- Gerenciados por variáveis de ambiente no servidor:
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`
  - `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`
  - `WEBHOOK_SECRET` (assinatura HMAC-SHA256 de webhooks)
- Chaves secretas de integração **não** são persistidas no banco via client (`platform_settings`).

### Autenticação e autorização

- Server functions autenticadas usam `requireSupabaseAuth` (JWT Bearer).
- Multi-tenancy por RLS: `user_school_id(auth.uid())` + papéis (`super_admin`, `school_admin`, `teacher`, `student`).
- Login de aluno por PIN: verificação server-side via `pgcrypto`, rotação de senha por login e **rate limiting** (5 tentativas / 5 min, bloqueio de 15 min).

### Webhooks

- Todo webhook deve verificar assinatura HMAC-SHA256 (`WEBHOOK_SECRET`).
- Processamento idempotente via tabela `webhook_events`.

### Infraestrutura

- Build com preset Nitro configurável (`NITRO_PRESET`): `node-server` (Docker/Vercel) ou `cloudflare-module`.
- CI roda `lint`, `typecheck` e `build` em todos os PRs.

## Supported Versions

| Versão | Suporte           |
| ------ | ----------------- |
| main   | Correções ativas  |

## Dependency Management

Dependências são gerenciadas via lockfile do Bun (`bun.lock`). Atualizações de segurança devem passar por CI antes do merge.
