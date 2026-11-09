ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS review_requested_by uuid,
  ADD COLUMN IF NOT EXISTS review_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_resolved_by uuid,
  ADD COLUMN IF NOT EXISTS review_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_response text;

ALTER TABLE public.contracts
  DROP CONSTRAINT IF EXISTS contracts_review_status_check;

ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_review_status_check
  CHECK (review_status IN ('ok','questionada','corrigida'));

CREATE INDEX IF NOT EXISTS idx_contracts_review_status ON public.contracts (review_status);