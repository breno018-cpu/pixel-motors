
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number text NOT NULL,
  invoice_type text NOT NULL DEFAULT 'servico',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  store_id uuid,
  customer_name text NOT NULL,
  customer_document text,
  customer_address text,
  customer_email text,
  customer_phone text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0,
  tax_value numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'emitida',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Elevated users can manage invoices"
ON public.invoices FOR ALL TO authenticated
USING (public.has_elevated_access(auth.uid()))
WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
