CREATE INDEX idx_texts_school ON public.texts(school_id);

CREATE INDEX idx_texts_category ON public.texts(category);

CREATE INDEX idx_texts_level ON public.texts(level);

CREATE INDEX idx_questions_school ON public.questions(school_id);

CREATE INDEX idx_questions_text ON public.questions(text_id);

CREATE INDEX idx_questions_process ON public.questions(pirls_process);

CREATE INDEX idx_simulados_school ON public.simulados(school_id);

CREATE INDEX idx_simulados_class ON public.simulados(class_id);

CREATE INDEX idx_simulados_status ON public.simulados(status);

CREATE INDEX idx_simulado_pages_simulado ON public.simulado_pages(simulado_id, position);

CREATE INDEX idx_simulado_blocks_page ON public.simulado_blocks(page_id, position);

CREATE INDEX simulado_attempts_school_idx ON public.simulado_attempts(school_id);

CREATE INDEX idx_simulado_retakes_lookup ON public.simulado_retakes (simulado_id, student_id);

CREATE INDEX IF NOT EXISTS idx_classes_school_id ON public.classes(school_id);

CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON public.classes(teacher_id);

CREATE INDEX IF NOT EXISTS idx_logs_school_id ON public.logs(school_id);

CREATE INDEX IF NOT EXISTS idx_logs_actor_user_id ON public.logs(actor_user_id);

CREATE INDEX IF NOT EXISTS idx_questions_created_by ON public.questions(created_by);

CREATE INDEX IF NOT EXISTS idx_schools_plan_id ON public.schools(plan_id);

CREATE INDEX IF NOT EXISTS idx_schools_created_by ON public.schools(created_by);

CREATE INDEX IF NOT EXISTS idx_simulado_answers_question_id ON public.simulado_answers(question_id);

CREATE INDEX IF NOT EXISTS idx_simulado_blocks_text_id ON public.simulado_blocks(text_id);

CREATE INDEX IF NOT EXISTS idx_simulado_blocks_question_id ON public.simulado_blocks(question_id);

CREATE INDEX IF NOT EXISTS idx_simulado_pages_text_id ON public.simulado_pages(text_id);

CREATE INDEX IF NOT EXISTS idx_simulado_retakes_student_id ON public.simulado_retakes(student_id);

CREATE INDEX IF NOT EXISTS idx_simulado_retakes_granted_by ON public.simulado_retakes(granted_by);

CREATE INDEX IF NOT EXISTS idx_simulado_retakes_school_id ON public.simulado_retakes(school_id);

CREATE INDEX IF NOT EXISTS idx_simulados_created_by ON public.simulados(created_by);

CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students(user_id);

CREATE INDEX IF NOT EXISTS idx_students_class_id ON public.students(class_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_school_id ON public.subscriptions(school_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON public.subscriptions(plan_id);

CREATE INDEX IF NOT EXISTS idx_teachers_user_id ON public.teachers(user_id);

CREATE INDEX IF NOT EXISTS idx_texts_created_by ON public.texts(created_by);

CREATE INDEX IF NOT EXISTS idx_user_roles_school_id ON public.user_roles(school_id);

CREATE INDEX IF NOT EXISTS idx_simulado_answers_attempt_id ON public.simulado_answers(attempt_id);

CREATE INDEX IF NOT EXISTS idx_simulado_attempts_student_id ON public.simulado_attempts(student_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

CREATE INDEX IF NOT EXISTS idx_students_school_id ON public.students(school_id);

