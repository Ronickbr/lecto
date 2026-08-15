-- Seed Data Essencial

-- Planos Padrão
INSERT INTO public.plans (id, name, tier, price_cents, max_schools, max_teachers, max_students, max_simulados_month, features, active)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Básico', 'basic', 29900, 1, 5, 100, 5, '["1 escola", "5 professores", "100 alunos", "5 simulados/mês"]'::jsonb, true),
  ('c0000000-0000-0000-0000-000000000002', 'Profissional', 'pro', 59900, 1, 20, 500, 20, '["1 escola", "20 professores", "500 alunos", "20 simulados/mês"]'::jsonb, true),
  ('c0000000-0000-0000-0000-000000000003', 'Premium', 'enterprise', 99900, 1, 100, 2000, 999, '["1 escola", "professores ilimitados", "2000 alunos", "simulados ilimitados"]'::jsonb, true)
ON CONFLICT DO NOTHING;

-- Escola Demo
INSERT INTO public.schools (id, name, slug, city, state, plan_id, subscription_status)
VALUES (
  'e0000000-0000-0000-0000-000000000001',
  'Escola Demo Lecto',
  'escola-demo',
  'São Paulo',
  'SP',
  'c0000000-0000-0000-0000-000000000002',
  'active'
) ON CONFLICT (slug) DO NOTHING;

-- Turma Demo
INSERT INTO public.classes (id, school_id, name, grade, academic_year, class_code)
VALUES (
  'f0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000001',
  '5º Ano A',
  '5º Ano',
  2026,
  'TURMA-5A'
) ON CONFLICT (class_code) DO NOTHING;

-- 1. Super Admin (kmkz.clan@gmail.com / nick@1103)
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '9b9f0a33-868b-40dd-bc05-461e6053eeb7',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'kmkz.clan@gmail.com',
  extensions.crypt('nick@1103', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Super Admin Lecto"}'::jsonb,
  now(), now()
) ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role, school_id)
SELECT id, 'super_admin'::public.app_role, NULL
FROM auth.users WHERE email = 'kmkz.clan@gmail.com'
ON CONFLICT DO NOTHING;

-- 2. School Admin (admin@escolademo.com / password123)
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '185bd839-3b48-4866-bb91-66030ca4c590',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'admin@escolademo.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Gestor Escola Demo"}'::jsonb,
  now(), now()
) ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role, school_id)
SELECT id, 'school_admin'::public.app_role, 'e0000000-0000-0000-0000-000000000001'::uuid
FROM auth.users WHERE email = 'admin@escolademo.com'
ON CONFLICT DO NOTHING;

-- 3. Teachers (prof.carlos@escolademo.com, prof.ana@escolademo.com / password123)
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
(
  'fee92a4e-57d5-4291-9d23-b9510729dfa7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'prof.carlos@escolademo.com', extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Prof. Carlos Silva"}'::jsonb, now(), now()
),
(
  '0fac89f6-181f-4885-bf45-8eaf1c6bc756', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'prof.ana@escolademo.com', extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Profa. Ana Souza"}'::jsonb, now(), now()
) ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role, school_id)
SELECT id, 'teacher'::public.app_role, 'e0000000-0000-0000-0000-000000000001'::uuid
FROM auth.users WHERE email IN ('prof.carlos@escolademo.com', 'prof.ana@escolademo.com')
ON CONFLICT DO NOTHING;

INSERT INTO public.teachers (user_id, school_id, full_name, email, subjects)
SELECT id, 'e0000000-0000-0000-0000-000000000001'::uuid, 'Prof. Carlos Silva', 'prof.carlos@escolademo.com', ARRAY['Língua Portuguesa', 'Leitura']
FROM auth.users WHERE email = 'prof.carlos@escolademo.com'
ON CONFLICT (school_id, email) DO NOTHING;

INSERT INTO public.teachers (user_id, school_id, full_name, email, subjects)
SELECT id, 'e0000000-0000-0000-0000-000000000001'::uuid, 'Profa. Ana Souza', 'prof.ana@escolademo.com', ARRAY['Literatura', 'Redação']
FROM auth.users WHERE email = 'prof.ana@escolademo.com'
ON CONFLICT (school_id, email) DO NOTHING;

-- 4. Students (aluno.joao@escolademo.com, aluno.maria@escolademo.com / password123)
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
(
  '27b16e27-e2a2-42c5-91ba-8bacd22021a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'aluno.joao@escolademo.com', extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"João Pedro Santos"}'::jsonb, now(), now()
),
(
  '18842297-cd71-4dc0-8714-60f40fac66c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'aluno.maria@escolademo.com', extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Maria Eduarda Lima"}'::jsonb, now(), now()
) ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role, school_id)
SELECT id, 'student'::public.app_role, 'e0000000-0000-0000-0000-000000000001'::uuid
FROM auth.users WHERE email IN ('aluno.joao@escolademo.com', 'aluno.maria@escolademo.com')
ON CONFLICT DO NOTHING;

INSERT INTO public.students (id, school_id, class_id, user_id, full_name, student_code)
SELECT 'd0000000-0000-0000-0000-000000000001'::uuid, 'e0000000-0000-0000-0000-000000000001'::uuid, 'f0000000-0000-0000-0000-000000000001'::uuid, id, 'João Pedro Santos', 'ALU-001'
FROM auth.users WHERE email = 'aluno.joao@escolademo.com'
ON CONFLICT (school_id, student_code) DO NOTHING;

INSERT INTO public.students (id, school_id, class_id, user_id, full_name, student_code)
SELECT 'd0000000-0000-0000-0000-000000000002'::uuid, 'e0000000-0000-0000-0000-000000000001'::uuid, 'f0000000-0000-0000-0000-000000000001'::uuid, id, 'Maria Eduarda Lima', 'ALU-002'
FROM auth.users WHERE email = 'aluno.maria@escolademo.com'
ON CONFLICT (school_id, student_code) DO NOTHING;

INSERT INTO public.student_credentials (student_id, pin_hash, auth_email) VALUES
('d0000000-0000-0000-0000-000000000001', public.hash_pin('1234'), 'aluno.joao@escolademo.com'),
('d0000000-0000-0000-0000-000000000002', public.hash_pin('1234'), 'aluno.maria@escolademo.com')
ON CONFLICT DO NOTHING;
