# 📖 Lecto — Plataforma de Compreensão Leitora

[![React 19](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TanStack Start](https://img.shields.io/badge/TanStack-Start-ff4154.svg)](https://tanstack.com/start)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind-v4-38bdf8.svg)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Self--Hosted-3ecf8e.svg)](https://supabase.com/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E-2e6495.svg)](https://playwright.dev/)

O **Lecto** é uma plataforma edtech SaaS de avaliação e desenvolvimento de compreensão leitora para escolas e redes de ensino. Alinhada com a metodologia internacional **PIRLS** (*Progress in International Reading Literacy Study*), o Lecto permite a aplicação de simulados, diagnósticos contínuos por IA e análise detalhada de desempenho em leitura.

---

## 🚀 Tecnologias Utilizadas

- **Core Frontend/Backend**: [TanStack Start](https://tanstack.com/start) (SSR + Server Functions) + [React 19](https://react.dev/)
- **Estilização**: [Tailwind CSS v4](https://tailwindcss.com/) (Design System responsivo & Dark/Light mode)
- **Banco de Dados & Autenticação**: [Supabase](https://supabase.com/) (PostgreSQL, Row Level Security, Auth, Storage)
- **IA Generativa**: [Vercel AI SDK](https://sdk.vercel.ai/) (Geração e correção automatizada de simulados e textos)
- **Testes**: [Playwright](https://playwright.dev/) (End-to-End)
- **Gerenciador de Pacotes**: [Bun](https://bun.sh/) / `npm`

---

## 🎯 Principais Funcionalidades

- 🏫 **Gestão Multi-escola (Multi-tenancy)**: Suporte a redes de ensino com hierarquia completa: Super Admin, Gestor Escolar, Professor e Aluno.
- 📊 **Matriz PIRLS de Leitura**: Questões categorizadas nos 4 processos de compreensão leitora:
  1. *Localizar Informações*
  2. *Inferências Diretas*
  3. *Interpretar e Integrar Ideias*
  4. *Examinar e Avaliar Conteúdo*
- 📝 **Simulados e Avaliações**: Criação, agendamento e correção de simulados presenciais ou digitais.
- 🔑 **Acesso Aluno Simplificado**: Autenticação facilitada por Código da Turma e PIN de 4 dígitos.
- 📈 **Dashboards de Impacto**: Relatórios gráficos comparativos de turmas, alunos e habilidades críticas.

---

## 🛠️ Como Executar o Projeto Localmente

### Pré-requisitos

- **Node.js** >= 20.x ou **Bun** >= 1.x
- **Docker Desktop** (opcional para Supabase Local)

### 1. Clonar o Repositório

```bash
git clone https://github.com/SEU_USUARIO/lecto.git
cd lecto
```

### 2. Instalar Dependências

```bash
bun install
# ou
npm install
```

### 3. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com base no `.env.example`:

```env
SUPABASE_URL="https://api-supa.rnbconsultoria.tech"
SUPABASE_PUBLISHABLE_KEY="seu_anon_key"
SUPABASE_SERVICE_ROLE_KEY="seu_service_role_key"

VITE_SUPABASE_URL="https://api-supa.rnbconsultoria.tech"
VITE_SUPABASE_PUBLISHABLE_KEY="seu_anon_key"
```

### 4. Executar em Modo de Desenvolvimento

```bash
bun dev
# ou
npm run dev
```

A aplicação estará disponível em `http://localhost:8080`.

---

## ☁️ Automação & VPS (Self-Hosted Supabase)

O projeto conta com um script utilitário em Node.js para povoar usuários iniciais e permissões no Supabase local:

```bash
bun run scripts/seed-local-users.js
```

---

## 👤 Usuários Padrão para Testes

| Função | E-mail / Usuário | Senha |
| :--- | :--- | :--- |
| **Super Admin** | `kmkz.clan@gmail.com` | `nick@1103` |
| **Gestor Escolar** | `admin@escolademo.com` | `password123` |
| **Professor** | `prof.carlos@escolademo.com` | `password123` |
| **Professor** | `prof.ana@escolademo.com` | `password123` |
| **Aluno** | `aluno.joao@escolademo.com` | PIN: `1234` |

---

## 🧪 Testes E2E

Para rodar os testes automatizados com o Playwright:

```bash
npx playwright test
```

## 🐳 Deploy no Dokploy

O projeto já está 100% configurado com um `Dockerfile` multi-stage otimizado para deploy direto no **Dokploy**.

### Passo a Passo no Painel do Dokploy:

1. **Novo Aplicativo**: Crie uma nova aplicação no Dokploy apontando para o repositório `https://github.com/Ronickbr/lecto.git` (branch `main`).
2. **Build Type**: Selecione **Dockerfile**.
3. **Porta**: Defina a porta de aplicação para `3000`.
4. **Variáveis de Ambiente (Environment Variables)**: Adicione as variáveis do seu Supabase:

   ```env
   SUPABASE_URL=https://api-supa.rnbconsultoria.tech
   SUPABASE_PUBLISHABLE_KEY=seu_anon_key
   SUPABASE_SERVICE_ROLE_KEY=seu_service_role_key
   VITE_SUPABASE_URL=https://api-supa.rnbconsultoria.tech
   VITE_SUPABASE_PUBLISHABLE_KEY=seu_anon_key
   PORT=3000
   HOST=0.0.0.0
   ```

5. **Deploy**: Clique em **Deploy**. O Dokploy compilará e executará a imagem sem nenhum erro.

---

## 📄 Licença

Este projeto é um software proprietário desenvolvido para a plataforma **Lecto**. Todos os direitos reservados.

