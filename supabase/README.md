# Backend Lecto - Supabase CLI Standard

Este projeto segue o padrão oficial do Supabase CLI para garantir reprodutibilidade e isolamento.

## Como instalar o Supabase CLI

1. Instale o Docker em sua máquina.
2. Instale o Supabase CLI:
   - macOS/Linux: `brew install supabase/tap/supabase`
   - Windows (Scoop): `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git; scoop install supabase`

## Como iniciar o ambiente local

```bash
supabase init
supabase start
```

## Como aplicar as migrações e seed

```bash
supabase db reset
```

Isso irá apagar o banco local (se existir) e aplicar todas as migrações na ordem correta, seguido pelo `seed.sql`.

## Estrutura de Migrações

As migrações estão organizadas de forma modular:

- `0001-0003`: Base (Extensões, Schemas, Tipos)
- `0004-0006`: Estrutura (Tabelas, Constraints, Índices)
- `0007-0010`: Lógica e Visões (Funções, Triggers, Views)
- `0011-0013`: Segurança (RLS, Políticas, Permissões)
- `0014-0016`: Integrações (Storage, Realtime, Cron)
- `0017-0018`: Dados e Validação

## Desenvolvimento de Edge Functions

```bash
supabase functions serve
supabase functions deploy <function_name>
```
