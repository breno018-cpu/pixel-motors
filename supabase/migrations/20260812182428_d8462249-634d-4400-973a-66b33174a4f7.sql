CREATE TABLE public.financing_banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX financing_banks_name_key ON public.financing_banks (upper(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financing_banks TO authenticated;
GRANT ALL ON public.financing_banks TO service_role;

ALTER TABLE public.financing_banks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view financing banks"
  ON public.financing_banks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Elevated can insert financing banks"
  ON public.financing_banks FOR INSERT TO authenticated
  WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE POLICY "Elevated can update financing banks"
  ON public.financing_banks FOR UPDATE TO authenticated
  USING (public.has_elevated_access(auth.uid()));

CREATE POLICY "Elevated can delete financing banks"
  ON public.financing_banks FOR DELETE TO authenticated
  USING (public.has_elevated_access(auth.uid()));

CREATE TRIGGER financing_banks_updated_at
  BEFORE UPDATE ON public.financing_banks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.financing_banks (name, sort_order) VALUES
  ('BANCO ITAÚ', 1), ('SANTANDER', 2), ('BV FINANCEIRA', 3), ('BRADESCO', 4),
  ('OMNI BANCO', 5), ('BANCO PAN', 6), ('SAFRA', 7), ('CAIXA ECONÔMICA', 8);