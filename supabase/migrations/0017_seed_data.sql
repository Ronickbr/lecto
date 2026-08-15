-- 0017 Seed Data
INSERT INTO public.plans (name, tier, price_cents, max_schools, max_teachers, max_students, max_simulados_month, features, active)
VALUES
  ('Básico', 'basic', 29900, 1, 5, 100, 5, '["1 escola", "5 professores", "100 alunos", "5 simulados/mês"]'::jsonb, true),
  ('Profissional', 'pro', 59900, 1, 20, 500, 20, '["1 escola", "20 professores", "500 alunos", "20 simulados/mês"]'::jsonb, true),
  ('Premium', 'enterprise', 99900, 1, 100, 2000, 999, '["1 escola", "professores ilimitados", "2000 alunos", "simulados ilimitados"]'::jsonb, true)
ON CONFLICT DO NOTHING;
