CREATE OR REPLACE VIEW public.questions_safe
WITH (security_invoker = off) AS
SELECT
  q.id,
  q.school_id,
  q.text_id,
  q.statement,
  q.q_type,
  q.options,
  q.pirls_process,
  q.points,
  q.created_at,
  q.updated_at
FROM public.questions q
WHERE public.is_super_admin(auth.uid())
   OR q.school_id = public.user_school_id(auth.uid());

