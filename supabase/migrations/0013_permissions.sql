-- 0013 Permissions

-- Tabelas
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT ON public.plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teachers TO authenticated;
GRANT ALL ON public.teachers TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;

GRANT SELECT, INSERT ON public.logs TO authenticated;
GRANT ALL ON public.logs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.texts TO authenticated;
GRANT ALL ON public.texts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulados TO authenticated;
GRANT ALL ON public.simulados TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulado_pages TO authenticated;
GRANT ALL ON public.simulado_pages TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulado_blocks TO authenticated;
GRANT ALL ON public.simulado_blocks TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulado_attempts TO authenticated;
GRANT ALL ON public.simulado_attempts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulado_answers TO authenticated;
GRANT ALL ON public.simulado_answers TO service_role;

GRANT ALL ON public.student_credentials TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulado_retakes TO authenticated;
GRANT ALL ON public.simulado_retakes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_keys TO authenticated;
GRANT ALL ON public.question_keys TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;

-- Colunas específicas de texts.text_type
GRANT UPDATE(text_type) ON public.texts TO authenticated;
GRANT SELECT(text_type) ON public.texts TO authenticated;
GRANT SELECT(text_type) ON public.texts TO anon;

-- Funções: revoga de PUBLIC/anon e libera para authenticated/service_role.
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.user_school_id(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_school_id(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_super_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_school_editor(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_school_editor(UUID, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_attempt_staff(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_attempt_staff(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.hash_pin(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hash_pin(TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.verify_student_pin(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_student_pin(UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

REVOKE ALL ON FUNCTION public.protect_attempt_columns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_answer_integrity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.force_log_actor() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_role_assignment() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.check_role_assignment() TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_answer_integrity() TO service_role;

-- View questions_safe (oculta gabarito/rubrica)
REVOKE ALL ON public.questions_safe FROM PUBLIC, anon;
GRANT SELECT ON public.questions_safe TO authenticated;
GRANT SELECT ON public.questions_safe TO service_role;
