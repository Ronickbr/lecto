# 📖 Lecto — Plataforma de Compreensão Leitora

[![React 19](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TanStack Start](https://img.shields.io/badge/TanStack-Start-ff4154.svg)](https://tanstack.com/start)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind-v4-38bdf8.svg)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Self--Hosted-3ecf8e.svg)](https://supabase.com/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E-2e6495.svg)](https://playwright.dev/)
[![Vercel](https://img.shields.io/badge/Vercel-Deploy-000000.svg)](https://vercel.com)

O **Lecto** é uma plataforma edtech SaaS de avaliação e desenvolvimento de compreensão leitora para escolas e redes de ensino. Alinhada à metodologia internacional **PIRLS** (*Progress in International Reading Literacy Study*), a plataforma permite aplicar simulados, obter diagnósticos contínuos por IA e analisar o desempenho em leitura.

---

## 🚀 Tecnologias

- **Full-stack**: [TanStack Start](https://tanstack.com/start) (SSR + Server Functions) + [React 19](https://react.dev/)
- **Estilização**: [Tailwind CSS v4](https://tailwindcss.com/) (design system responsivo, dark/light mode)
- **Banco e Auth**: [Supabase](https://supabase.com/) (PostgreSQL, RLS, Auth, Storage)
- **IA generativa**: [Vercel AI SDK](https://sdk.vercel.ai/) (geração e correção de simulados e textos)
- **Testes**: [Playwright](https://playwright.dev/) (E2E)
- **Gerenciador de pacotes**: [Bun](https://bun.sh/)

## 🎯 Funcionalidades

- 🏫 **Multi-tenancy por escola**: hierarquia Super Admin → Gestor Escolar → Professor → Aluno, com isolamento por RLS.
- 📊 **Matriz PIRLS**: questões categorizadas nos 4 processos de compreensão leitora.
- 📝 **Simulados e avaliações**: criação, agendamento e correção (manual e por IA), com fluxo de geração unificado.
- 🔑 **Acesso aluno simplificado**: login por Código da Turma + PIN de 4 dígitos, com rotação de senha e rate limiting.
- 📈 **Dashboards de impacto**: comparativos de turmas, alunos e habilidades críticas.
- 💳 **Planos e pagamentos**: assinaturas por escola via Mercado Pago e InfinityPay, com webhooks verificados e checkout dedicado.
- 📦 **Limites por plano**: quotas de professores, alunos e simulados mensais por escola (e de escolas por plano) aplicadas no backend.
- 👤 **Perfil completo**: avatar, troca de senha inline, recuperação de acesso e logout.
- 🛡️ **Erros amigáveis**: tratamento centralizado de erros — título, descrição e "como resolver" em pt-BR, com detalhes técnicos registrados apenas no servidor.

---

## 🛠️ Como executar localmente

### Pré-requisitos

- **Bun** >= 1.x
- **Docker Desktop** (opcional, para Supabase local)

### Passo a passo

```bash
# 1. Instalar dependências
bun install

# 2. Configurar ambiente
cp .env.example .env
# edite o .env com suas credenciais

# 3. Subir o Supabase local (opcional) e aplicar migrations
supabase start
supabase db reset

# 4. Rodar em desenvolvimento
bun run dev
```

A aplicação estará em `http://localhost:8080`.

> Guia detalhado em [`docs/desenvolvimento.md`](docs/desenvolvimento.md).

## 🧪 Testes

```bash
bun run lint        # ESLint
bun run typecheck   # TypeScript (strict)
bun run build       # build de produção
bun run test:e2e    # Playwright (app em http://localhost:8080)
```

## 📚 Documentação

- [Desenvolvimento](docs/desenvolvimento.md)
- [Banco de dados & RLS](docs/banco-de-dados.md)
- [APIs & webhooks](docs/apis.md)
- [Deploy](docs/deploy.md)

## 🤝 Contribuindo

Veja o [CONTRIBUTING.md](CONTRIBUTING.md) para convenções de git, código, migrations e testes.

## 🔒 Segurança

Confira o [SECURITY.md](SECURITY.md) para a política de divulgação responsável e a postura de segurança do projeto.

## 📄 Licença

Software proprietário desenvolvido para a plataforma **Lecto**. Todos os direitos reservados.
