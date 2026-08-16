-- Checkout ledger: one row per payment link/checkout created for a school.
-- Stores the provider reference (external_reference for Mercado Pago,
-- order_nsu for InfinityPay) used by webhooks to activate the subscription.
CREATE TABLE IF NOT EXISTS public.checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL DEFAULT 'mercado_pago' CHECK (provider IN ('mercado_pago', 'infinitypay')),
  external_reference TEXT NOT NULL UNIQUE,
  checkout_url TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

ALTER TABLE public.checkouts ENABLE ROW LEVEL SECURITY;

-- The webhook handler and checkout creation run with the service role key
-- (bypasses RLS). No policies are granted to authenticated/anonymous roles.
GRANT ALL ON public.checkouts TO service_role;

CREATE INDEX IF NOT EXISTS idx_checkouts_school_id
  ON public.checkouts(school_id);
CREATE INDEX IF NOT EXISTS idx_checkouts_provider_reference
  ON public.checkouts(provider, external_reference);

-- Uma assinatura ativa por escola; permite upsert do webhook por school_id.
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_school_id_key;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_school_id_key UNIQUE (school_id);