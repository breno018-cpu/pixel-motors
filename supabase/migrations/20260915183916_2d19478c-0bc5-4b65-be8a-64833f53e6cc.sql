ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS sale_group_id uuid;
CREATE INDEX IF NOT EXISTS contracts_sale_group_id_idx ON public.contracts (sale_group_id);