
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS cnpj text;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS commission_type text NOT NULL DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS manager_commission_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transport_allowance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meal_allowance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_allowance numeric NOT NULL DEFAULT 0;

ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS transport_allowance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meal_allowance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_allowance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manager_commission numeric NOT NULL DEFAULT 0;
