-- 0021 Deduplicate plans per tier
-- O seed anterior (0017 + seed.sql) inseria planos duplicados por tier porque
-- não havia constraint UNIQUE em plans.tier. Isso fazia o card do painel
-- exibir dados "errados" após edição (a query deduplica por tier e podia
-- pegar a duplicata com valores antigos).
--
-- 1) Reatribui escolas que apontam para uma duplicata ao plano mantido.
-- 2) Remove os planos duplicados (mantém um por tier).
-- 3) Adiciona UNIQUE (tier) para impedir novas duplicatas.

-- Mantém o plano mais antigo de cada tier (determinístico: created_at, id).
WITH kept AS (
  SELECT DISTINCT ON (tier) id, tier
  FROM public.plans
  ORDER BY tier, created_at ASC, id ASC
)
UPDATE public.schools s
SET plan_id = k.id
FROM kept k
WHERE s.plan_id IS NOT NULL
  AND s.plan_id <> k.id
  AND EXISTS (
    SELECT 1 FROM public.plans p WHERE p.id = s.plan_id AND p.tier = k.tier
  );

WITH kept AS (
  SELECT DISTINCT ON (tier) id, tier
  FROM public.plans
  ORDER BY tier, created_at ASC, id ASC
)
DELETE FROM public.plans p
WHERE NOT EXISTS (
  SELECT 1 FROM kept k WHERE k.id = p.id
);

ALTER TABLE public.plans ADD CONSTRAINT plans_tier_unique UNIQUE (tier);