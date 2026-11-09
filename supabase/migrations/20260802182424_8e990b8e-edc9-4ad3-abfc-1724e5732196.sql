CREATE TABLE public.sales_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid,
  month smallint NOT NULL,
  year smallint NOT NULL,
  target_qty integer NOT NULL DEFAULT 0,
  target_value numeric NOT NULL DEFAULT 0,
  bonus_on_target numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_targets TO authenticated;
GRANT ALL ON public.sales_targets TO service_role;

ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "targets_select_authenticated" ON public.sales_targets
FOR SELECT TO authenticated USING (true);

CREATE POLICY "targets_manage_elevated" ON public.sales_targets
FOR ALL TO authenticated
USING (public.has_elevated_access(auth.uid()))
WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE TRIGGER update_sales_targets_updated_at
BEFORE UPDATE ON public.sales_targets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();