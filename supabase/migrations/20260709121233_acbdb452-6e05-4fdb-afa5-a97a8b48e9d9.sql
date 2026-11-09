
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS down_payment_pix numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS down_payment_cash numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS down_payment_card numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS down_payment_card_installments integer,
  ADD COLUMN IF NOT EXISTS financing_installments integer,
  ADD COLUMN IF NOT EXISTS financing_installment_value numeric;
