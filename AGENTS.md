# Lecto — AGENTS.md Compendium

> High-signal context for agents working in this repo. Every line answers: "Would an agent likely miss this?"

## Commands & verification

- **Package manager**: Bun only. Use `bun run <script>`; CI/install always use `bun install --frozen-lockfile`.
- **Verification chain**: `bun run lint` → `bun run typecheck` → `bun run build`. There are **no unit tests** — `bun run test` is just an alias for `typecheck`. Only E2E exists (Playwright).
- **Dev server**: `bun run dev` on port **8080** (hardcoded in `vite.config.ts`). `E2E_BASE_URL` overrides it for Playwright.
- **Format**: `bun run format` (Prettier) — separate from lint (ESLint + Prettier plugin).

## Framework (TanStack Start)

- Entry points:
  - `src/start.ts` = `createStart` middleware (CSRF on server fns, error pages, auth attach).
  - `src/server.ts` = SSR request handler (`handler.fetch`); intercepts **pure-HTTP webhooks first** (`/api/webhooks/mercadopago`, `/api/webhooks/infinitypay`) before server functions — do not route webhooks through `createServerFn`.
  - `src/router.tsx` = router instance (`getRouter()`).
- **File-based routing** in `src/routes/` (not `src/pages/`). `__root.tsx` = app shell (keep `<Outlet />`). Path segments use `$id` (dynamic) / `$.tsx` (splat) / `{-$param}` (optional). Auto-generated `src/routeTree.gen.ts` — **never edit manually**; rebuild on route changes.
- **Server functions convention**: `*-functions.ts` = `createServerFn` exports; `*.server.ts` = server-only logic (service-role Supabase, AI keys, webhooks). Server-only modules are dynamically imported inside handlers. Lint + Vite `importProtection` enforce this — don't import server modules from client code.
- **AI**: Vercel AI SDK via OpenAI-compatible provider (`src/lib/ai-gateway.server.ts`); model/provider configured by `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` env vars.

## Supabase & DB

- **Env**: `.env` (root) needs **both** `VITE_`-prefixed (client-exposed, public keys only) and bare server vars (`SUPABASE_SERVICE_ROLE_KEY`, `AI_API_KEY`, `WEBHOOK_SECRET`). Never commit `.env`.
- **Clients**: `src/integrations/supabase/client.ts` = authed/RLS client (client + server). `client.server.ts` = `supabaseAdmin` with service role — **server only**.
- **DB types**: `src/integrations/supabase/types.ts` is generated from the schema — regenerate after migrations.
- **Migrations**: `supabase/migrations/NNNN_name.sql` (zero-padded). **Never edit an applied migration** — add a new one. New tables must enable RLS + policies + grants.
- **Local**: `supabase start` + `supabase db reset` to populate. `scripts/seed-local-users.js` seeds demo school/users/PINs — requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env, **local only, never remote**.
- **SQL tests**: `supabase/tests/security_test.sql` exercises RLS/security policies.

## Tests (E2E)

- `tests/e2e/`: `responsive-*.spec.ts` (layout/overflow at 480–1280px) and `functional-*.spec.ts` (landing, logins, guards, sidebar, dashboards). Helpers in `tests/e2e/helpers/`.
- Sub-scripts exist: `test:e2e:public`, `test:e2e:app`, `test:e2e:functional`, `test:e2e:functional:public`, `test:e2e:functional:app`, `test:e2e:report`.
- **`/app/*` tests are skipped** without an active preview session (`helpers/auth.ts` restores it) — log in via the preview and rerun.
- Evidence on failure → `test-results/` (screenshots, offender dumps via `data-e2e-offender`, trace/video).

## Git & deploy

- **GitHub Flow**: protected `main`, no direct pushes. Branch pattern `type/short-desc` (`feat/`, `fix/`, `security/`, `chore/`, `docs/`, `ci/`); semantic commits. CI (`bun install --frozen-lockfile` → lint, typecheck, then build with `NITRO_PRESET=node-server` and `NITRO_PRESET=vercel`).
- **Build preset**: `NITRO_PRESET` env selects Nitro target — `node-server` (Docker/Dokploy), `vercel` (via `vercel.json`), `cloudflare-module` (Workers).
- **Deploys**: Dokploy via `Dockerfile` (`.output`, `node .output/server/index.mjs`, env in Dokploy UI); Vercel via `vercel.json` (`buildCommand: NITRO_PRESET=vercel bun run build`).
- **Alias**: `@/*` → `src/*` (in tsconfig + vite alias). Types are strict; `skipLibCheck` is on.

## Docs

- `docs/desenvolvimento.md` (local setup), `docs/deploy.md`, `docs/banco-de-dados.md`, `docs/apis.md`, `CONTRIBUTING.md` (git + code conventions), `SECURITY.md`.