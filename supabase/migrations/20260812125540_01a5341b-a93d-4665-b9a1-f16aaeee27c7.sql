CREATE TABLE public.chassis_year_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_code text NOT NULL,
  model_year integer NOT NULL,
  brand text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX chassis_year_codes_code_brand_idx
  ON public.chassis_year_codes (upper(year_code), coalesce(upper(brand), ''));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chassis_year_codes TO authenticated;
GRANT ALL ON public.chassis_year_codes TO service_role;

ALTER TABLE public.chassis_year_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view year codes"
  ON public.chassis_year_codes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Elevated can insert year codes"
  ON public.chassis_year_codes FOR INSERT TO authenticated
  WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE POLICY "Elevated can update year codes"
  ON public.chassis_year_codes FOR UPDATE TO authenticated
  USING (public.has_elevated_access(auth.uid()))
  WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE POLICY "Elevated can delete year codes"
  ON public.chassis_year_codes FOR DELETE TO authenticated
  USING (public.has_elevated_access(auth.uid()));

CREATE TRIGGER chassis_year_codes_updated_at
  BEFORE UPDATE ON public.chassis_year_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();