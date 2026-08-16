-- 0020 Plans admin policies
-- Habilita o gerenciamento de planos pelo super admin (edição no painel admin).
-- Sem estas policies o UPDATE era bloqueado pelo RLS (só existia policy de SELECT).

-- Garante o privilégio de escrita para usuários autenticados (super admin via policy).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;

-- Super admin gerencia planos (SELECT, INSERT, UPDATE, DELETE).
CREATE POLICY "Super admin manages plans"
  ON public.plans FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));