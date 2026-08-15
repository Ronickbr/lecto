-- 0007 Functions

-- Checa se o usuário possui um papel específico (em qualquer escola).
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Retorna a escola do usuário. Se o usuário estiver em mais de uma escola,
-- retorna NULL para evitar ambiguidade e garantir isolamento (fail-closed).
CREATE OR REPLACE FUNCTION public.user_school_id(_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
  v_count INTEGER;
BEGIN
  SELECT count(DISTINCT school_id), (array_agg(school_id ORDER BY school_id))[1]
  INTO v_count, v_school_id
  FROM public.user_roles
  WHERE user_id = _user_id
    AND school_id IS NOT NULL;

  IF v_count > 1 THEN
    RETURN NULL;
  END IF;

  RETURN v_school_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'
  );
$$;

-- Cria o perfil do usuário no primeiro login. Nunca atribui papéis aqui:
-- o provisionamento deve ser feito via painel admin ou script manual.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.hash_pin(_pin TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT crypt(_pin, gen_salt('bf'));
$$;

CREATE OR REPLACE FUNCTION public.verify_student_pin(_student_id UUID, _pin TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_credentials
    WHERE student_id = _student_id AND pin_hash = crypt(_pin, pin_hash)
  );
$$;

-- Equipe editorial da escola (school_admin ou teacher).
CREATE OR REPLACE FUNCTION public.is_school_editor(_user_id uuid, _school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND school_id = _school_id
      AND role IN ('school_admin','teacher')
  );
$$;

-- Staff com acesso de correção de uma escola (super_admin global ou editor da escola).
CREATE OR REPLACE FUNCTION public.is_attempt_staff(_school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(auth.uid()) OR public.is_school_editor(auth.uid(), _school_id);
$$;

-- Impede que alunos alterem colunas de correção/temporais do attempt.
-- service_role (auth.uid() IS NULL) e staff da escola passam sem restrição.
CREATE OR REPLACE FUNCTION public.protect_attempt_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_attempt_staff(OLD.school_id) THEN RETURN NEW; END IF;
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

-- Proteção de colunas sensíveis em simulado_answers.
-- Alunos só podem alterar a coluna 'answer' enquanto o simulado não foi submetido.
CREATE OR REPLACE FUNCTION public.protect_answer_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_staff BOOLEAN;
  _submitted TIMESTAMPTZ;
BEGIN
  SELECT (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'school_admin') OR public.has_role(auth.uid(), 'teacher'))
  INTO _is_staff;

  -- Staff (admin/professor) pode corrigir manualmente.
  IF _is_staff THEN
    RETURN NEW;
  END IF;

  -- Aluno:
  -- 1. Simulado já submetido não pode ter respostas alteradas.
  SELECT submitted_at INTO _submitted FROM public.simulado_attempts WHERE id = NEW.attempt_id;
  IF _submitted IS NOT NULL THEN
    RAISE EXCEPTION 'Simulado já enviado: respostas não podem ser alteradas';
  END IF;

  -- 2. No INSERT, zera campos de correção.
  IF TG_OP = 'INSERT' THEN
    NEW.score := NULL;
    NEW.is_correct := NULL;
    NEW.ai_feedback := NULL;
    NEW.graded_at := NULL;
    NEW.max_points := NULL;
  END IF;

  -- 3. No UPDATE, impede alteração de colunas sensíveis e chaves.
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.score IS DISTINCT FROM OLD.score OR
        NEW.is_correct IS DISTINCT FROM OLD.is_correct OR
        NEW.ai_feedback IS DISTINCT FROM OLD.ai_feedback OR
        NEW.graded_at IS DISTINCT FROM OLD.graded_at OR
        NEW.max_points IS DISTINCT FROM OLD.max_points OR
        NEW.attempt_id IS DISTINCT FROM OLD.attempt_id OR
        NEW.question_id IS DISTINCT FROM OLD.question_id) THEN
      RAISE EXCEPTION 'Acesso negado: Alunos só podem alterar o campo de resposta.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Garante que o actor de logs seja sempre o usuário autenticado.
CREATE OR REPLACE FUNCTION public.force_log_actor()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.actor_user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- Impede que usuários comuns concedam o papel super_admin.
-- service_role (auth.uid() IS NULL) e super_admin estão autorizados.
CREATE OR REPLACE FUNCTION public.check_role_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'super_admin' THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_super_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Apenas Super Administradores podem conceder o papel de super_admin.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
