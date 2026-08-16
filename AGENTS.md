# Lecto — AGENTS.md Compendium

> High-signal context for agents working in this repo. Every line answers: "Would an agent likely miss this?"

- **Package manager**: Bun is primary (Bun scripts like `bun run dev`). Use `npm` fallback but Bun is expected.
- **Framework**: TanStack Start (SSR + server functions). Entry points:
  - `src/start.ts` = server-function middleware (declare exactly one file)
  - `src/server.ts` = SSR request handler (`handler.fetch(request)` entrypoint)
  - `src/router.tsx` = router instance (`getRouter()`)
- **Routing**: File-based in `src/routes/` (not `src/pages/`). Critical:
  - `__root.tsx` = app shell (must preserve `<Outlet />`).
  - All route files auto-generate `src/routeTree.gen.ts` **do not edit manually**.
  - Path segments use `$` (dynamic) or `$$` (optional) notation.
- **Env vars**: `.env` must be present at root with **both** `VITE_` and non-prefixed vars (e.g., `SUPABASE_SERVICE_ROLE_KEY`).
  - `VITE_` vars exposed to client, others only to server.
- **Port**: Dev server runs on port **8080**.
- **Build & Test Order**: `lint → typecheck → test` is the expected verification chain.
- **E2E Requirements**: Playwright expects app running at `http://localhost:8080` (or set `E2E_BASE_URL`).
- **Seed Script**: `scripts/seed-local-users.js` creates demo users, classes, and PIN credentials for local Supabase testing.
- **Supabase Local**: Use `supabase init/reset` to populate local DB; **never use seed script against remote Supabase**.
- **Linting**: ESLint config distinguishes `server-only` import violations — rename modules to `*.server.ts` or add `@tanstack/react-start/server-only` tag.
- **TypeScript**: `skipLibCheck = true` in `tsconfig.json`; strict mode enabled.
- **Testing Paths**: E2E tests live in `tests/e2e/`:
  - Responsive audits → `tests/e2e/responsive-*.spec.ts`
  - Functional flows → `tests/e2e/functional-*.spec.ts`
  - Run with `bun run test:e2e` (all), `test:e2e:report` (HTML report).
- **RouteTree**: Auto-generated at `src/routeTree.gen.ts` — **do not edit manually**; rebuild if routes change.
- **Serverless Deploy**: Deployable via Dokploy using `Dockerfile`; env vars configured in Dokploy UI.

</composition>