-- 0024 RLS & multi-tenancy hardening
-- Auditoria de segurança: corrige os achados H-1, H-2, M-1, M-2, L-2 e
-- faz backfill de profiles a partir de auth.users (H-3).

-- ============================================================================
-- H-1: submitted_at imutável após a submissão
-- O aluno só pode fazer a transição submitted_at: NULL -> valor (submissão).
-- Depois de submetido, não pode limpar nem alterar o timestamp, nem editar o
-- restante da tentativa. O service_role (correção) e o staff continuam livres.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.protect_attempt_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_attempt_staff(OLD.school_id) THEN RETURN NEW; END IF;

  -- Aluno não pode des-submeter: uma vez enviado, submitted_at é congelado.
  IF OLD.submitted_at IS NOT NULL AND NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
    RAISE EXCEPTION 'Simulado já enviado: data de envio não pode ser alterada';
  END IF;
  -- Impede limpar a submissão (transição valor -> NULL).
  IF NEW.submitted_at IS NULL AND OLD.submitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Simulado já enviado: data de envio não pode ser limpa';
  END IF;

  NEW.total_score := OLD.total_score;
  NEW.max_score := OLD.max_score;
  NEW.graded_at := OLD.graded_at;
  NEW.process_scores := OLD.process_scores;
  NEW.expires_at := OLD.expires_at;
  NEW.started_at := OLD.started_at;
  NEW.school_id := OLD.school_id;
  NEW.simulado_id := OLD.simulado_id;
  NEW.student_id := OLD.student_id;
  NEW.user_id := OLD.user_id;
  RETURN NEW;
END;
$$;

-- H-1: aluno não pode apagar a própria tentativa (apenas ler/criar/editar).
DROP POLICY IF EXISTS "Student manages own attempts" ON public.simulado_attempts;
CREATE POLICY "Student select own attempts" ON public.simulado_attempts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Student insert own attempts" ON public.simulado_attempts
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND school_id = public.user_school_id(auth.uid())
    AND EXISTS (SELECT 1 FROM public.students st WHERE st.id = student_id AND st.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.simulados s WHERE s.id = simulado_id AND s.school_id = public.user_school_id(auth.uid()))
  );
CREATE POLICY "Student update own attempts" ON public.simulado_attempts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND school_id = public.user_school_id(auth.uid())
    AND EXISTS (SELECT 1 FROM public.students st WHERE st.id = student_id AND st.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.simulados s WHERE s.id = simulado_id AND s.school_id = public.user_school_id(auth.uid()))
  );

-- ============================================================================
-- H-2: school_admin não altera campos de faturamento/assinatura da escola.
-- Tira UPDATE genérico de authenticated e concede apenas colunas de conteúdo.
-- O restante continua nas mãos de super_admin (policy própria) e service_role.
-- ============================================================================
DROP POLICY IF EXISTS "School admin updates own school" ON public.schools;

REVOKE UPDATE ON public.schools FROM authenticated;

GRANT UPDATE (name, slug, cnpj, city, state, logo_url, primary_color) ON public.schools TO authenticated;

CREATE POLICY "School admin updates own school" ON public.schools
  FOR UPDATE
  USING (id = public.user_school_id(auth.uid()) AND public.has_role(auth.uid(),'school_admin'));

-- ============================================================================
-- M-1: usuários não podiam escrever em user_roles porque só havia GRANT SELECT,
-- tornando a policy de gerenciamento do super_admin morta.
-- Restaura DML para authenticated; a policy RLS mantém o controle de quem
-- pode escrever (super_admin) e a trigger check_role_assignment reforça.
-- ============================================================================
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- ============================================================================
-- M-2: enumeração de alunos entre membros da escola.
-- "School members view students" permitia que qualquer membro (inclusive
-- alunos) listasse todos os alunos da escola. Restringe a staff.
-- O aluno continua vendo apenas o próprio registro (policy já existente).
-- ============================================================================
DROP POLICY IF EXISTS "School members view students" ON public.students;
CREATE POLICY "School staff view students" ON public.students
  FOR SELECT
  USING (
    school_id = public.user_school_id(auth.uid())
    AND (public.has_role(auth.uid(),'school_admin') OR public.has_role(auth.uid(),'teacher'))
  );

-- ============================================================================
-- L-2: INSERT em logs vinculado à escola do usuário.
-- Um membro autenticado não pode gravar logs atribuídos a outra escola.
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated can insert logs" ON public.logs;
CREATE POLICY "Authenticated can insert logs" ON public.logs
  FOR INSERT
  WITH CHECK (
    actor_user_id = auth.uid()
    AND (school_id IS NULL OR school_id = public.user_school_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  );

-- ============================================================================
-- H-3: backfill de profiles a partir de auth.users.
-- Produção tinha profiles vazio (isso quebrava "Usuários Globais"). Cria
-- perfis para usuários existentes sem perfil, usando user_metadata.full_name.
-- ============================================================================
INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
  au.created_at,
  au.created_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Auditoria básica de integridade: webhook_events não pode ser escrito por
-- roles de aplicação (apenas service_role via handler).
-- ============================================================================
REVOKE ALL ON public.webhook_events FROM authenticated, anon;
