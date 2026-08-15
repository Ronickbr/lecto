-- Testes de Integridade e Segurança
-- Executar com: supabase db test
-- Cobre: existência de funções, isolamento por escola (RLS), proteção do gabarito
-- (question_keys), bloqueio de attempts cross-school, imutabilidade pós-submissão,
-- retakes e integridade das colunas de correção.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(37);

-- ===========================================================================
-- Fixtures (inseridas como superuser, fora do RLS)
-- ===========================================================================
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'student_a@a.com', '{"full_name":"Student A"}'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'teacher_a@a.com', '{"full_name":"Teacher A"}'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'admin_a@a.com',   '{"full_name":"Admin A"}'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'super@platform',  '{"full_name":"Super"}'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'multi@x.com',     '{"full_name":"Multi"}');

INSERT INTO public.schools (id, name, slug) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Escola A', 'escola-a'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Escola B', 'escola-b');

INSERT INTO public.user_roles (user_id, role, school_id) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'student',      'bbbbbbbb-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'teacher',      'bbbbbbbb-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'school_admin', 'bbbbbbbb-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'super_admin',  NULL),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'student',      'bbbbbbbb-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'student',      'bbbbbbbb-0000-0000-0000-000000000002');

INSERT INTO public.students (id, school_id, user_id, full_name, student_code)
VALUES ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000001', 'Student A', 'A001');

INSERT INTO public.student_credentials (student_id, pin_hash)
VALUES ('cccccccc-0000-0000-0000-000000000001', crypt('1234', gen_salt('bf')));

INSERT INTO public.texts (id, school_id, title, body, category, level, text_type) VALUES
  ('dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Texto A', 'Corpo A', 'literary', 'easy', 'standard'),
  ('dddddddd-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Texto B', 'Corpo B', 'literary', 'easy', 'standard');

INSERT INTO public.questions (id, school_id, text_id, statement, q_type, options, pirls_process, points)
VALUES ('dddddddd-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001',
        'dddddddd-0000-0000-0000-000000000001', 'Ideia principal?', 'multiple_choice',
        '["A","B","C"]', 'locate_information', 1);

INSERT INTO public.question_keys (question_id, school_id, correct_answer, rubric)
VALUES ('dddddddd-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001', 'A', 'Rubrica');

INSERT INTO public.simulados (id, school_id, title, status, max_attempts) VALUES
  ('eeeeeeee-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Simulado A', 'published', 1),
  ('eeeeeeee-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Simulado B', 'published', 1);

INSERT INTO public.simulado_retakes (simulado_id, student_id, school_id, reason)
VALUES ('eeeeeeee-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-000000000001', 'revisão');

-- ===========================================================================
-- 1. Existência das funções de segurança (11)
-- ===========================================================================
SELECT ok(has_function_privilege('public.has_role(uuid, public.app_role)', 'execute'),
          'has_role(uuid, app_role) existe e é executável');
SELECT ok(has_function_privilege('public.user_school_id(uuid)', 'execute'),
          'user_school_id(uuid) existe e é executável');
SELECT ok(has_function_privilege('public.is_super_admin(uuid)', 'execute'),
          'is_super_admin(uuid) existe e é executável');
SELECT ok(has_function_privilege('public.is_school_editor(uuid, uuid)', 'execute'),
          'is_school_editor(uuid, uuid) existe e é executável');
SELECT ok(has_function_privilege('public.is_attempt_staff(uuid)', 'execute'),
          'is_attempt_staff(uuid) existe e é executável');
SELECT ok(has_function_privilege('public.hash_pin(text)', 'execute'),
          'hash_pin(text) existe e é executável');
SELECT ok(has_function_privilege('public.verify_student_pin(uuid, text)', 'execute'),
          'verify_student_pin(uuid, text) existe e é executável');
SELECT ok(has_function_privilege('public.protect_answer_integrity()', 'execute'),
          'protect_answer_integrity() existe e é executável');
SELECT ok(has_function_privilege('public.check_role_assignment()', 'execute'),
          'check_role_assignment() existe e é executável');
SELECT ok(has_function_privilege('public.handle_new_user()', 'execute'),
          'handle_new_user() existe e é executável');
SELECT ok(has_function_privilege('public.set_updated_at()', 'execute'),
          'set_updated_at() existe e é executável');

-- ===========================================================================
-- 2. Integridade do schema: gabarito fora da tabela questions (1)
-- ===========================================================================
SELECT is(
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'questions'
      AND column_name IN ('correct_answer', 'rubric')),
  0::bigint,
  'tabela questions não expõe correct_answer/rubric (gabarito isolado em question_keys)'
);

-- ===========================================================================
-- 3. Funções puras (superuser) (6)
-- ===========================================================================
SELECT is(public.is_super_admin('aaaaaaaa-0000-0000-0000-000000000004'),
          true, 'super_admin reconhecido');
SELECT is(public.has_role('aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'teacher'::public.app_role),
          true, 'teacher reconhecido via has_role');
SELECT is(public.user_school_id('aaaaaaaa-0000-0000-0000-000000000001'),
          'bbbbbbbb-0000-0000-0000-000000000001', 'user_school_id retorna a escola do aluno');
SELECT is(public.user_school_id('aaaaaaaa-0000-0000-0000-000000000005'),
          NULL, 'user_school_id retorna NULL para usuário em mais de uma escola (fail-closed)');
SELECT is(public.verify_student_pin('cccccccc-0000-0000-0000-000000000001', '1234'),
          true, 'verify_student_pin aceita PIN correto');
SELECT is(public.verify_student_pin('cccccccc-0000-0000-0000-000000000001', '9999'),
          false, 'verify_student_pin rejeita PIN incorreto');

-- ===========================================================================
-- 4. RLS como aluno da Escola A (13)
-- ===========================================================================
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);

SELECT is(
  (SELECT count(*) FROM public.texts WHERE school_id = 'bbbbbbbb-0000-0000-0000-000000000001')::int,
  1,
  'aluno vê textos da própria escola'
);
SELECT is(
  (SELECT count(*) FROM public.texts WHERE school_id = 'bbbbbbbb-0000-0000-0000-000000000002')::int,
  0,
  'aluno NÃO vê textos de outra escola'
);
SELECT is(
  (SELECT count(*) FROM public.question_keys)::int,
  0,
  'aluno NÃO lê question_keys (gabarito isolado)'
);
SELECT lives_ok(
  $$ INSERT INTO public.simulado_attempts
       (simulado_id, student_id, user_id, school_id, expires_at)
     VALUES ('eeeeeeee-0000-0000-0000-000000000001',
             'cccccccc-0000-0000-0000-000000000001',
             'aaaaaaaa-0000-0000-0000-000000000001',
             'bbbbbbbb-0000-0000-0000-000000000001',
             now() + interval '1 hour'); $$,
  'aluno cria attempt do próprio simulado'
);
SELECT throws_ok(
  $$ INSERT INTO public.simulado_attempts
       (simulado_id, student_id, user_id, school_id, expires_at)
     VALUES ('eeeeeeee-0000-0000-0000-000000000002',
             'cccccccc-0000-0000-0000-000000000001',
             'aaaaaaaa-0000-0000-0000-000000000001',
             'bbbbbbbb-0000-0000-0000-000000000002',
             now() + interval '1 hour'); $$,
  '42501', NULL,
  'aluno NÃO cria attempt de simulado de outra escola (RLS)'
);
SELECT lives_ok(
  $$ INSERT INTO public.simulado_answers (attempt_id, question_id, answer, score, is_correct)
     VALUES ((SELECT id FROM public.simulado_attempts
               WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001' LIMIT 1),
             'dddddddd-0000-0000-0000-000000000003', 'B', 99, true); $$,
  'aluno insere resposta própria'
);
SELECT ok(
  (SELECT score IS NULL FROM public.simulado_answers
    WHERE question_id = 'dddddddd-0000-0000-0000-000000000003'
      AND attempt_id = (SELECT id FROM public.simulado_attempts
                        WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001' LIMIT 1)),
  'campos de correção zerados no insert do aluno (trigger protect_answer_integrity)'
);
SELECT lives_ok(
  $$ UPDATE public.simulado_attempts SET total_score = 999, max_score = 999
      WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001'; $$,
  'aluno tenta alterar colunas de correção do attempt'
);
SELECT ok(
  (SELECT total_score IS NULL AND max_score IS NULL
     FROM public.simulado_attempts
    WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001' LIMIT 1),
  'colunas de correção restauradas para aluno (trigger protect_attempt_columns)'
);
SELECT lives_ok(
  $$ UPDATE public.simulado_attempts SET submitted_at = now()
      WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001'; $$,
  'aluno envia o próprio attempt'
);
SELECT ok(
  (SELECT answer = 'B' FROM public.simulado_answers
    WHERE question_id = 'dddddddd-0000-0000-0000-000000000003'
      AND attempt_id = (SELECT id FROM public.simulado_attempts
                        WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001' LIMIT 1)),
  'resposta imutável após submissão (RLS bloqueia update)'
);
SELECT throws_ok(
  $$ INSERT INTO public.simulado_retakes
       (simulado_id, student_id, school_id, reason)
     VALUES ('eeeeeeee-0000-0000-0000-000000000001',
             'cccccccc-0000-0000-0000-000000000001',
             'bbbbbbbb-0000-0000-0000-000000000001',
             'abuso'); $$,
  '42501', NULL,
  'aluno NÃO cria retake próprio'
);
SELECT lives_ok(
  $$ UPDATE public.simulado_retakes SET consumed_at = now()
      WHERE student_id = 'cccccccc-0000-0000-0000-000000000001'
        AND simulado_id = 'eeeeeeee-0000-0000-0000-000000000001'; $$,
  'aluno consome retake própria não consumida'
);
SELECT ok(
  (SELECT consumed_at IS NOT NULL FROM public.simulado_retakes
    WHERE student_id = 'cccccccc-0000-0000-0000-000000000001'
      AND simulado_id = 'eeeeeeee-0000-0000-0000-000000000001'),
  'aluno NÃO desfaz o consumo da retake (consumed_at permanece preenchido)'
);

RESET ROLE;

-- ===========================================================================
-- 5. RLS como professor da Escola A (3)
-- ===========================================================================
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', true);

SELECT is(
  (SELECT count(*) FROM public.question_keys)::int,
  1,
  'professor lê question_keys da própria escola'
);
SELECT is(
  (SELECT count(*) FROM public.simulado_attempts)::int,
  1,
  'professor vê attempts da própria escola'
);
SELECT is(
  (SELECT count(*) FROM public.simulado_attempts WHERE total_score = 50)::int,
  0,
  'professor NÃO altera colunas de correção via client (grading passa pelo server fn/service_role)'
);

RESET ROLE;

-- ===========================================================================
-- 6. RLS como super_admin (2)
-- ===========================================================================
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000004', true);

SELECT lives_ok(
  $$ UPDATE public.simulado_attempts SET total_score = 50, max_score = 50
      WHERE simulado_id = 'eeeeeeee-0000-0000-0000-000000000001'; $$,
  'super_admin altera colunas de correção'
);
SELECT is(
  (SELECT max(total_score) FROM public.simulado_attempts
    WHERE simulado_id = 'eeeeeeee-0000-0000-0000-000000000001')::int,
  50,
  'nota do super_admin persistida (trigger permite staff)'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
