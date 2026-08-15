-- 0008 Triggers

-- updated_at automático nas tabelas com coluna updated_at.
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.profiles;
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.schools;
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.texts;
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON public.texts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.questions;
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.simulados;
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON public.simulados
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.simulado_pages;
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON public.simulado_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.simulado_blocks;
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON public.simulado_blocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.simulado_attempts;
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON public.simulado_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.simulado_answers;
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON public.simulado_answers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.student_credentials;
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON public.student_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.simulado_retakes;
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON public.simulado_retakes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.question_keys;
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON public.question_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.platform_settings;
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Cria o perfil automaticamente ao registrar um novo usuário.
DROP TRIGGER IF EXISTS trg_handle_new_user ON auth.users;
CREATE TRIGGER trg_handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Força o actor_user_id nos logs.
DROP TRIGGER IF EXISTS trg_force_log_actor ON public.logs;
CREATE TRIGGER trg_force_log_actor
  BEFORE INSERT ON public.logs
  FOR EACH ROW EXECUTE FUNCTION public.force_log_actor();

-- Impede que usuários comuns concedam papéis elevados.
DROP TRIGGER IF EXISTS trg_check_role_assignment ON public.user_roles;
CREATE TRIGGER trg_check_role_assignment
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.check_role_assignment();

-- Protege colunas de correção em simulado_attempts.
DROP TRIGGER IF EXISTS trg_protect_attempt_columns ON public.simulado_attempts;
CREATE TRIGGER trg_protect_attempt_columns
  BEFORE UPDATE ON public.simulado_attempts
  FOR EACH ROW EXECUTE FUNCTION public.protect_attempt_columns();

-- Protege campos de correção em simulado_answers.
DROP TRIGGER IF EXISTS trg_protect_answer_integrity ON public.simulado_answers;
CREATE TRIGGER trg_protect_answer_integrity
  BEFORE INSERT OR UPDATE ON public.simulado_answers
  FOR EACH ROW EXECUTE FUNCTION public.protect_answer_integrity();
