ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS sale_channel text NOT NULL DEFAULT 'interna',
  ADD COLUMN IF NOT EXISTS evidence_paths text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS external_data jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS contracts_sale_channel_idx ON public.contracts (sale_channel);