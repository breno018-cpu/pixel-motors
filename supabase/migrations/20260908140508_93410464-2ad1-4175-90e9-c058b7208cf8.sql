ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS instagram_handle text;

CREATE TABLE public.store_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  campaign_name text NOT NULL,
  title text NOT NULL,
  platform text NOT NULL DEFAULT 'instagram',
  image_url text,
  caption text,
  ad_url text,
  started_at date,
  ended_at date,
  budget_spent numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativo',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_ads TO authenticated;
GRANT ALL ON public.store_ads TO service_role;

ALTER TABLE public.store_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view store ads" ON public.store_ads
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Elevated can insert store ads" ON public.store_ads
  FOR INSERT TO authenticated WITH CHECK (public.has_elevated_access(auth.uid()));
CREATE POLICY "Elevated can update store ads" ON public.store_ads
  FOR UPDATE TO authenticated USING (public.has_elevated_access(auth.uid()));
CREATE POLICY "Elevated can delete store ads" ON public.store_ads
  FOR DELETE TO authenticated USING (public.has_elevated_access(auth.uid()));

CREATE TRIGGER store_ads_updated_at BEFORE UPDATE ON public.store_ads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_store_ads_store ON public.store_ads(store_id, status);

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS ad_id uuid REFERENCES public.store_ads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_name text;

CREATE INDEX idx_contracts_ad ON public.contracts(ad_id);