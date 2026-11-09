ALTER TABLE public.chassis_patterns
  ADD COLUMN IF NOT EXISTS default_purchase_price numeric,
  ADD COLUMN IF NOT EXISTS default_sale_price numeric;