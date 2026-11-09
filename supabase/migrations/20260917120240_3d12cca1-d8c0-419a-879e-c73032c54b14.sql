ALTER TABLE public.vehicle_models
  ADD COLUMN IF NOT EXISTS promo_price numeric,
  ADD COLUMN IF NOT EXISTS promo_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_label text,
  ADD COLUMN IF NOT EXISTS promo_ends_on date;