-- 0003 Types
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('super_admin', 'school_admin', 'teacher', 'student');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_tier') THEN
    CREATE TYPE public.plan_tier AS ENUM ('free', 'basic', 'pro', 'enterprise');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'suspended', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pirls_process') THEN
    CREATE TYPE public.pirls_process AS ENUM ('locate_information', 'straightforward_inference', 'interpret_integrate', 'evaluate_critique');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'text_category') THEN
    CREATE TYPE public.text_category AS ENUM ('literary', 'informational', 'mixed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'text_level') THEN
    CREATE TYPE public.text_level AS ENUM ('easy', 'medium', 'hard');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_type') THEN
    CREATE TYPE public.question_type AS ENUM ('multiple_choice', 'open');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'simulado_status') THEN
    CREATE TYPE public.simulado_status AS ENUM ('draft', 'published', 'archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'block_type') THEN
    CREATE TYPE public.block_type AS ENUM ('instruction', 'text', 'question');
  END IF;
END $$;
