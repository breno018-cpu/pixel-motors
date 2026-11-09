
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS salary_additions jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS additions jsonb NOT NULL DEFAULT '[]'::jsonb;
