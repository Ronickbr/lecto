# Testes e2e (responsividade + funcionalidade)

Suíte Playwright que audita **overflow horizontal**, quebras de layout, alvos de
toque nos breakpoints **480, 640, 768, 1024 e 1280px** e valida os **fluxos
funcionais** das rotas públicas e da área logada.

## Como rodar

```bash
bun run test:e2e                    # tudo
bun run test:e2e:public             # responsividade — rotas públicas
bun run test:e2e:app                # responsividade — área logada
bun run test:e2e:functional         # funcional (público + logado)
bun run test:e2e:functional:public  # funcional — rotas públicas
bun run test:e2e:functional:app     # funcional — área logada
bun run test:e2e:report             # abre o relatório HTML
```

O app precisa estar rodando em `http://localhost:8080` (ou defina `E2E_BASE_URL`).

## Evidências automáticas de falha

Quando há overflow horizontal ou quebra de layout, a suíte captura sozinha:

- **Screenshot da página** no breakpoint que falhou
- **Screenshot do elemento culpado** (até 3), marcado via `data-e2e-offender`
- **Dump textual** com `outerHTML`, retângulo, `scrollWidth/clientWidth`,
  estilos computados (width, min/max-width, overflow-x, flex, grid, padding…)
  e a cadeia de ancestrais
- **Vídeo + trace** do teste (config do Playwright: `retain-on-failure`)

Tudo fica em `test-results/responsive/evidence/` e também anexado ao relatório
HTML (`bun run test:e2e:report`), com links no resumo em markdown.

## Área logada (`/app/*`)

Os testes de `/app/*` usam a sessão gerenciada do preview. Sem sessão ativa eles
são **pulados** com mensagem explicativa — entre na aplicação pelo preview e
rode novamente.

## Resumo gerado

- `test-results/responsive/responsive-summary.md` — tabela rota × breakpoint
  (✅ ok, ⚠️ quebra de layout, ❌ overflow) + detalhes e links das evidências
- `test-results/responsive/responsive-summary.json` — mesmos dados em JSON

## Arquivos

- `routes.ts` — lista de rotas auditadas
- `helpers/responsive.ts` — medição de overflow, quebras e alvos de toque
- `helpers/artifacts.ts` — screenshots, dump do elemento culpado e anexos
- `helpers/auth.ts` — restauração da sessão do preview
- `helpers/summary.ts` — geração do resumo
- `responsive-*.spec.ts` — auditoria de layout
- `functional-*.spec.ts` — fluxos funcionais (landing, logins, guardas de rota,
  navegação da sidebar, diálogos de criação, filtros e painéis com gráficos)
