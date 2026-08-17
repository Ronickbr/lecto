-- 0027 Trial plan (padrão para novas escolas)
-- Toda escola criada pelo super admin entra em trial com limites reduzidos:
-- 1 professor, 25 alunos e até 5 simulados/mês. O plano é gratuito (R$ 0) e
-- não limita a quantidade de escolas em avaliação (max_schools = 999).
INSERT INTO public.plans (name, tier, price_cents, max_schools, max_teachers, max_students, max_simulados_month, features, active)
VALUES (
  'Trial',
  'free',
  0,
  999,
  1,
  25,
  5,
  '["1 escola", "1 professor", "25 alunos", "5 simulados/mês", "Período de avaliação gratuito"]'::jsonb,
  true
)
ON CONFLICT (tier) DO NOTHING;