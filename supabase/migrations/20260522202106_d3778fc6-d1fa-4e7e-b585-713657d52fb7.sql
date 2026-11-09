
CREATE TABLE public.bank_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  client_id TEXT,
  client_secret TEXT,
  api_environment TEXT NOT NULL DEFAULT 'sandbox',
  partner_code TEXT,
  extra_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, bank_code)
);

ALTER TABLE public.bank_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Elevated users manage bank credentials"
ON public.bank_credentials FOR ALL TO authenticated
USING (has_elevated_access(auth.uid()))
WITH CHECK (has_elevated_access(auth.uid()));

CREATE TRIGGER bank_credentials_updated_at
BEFORE UPDATE ON public.bank_credentials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.financing_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  vehicle_id UUID,
  bank_code TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_document TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  customer_income NUMERIC,
  customer_birthdate DATE,
  vehicle_value NUMERIC NOT NULL,
  down_payment NUMERIC NOT NULL DEFAULT 0,
  installments INTEGER NOT NULL,
  financed_amount NUMERIC NOT NULL,
  monthly_rate NUMERIC,
  installment_value NUMERIC,
  total_amount NUMERIC,
  cet NUMERIC,
  status TEXT NOT NULL DEFAULT 'pendente',
  response_data JSONB,
  error_message TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.financing_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View simulations by role"
ON public.financing_simulations FOR SELECT TO authenticated
USING (has_elevated_access(auth.uid()) OR created_by = auth.uid());

CREATE POLICY "Create simulations"
ON public.financing_simulations FOR INSERT TO authenticated
WITH CHECK (has_elevated_access(auth.uid()) OR created_by = auth.uid());

CREATE POLICY "Elevated update simulations"
ON public.financing_simulations FOR UPDATE TO authenticated
USING (has_elevated_access(auth.uid()))
WITH CHECK (has_elevated_access(auth.uid()));

CREATE POLICY "Elevated delete simulations"
ON public.financing_simulations FOR DELETE TO authenticated
USING (has_elevated_access(auth.uid()));

CREATE TRIGGER financing_simulations_updated_at
BEFORE UPDATE ON public.financing_simulations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
