-- 0004 Tables
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tier public.plan_tier NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  max_schools INTEGER NOT NULL DEFAULT 1,
  max_teachers INTEGER NOT NULL DEFAULT 5,
  max_students INTEGER NOT NULL DEFAULT 100,
  max_simulados_month INTEGER NOT NULL DEFAULT 10,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  cnpj TEXT,
  city TEXT,
  state TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#2563EB',
  plan_id UUID REFERENCES public.plans(id),
  subscription_status public.subscription_status NOT NULL DEFAULT 'trial',
  subscription_expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, school_id)
);

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  status public.subscription_status NOT NULL DEFAULT 'trial',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade TEXT,
  academic_year INTEGER,
  class_code TEXT NOT NULL UNIQUE,
  teacher_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  subjects TEXT[] DEFAULT '{}',
  hire_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(school_id, email)
);

CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  student_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(school_id, student_code)
);

CREATE TABLE public.logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.texts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  category public.text_category NOT NULL DEFAULT 'literary',
  level public.text_level NOT NULL DEFAULT 'medium',
  text_type text,
  source text,
  tags text[] NOT NULL DEFAULT '{}',
  is_public boolean NOT NULL DEFAULT false,
  word_count integer,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  text_id uuid REFERENCES public.texts(id) ON DELETE SET NULL,
  statement text NOT NULL,
  q_type public.question_type NOT NULL DEFAULT 'multiple_choice',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  pirls_process public.pirls_process NOT NULL,
  points integer NOT NULL DEFAULT 1,
  explanation text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.simulados (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  time_limit_minutes integer NOT NULL DEFAULT 60,
  max_attempts integer NOT NULL DEFAULT 1,
  status public.simulado_status NOT NULL DEFAULT 'draft',
  pirls_target jsonb NOT NULL DEFAULT '{"locate_information":25,"straightforward_inference":25,"interpret_integrate":25,"evaluate_critique":25}'::jsonb,
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.simulado_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  simulado_id uuid NOT NULL REFERENCES public.simulados(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  title text,
  instructions text,
  text_id uuid REFERENCES public.texts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.simulado_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id uuid NOT NULL REFERENCES public.simulado_pages(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  b_type public.block_type NOT NULL,
  question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE,
  text_id uuid REFERENCES public.texts(id) ON DELETE SET NULL,
  content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.simulado_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulado_id uuid NOT NULL REFERENCES public.simulados(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  submitted_at timestamptz,
  active_page_id uuid,
  opened_page_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_score integer,
  max_score integer,
  process_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  graded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.simulado_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.simulado_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer text,
  score integer,
  max_points integer,
  is_correct boolean,
  ai_feedback text,
  graded_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(attempt_id, question_id)
);

CREATE TABLE public.student_credentials (
  student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  auth_email text,
  guardian_email text,
  guardian_phone text,
  birth_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.simulado_retakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulado_id uuid NOT NULL REFERENCES public.simulados(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.question_keys (
  question_id uuid PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
  school_id uuid NOT NULL,
  correct_answer text,
  rubric text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
