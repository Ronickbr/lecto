-- 0028 Trial plan: limita a 1 escola em avaliação.
-- Corrige o Trial criado em 0027 (max_schools = 999) para permitir apenas
-- uma escola por avaliação. A features "1 escola" já refletia o limite.
UPDATE public.plans
SET max_schools = 1
WHERE tier = 'free' AND active = true;