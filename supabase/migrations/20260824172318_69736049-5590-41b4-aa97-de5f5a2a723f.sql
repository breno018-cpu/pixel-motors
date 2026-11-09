ALTER TABLE public.vehicle_models
  ADD COLUMN IF NOT EXISTS default_purchase_price numeric,
  ADD COLUMN IF NOT EXISTS default_sale_price numeric;

CREATE TABLE IF NOT EXISTS public.vehicle_colors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  hex text,
  vehicle_model_id uuid REFERENCES public.vehicle_models(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS vehicle_colors_unique_name
  ON public.vehicle_colors (upper(name), COALESCE(vehicle_model_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_colors TO authenticated;
GRANT ALL ON public.vehicle_colors TO service_role;

ALTER TABLE public.vehicle_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view colors"
  ON public.vehicle_colors FOR SELECT TO authenticated USING (true);

CREATE POLICY "Elevated can insert colors"
  ON public.vehicle_colors FOR INSERT TO authenticated
  WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE POLICY "Elevated can update colors"
  ON public.vehicle_colors FOR UPDATE TO authenticated
  USING (public.has_elevated_access(auth.uid()));

CREATE POLICY "Elevated can delete colors"
  ON public.vehicle_colors FOR DELETE TO authenticated
  USING (public.has_elevated_access(auth.uid()));

CREATE TRIGGER vehicle_colors_updated_at
  BEFORE UPDATE ON public.vehicle_colors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();