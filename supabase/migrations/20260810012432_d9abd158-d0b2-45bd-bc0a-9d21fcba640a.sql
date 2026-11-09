CREATE TABLE public.vehicle_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  model text NOT NULL,
  vehicle_type text NOT NULL DEFAULT 'moto',
  engine_cc integer,
  fuel_type text,
  transmission text,
  warranty_months integer,
  revision_period_months integer,
  revision_period_km integer,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX vehicle_models_unique_idx ON public.vehicle_models (lower(brand), lower(model), vehicle_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_models TO authenticated;
GRANT ALL ON public.vehicle_models TO service_role;

ALTER TABLE public.vehicle_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view vehicle models"
ON public.vehicle_models FOR SELECT TO authenticated USING (true);

CREATE POLICY "Elevated can insert vehicle models"
ON public.vehicle_models FOR INSERT TO authenticated
WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE POLICY "Elevated can update vehicle models"
ON public.vehicle_models FOR UPDATE TO authenticated
USING (public.has_elevated_access(auth.uid()))
WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE POLICY "Elevated can delete vehicle models"
ON public.vehicle_models FOR DELETE TO authenticated
USING (public.has_elevated_access(auth.uid()));

CREATE TRIGGER vehicle_models_updated_at
BEFORE UPDATE ON public.vehicle_models
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();