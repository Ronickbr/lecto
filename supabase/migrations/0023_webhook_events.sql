-- Idempotency ledger for payment webhooks.
-- Prevents duplicate processing when providers retry deliveries.
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'other',
  status TEXT NOT NULL DEFAULT 'processed',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- The webhook handler runs with the service role key (bypasses RLS).
-- No policies are granted to authenticated/anonymous roles on purpose.

GRANT ALL ON public.webhook_events TO service_role;

CREATE INDEX IF NOT EXISTS idx_webhook_events_transaction_id
  ON public.webhook_events(transaction_id);
