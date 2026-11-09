-- Drop stock sync trigger (if it exists) — sync agora é throttled server-side
DROP TRIGGER IF EXISTS trg_vehicles_stock_sync ON public.vehicles;
DROP TRIGGER IF EXISTS vehicles_stock_sync ON public.vehicles;
DROP TRIGGER IF EXISTS notify_stock_sync_trg ON public.vehicles;

-- Payroll batches
CREATE TABLE IF NOT EXISTS public.payroll_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year SMALLINT NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','aprovado','fechado')),
  total_bruto NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_liquido NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_encargos NUMERIC(12,2) NOT NULL DEFAULT 0,
  employee_count INTEGER NOT NULL DEFAULT 0,
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (year, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_batches TO authenticated;
GRANT ALL ON public.payroll_batches TO service_role;

ALTER TABLE public.payroll_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Elevated can view batches"
  ON public.payroll_batches FOR SELECT TO authenticated
  USING (public.has_elevated_access(auth.uid()));

CREATE POLICY "Elevated can insert batches"
  ON public.payroll_batches FOR INSERT TO authenticated
  WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE POLICY "Elevated can update batches"
  ON public.payroll_batches FOR UPDATE TO authenticated
  USING (public.has_elevated_access(auth.uid()))
  WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE POLICY "Admins can delete batches"
  ON public.payroll_batches FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER payroll_batches_updated_at
  BEFORE UPDATE ON public.payroll_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Payslips: batch link + breakdown + delivery marks
ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.payroll_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS breakdown JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sent_email_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_whatsapp_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_payslips_batch ON public.payslips(batch_id);