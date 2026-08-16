# Deploy

O projeto é deployável em **Vercel** (principal), **Dokploy via Dockerfile** e **Cloudflare Workers/Pages**.

## Variáveis de ambiente compartilhadas

Todas as plataformas precisam (valores reais configurados no painel, **nunca** no repositório):

```env
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=

VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=

AI_BASE_URL=
AI_API_KEY=
AI_MODEL=

WEBHOOK_SECRET=
```

## Vercel (recomendado)

1. Importe o repositório no Vercel.
2. **Framework Preset**: None (o `vercel.json` define o build).
3. Configure as variáveis de ambiente acima no projeto.
4. O build usa Bun com o preset Nitro `vercel`:

   - `installCommand`: `bun install --frozen-lockfile`
   - `buildCommand`: `NITRO_PRESET=vercel bun run build`
   - `outputDirectory`: `.vercel/output`

5. Deploy automático a cada push em `main` (e previews por PR, se habilitado).

### Previews

Os previews da Vercel usam as mesmas env vars de produção ou um override (ex.: apontando para um Supabase de staging). Configure conforme necessário.

## Dokploy (Docker)

O projeto inclui um `Dockerfile` multi-stage otimizado:

- **Stage build**: imagem `oven/bun:1-alpine`, instala deps com Bun e executa `NITRO_PRESET=node-server bun run build`.
- **Stage runtime**: imagem `node:20-alpine`, executa `node .output/server/index.mjs`.

No painel do Dokploy:

1. Crie a aplicação apontando para o repositório (branch `main`).
2. **Build Type**: Dockerfile.
3. **Porta**: `3000`.
4. Configure as env vars acima + `PORT=3000` e `HOST=0.0.0.0`.

## Cloudflare Workers/Pages

Para Cloudflare, use o preset `cloudflare-module`:

```env
NITRO_PRESET=cloudflare-module
```

O build gera a saída esperada pelo Wrangler (`.wrangler/` é ignorado pelo git). A entry `src/server.ts` já usa a assinatura `fetch(request, env, ctx)` compatível.

## CI/CD

O GitHub Actions (`.github/workflows/ci.yml`) roda em todo PR/push para `main`:

- **Lint** (`bun run lint`)
- **Typecheck** (`bun run typecheck`)
- **Build** (`NITRO_PRESET=node-server` e `NITRO_PRESET=vercel`)

## Checklist de deploy

- [ ] Migrations aplicadas e registradas em `supabase_migrations.schema_migrations`.
- [ ] Env vars configuradas na plataforma.
- [ ] `WEBHOOK_SECRET` definido (se webhooks ativos).
- [ ] Backups do banco configurados.
- [ ] Health check respondendo 200.
